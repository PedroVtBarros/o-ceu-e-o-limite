import { test, expect } from "vitest";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { SkyDatabase } from "../electron/database";
import { parseDate, shiftDate, streak } from "../shared/domain";
import {
  consistencyDay,
  consistencyMonth,
  dailySeries,
  monthlyEvolution,
  rangeSummary,
  weeklyComparison,
} from "../shared/analytics";
import type { GoalInput } from "../shared/types";

const wasm = resolve("node_modules/sql.js/dist/sql-wasm.wasm");
mkdirSync(".test-data", { recursive: true });
async function setup(start: string) {
  let day = start;
  const file = join(
    mkdtempSync(resolve(".test-data/analytics-")),
    "sky.sqlite",
  );
  const clock = () => parseDate(day);
  const store = await SkyDatabase.open(file, wasm, { now: clock });
  return {
    store,
    advance: (next: string) => {
      day = next;
      store.load();
    },
    reopen: () => SkyDatabase.open(file, wasm, { now: clock }),
    create: (change: Partial<GoalInput> = {}) =>
      store
        .createGoal({
          title: "Leitura",
          description: "",
          category: "Estudos",
          frequency: "daily",
          startDate: day,
          ...change,
        })
        .goals.at(-1)!.id,
  };
}
async function yearBoundary() {
  const fixture = await setup("2025-12-28");
  const { store, create, advance } = fixture;
  const daily = create();
  const weekly = create({
    title: "Planejar a semana",
    frequency: "weekly",
    category: "Trabalho",
  });
  const once = create({
    title: "Desafio pessoal",
    frequency: "once",
    startDate: "2025-12-31",
    category: "Pessoal",
  });
  store.setStatus(daily, "2025-12-28", "done");
  store.setStatus(weekly, "2025-12-28", "done");
  store.planRest("2025-12-29", "Recuperar");
  advance("2025-12-31");
  store.setStatus(daily, "2025-12-30", "missed");
  store.setStatus(daily, "2025-12-31", "done");
  store.setStatus(once, "2025-12-31", "done");
  store.updateGoal(daily, {
    title: "Caminhada",
    description: "Nova versão",
    category: "Saúde",
    frequency: "daily",
    weekdayMask: 127,
  });
  advance("2026-01-01");
  store.setStatus(daily, "2026-01-01", "done");
  store.setStatus(weekly, "2026-01-01", "done");
  advance("2026-01-05");
  return { ...fixture, daily, weekly, today: "2026-01-05" };
}

test("monthly totals preserve December and January boundaries, frozen categories and partial current month", async () => {
  const { store, today } = await yearBoundary();
  try {
    const months = monthlyEvolution(store.snapshot(), today);
    expect(months.map((month) => month.date)).toEqual([
      "2025-08-01",
      "2025-09-01",
      "2025-10-01",
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
    ]);
    expect(months[0]).toMatchObject({
      total: 0,
      percent: null,
      partial: false,
    });
    expect(months[4]).toMatchObject({
      total: 4,
      done: 3,
      missed: 1,
      pending: 0,
      percent: 75,
      partial: false,
    });
    expect(months[5]).toMatchObject({
      total: 5,
      done: 1,
      percent: 20,
      partial: true,
    });
    const summary = rangeSummary(
      store.snapshot(),
      "2025-12-01",
      "2026-01-31",
      today,
    );
    expect(
      summary.categories.find((item) => item.category === "Estudos"),
    ).toMatchObject({ total: 3, done: 2, percent: 67 });
    expect(
      summary.categories.find((item) => item.category === "Saúde"),
    ).toMatchObject({ total: 5, done: 1 });
    expect(
      summary.categories.find((item) => item.category === "Pessoal"),
    ).toMatchObject({ total: 1, done: 1 });
    expect(
      summary.categories.find((item) => item.category === "Trabalho"),
    ).toMatchObject({ total: 0, percent: null });
  } finally {
    store.close();
  }
});

test("weekly goals intersecting a range count once, including a week spanning two years", async () => {
  const { store, today } = await yearBoundary();
  try {
    const snapshot = store.snapshot();
    expect(
      rangeSummary(snapshot, "2025-12-29", "2026-01-04", today).weekly,
    ).toMatchObject({ total: 1, done: 1, percent: 100 });
    expect(
      rangeSummary(snapshot, "2025-12-31", "2026-01-01", today).weekly,
    ).toMatchObject({ total: 1, done: 1 });
    const range = rangeSummary(snapshot, "2025-12-30", today, today);
    expect(range.weekly).toMatchObject({ total: 2, done: 1, percent: 50 });
    expect(range.daily).toMatchObject({ total: 8, done: 3, percent: 38 });
  } finally {
    store.close();
  }
});

test("comparison uses two closed Monday-to-Sunday weeks and separates the partial current week", async () => {
  const { store, today } = await yearBoundary();
  try {
    const comparison = weeklyComparison(store.snapshot(), today);
    expect(comparison.older).toMatchObject({
      from: "2025-12-22",
      through: "2025-12-28",
      partial: false,
      daily: { total: 1, done: 1, percent: 100 },
    });
    expect(comparison.previous).toMatchObject({
      from: "2025-12-29",
      through: "2026-01-04",
      partial: false,
      daily: { total: 7, done: 3, percent: 43 },
    });
    expect(comparison.current).toMatchObject({
      from: today,
      through: "2026-01-11",
      partial: true,
      daily: { total: 1, done: 0 },
      weekly: { total: 1 },
    });
    expect(comparison.dailyDelta).toBe(-57);
    expect(comparison.weeklyDelta).toBe(0);
  } finally {
    store.close();
  }
});

test("aggregates weight counts rather than rounded daily rates, retaining pending and missed results", async () => {
  const { store, create, advance } = await setup("2026-10-26");
  try {
    const daily = create();
    const once = create({ title: "Uma tarefa", frequency: "once" });
    create({ title: "Outra tarefa", frequency: "once" });
    store.setStatus(daily, "2026-10-26", "done");
    store.setStatus(once, "2026-10-26", "missed");
    advance("2026-10-27");
    store.setStatus(daily, "2026-10-27", "done");
    const snapshot = store.snapshot();
    expect(
      dailySeries(snapshot, "2026-10-26", "2026-10-27", "2026-10-27").map(
        (item) => item.percent,
      ),
    ).toEqual([33, 100]);
    expect(
      rangeSummary(snapshot, "2026-10-26", "2026-10-27", "2026-10-27").daily,
    ).toEqual({ total: 4, done: 2, missed: 1, pending: 1, percent: 50 });
  } finally {
    store.close();
  }
});

test("percentage-point change rounds raw ratios once instead of subtracting rounded percentages", async () => {
  const { store, create, advance } = await setup("2026-10-12");
  try {
    const older = Array.from({ length: 3 }, (_, i) =>
      create({ title: `Anterior ${i}`, frequency: "once" }),
    );
    store.setStatus(older[0], "2026-10-12", "done");
    advance("2026-10-19");
    const newer = Array.from({ length: 6 }, (_, i) =>
      create({ title: `Recente ${i}`, frequency: "once" }),
    );
    store.setStatus(newer[0], "2026-10-19", "done");
    advance("2026-10-26");
    const comparison = weeklyComparison(store.snapshot(), "2026-10-26");
    expect(comparison.older.daily.percent).toBe(33);
    expect(comparison.previous.daily.percent).toBe(17);
    expect(comparison.dailyDelta).toBe(-17); // 16.666... - 33.333..., not 17 - 33
  } finally {
    store.close();
  }
});

test("no agenda, rest and future are null gaps; future plans never reduce aggregate totals", async () => {
  const { store, create, advance } = await setup("2026-10-26");
  try {
    const id = create();
    store.setStatus(id, "2026-10-26", "done");
    store.planRest("2026-10-27", "Folga");
    advance("2026-10-28");
    const points = dailySeries(
      store.snapshot(),
      "2026-10-25",
      "2026-10-30",
      "2026-10-28",
    );
    expect(points.map((point) => point.percent)).toEqual([
      null,
      100,
      null,
      0,
      null,
      null,
    ]);
    expect(
      rangeSummary(store.snapshot(), "2026-10-25", "2026-10-30", "2026-10-28")
        .daily,
    ).toMatchObject({ total: 2, done: 1, percent: 50 });
    expect(
      rangeSummary(store.snapshot(), "2026-10-29", "2026-10-30", "2026-10-28")
        .daily,
    ).toMatchObject({ total: 0, percent: null });
  } finally {
    store.close();
  }
});

test("calendar distinguishes complete, partial, missed, unrecorded, rest, empty, future and today pending", async () => {
  const { store, create, advance } = await setup("2026-10-01");
  try {
    const daily = create();
    store.setStatus(daily, "2026-10-01", "done");
    create({ title: "Extra", frequency: "once", startDate: "2026-10-02" });
    store.planRest("2026-10-05", "Descanso");
    advance("2026-10-06");
    store.setStatus(daily, "2026-10-02", "done");
    store.setStatus(daily, "2026-10-03", "missed");
    const snapshot = store.snapshot();
    expect(
      [
        "2026-09-30",
        "2026-10-01",
        "2026-10-02",
        "2026-10-03",
        "2026-10-04",
        "2026-10-05",
        "2026-10-06",
        "2026-10-07",
      ].map((date) => consistencyDay(snapshot, date, "2026-10-06").state),
    ).toEqual([
      "empty",
      "complete",
      "partial",
      "missed",
      "unrecorded",
      "rest",
      "pending",
      "future",
    ]);
    expect(consistencyDay(snapshot, "2026-10-04", "2026-10-06").percent).toBe(
      0,
    );
    expect(
      consistencyDay(snapshot, "2026-10-05", "2026-10-06").percent,
    ).toBeNull();
    const month = consistencyMonth(snapshot, "2026-10-06", "2026-10-06");
    expect(month.days).toHaveLength(31);
    expect(month.offset).toBe(3); // Thursday, with Monday as the first column.
  } finally {
    store.close();
  }
});

test("leap-year calendar and monthly totals include February 29 without leaking March opportunities", async () => {
  const { store, create, advance } = await setup("2024-02-28");
  try {
    const id = create();
    store.setStatus(id, "2024-02-28", "done");
    advance("2024-03-01");
    store.setStatus(id, "2024-02-29", "done");
    const months = monthlyEvolution(store.snapshot(), "2024-03-01", 2);
    expect(months[0]).toMatchObject({
      through: "2024-02-29",
      total: 2,
      done: 2,
      percent: 100,
      partial: false,
    });
    expect(months[1]).toMatchObject({
      total: 1,
      done: 0,
      percent: 0,
      partial: true,
    });
    expect(
      consistencyMonth(store.snapshot(), "2024-02-01", "2024-03-01").days,
    ).toHaveLength(29);
    expect(
      consistencyMonth(store.snapshot(), "2025-02-01", "2025-03-01").days,
    ).toHaveLength(28);
  } finally {
    store.close();
  }
});

test("empty periods provide no comparison baseline, and weekly-only results never create daily percentages or streaks", async () => {
  const { store, create } = await setup("2026-10-28");
  try {
    const id = create({ frequency: "weekly" });
    store.setStatus(id, "2026-10-28", "done");
    const snapshot = store.snapshot();
    const comparison = weeklyComparison(snapshot, "2026-10-28");
    expect(comparison.dailyDelta).toBeNull();
    expect(comparison.weeklyDelta).toBeNull();
    expect(comparison.current.daily).toMatchObject({ total: 0, percent: null });
    expect(comparison.current.weekly).toMatchObject({ total: 1, percent: 100 });
    expect(streak(snapshot, "2026-10-28")).toBe(0);
  } finally {
    store.close();
  }
});

test("streak skips scheduled days off and rest, ignores today pending, and responds to historical undo", async () => {
  const { store, create, advance } = await setup("2026-10-23");
  try {
    const id = create({ weekdayMask: 31 }); // weekdays
    store.setStatus(id, "2026-10-23", "done");
    store.planRest("2026-10-26", "Folga planejada");
    advance("2026-10-28");
    store.setStatus(id, "2026-10-27", "done");
    expect(streak(store.snapshot(), "2026-10-28")).toBe(2);
    store.setStatus(id, "2026-10-27", "pending");
    expect(streak(store.snapshot(), "2026-10-28")).toBe(0);
    expect(
      consistencyDay(store.snapshot(), "2026-10-27", "2026-10-28").state,
    ).toBe("unrecorded");
  } finally {
    store.close();
  }
});

test("historical correction recalculates series, category and monthly totals and survives reopening", async () => {
  const { store, daily, today, reopen } = await yearBoundary();
  store.setStatus(daily, "2025-12-30", "done");
  const before = {
    range: rangeSummary(store.snapshot(), "2025-12-01", today, today),
    months: monthlyEvolution(store.snapshot(), today),
    weeks: weeklyComparison(store.snapshot(), today),
  };
  expect(before.months[4]).toMatchObject({ total: 4, done: 4, percent: 100 });
  expect(
    before.range.categories.find((item) => item.category === "Estudos"),
  ).toMatchObject({ done: 3, percent: 100 });
  expect(
    dailySeries(store.snapshot(), "2025-12-30", "2025-12-30", today)[0].percent,
  ).toBe(100);
  store.close();
  const restored = await reopen();
  try {
    expect({
      range: rangeSummary(restored.snapshot(), "2025-12-01", today, today),
      months: monthlyEvolution(restored.snapshot(), today),
      weeks: weeklyComparison(restored.snapshot(), today),
    }).toEqual(before);
  } finally {
    restored.close();
  }
});

test("7, 30 and 90-day windows include both endpoints and never backfill obligations before creation", async () => {
  const { store, create } = await setup("2026-10-28");
  try {
    create();
    for (const range of [7, 30, 90]) {
      const from = shiftDate("2026-10-28", 1 - range);
      const points = dailySeries(
        store.snapshot(),
        from,
        "2026-10-28",
        "2026-10-28",
      );
      expect(points).toHaveLength(range);
      expect(points[0].date).toBe(from);
      expect(points.at(-1)!.date).toBe("2026-10-28");
      expect(points.slice(0, -1).every((point) => point.percent === null)).toBe(
        true,
      );
      expect(
        rangeSummary(store.snapshot(), from, "2026-10-28", "2026-10-28").daily
          .total,
      ).toBe(1);
    }
  } finally {
    store.close();
  }
});
