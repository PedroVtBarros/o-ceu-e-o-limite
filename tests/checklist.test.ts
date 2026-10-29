import { test, expect } from "vitest";
import initSqlJs from 'sql.js';
import { mkdirSync, mkdtempSync, readFileSync, rmdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { SkyDatabase } from "../electron/database";
import { goalsOn, opportunities, parseDate, streak } from "../shared/domain";
import {
  dailySummary,
  dailyWeekSummary,
  dayLabel,
  resultLabel,
  weeklyGoals,
  weeklySummary,
} from "../shared/checklist";
import type { GoalInput, Status } from "../shared/types";

const wasm = resolve("node_modules/sql.js/dist/sql-wasm.wasm");
mkdirSync(".test-data", { recursive: true });
const input = (change: Partial<GoalInput> = {}): GoalInput => ({
  title: "Ler um pouco",
  description: "",
  category: "Estudos",
  frequency: "daily",
  startDate: "2026-10-26",
  ...change,
});
async function setup() {
  const file = join(
    mkdtempSync(resolve(".test-data/checklist-")),
    "sky.sqlite",
  );
  let day = "2026-10-26";
  const clock = () => parseDate(day);
  const store = await SkyDatabase.open(file, wasm, { now: clock });
  return {
    store,
    file,
    advance: (next: string) => {
      day = next;
    },
    reopen: () => SkyDatabase.open(file, wasm, { now: clock }),
  };
}

test("8 of 10 yields 80%, retaining pending/missed in the denominator and excluding weekly goals", async () => {
  const { store } = await setup();
  const ids = Array.from(
    { length: 10 },
    (_, index) =>
      store.createGoal(input({ title: `Meta ${index + 1}` })).goals.at(-1)!.id,
  );
  ids.slice(0, 8).forEach((id) => store.setStatus(id, "2026-10-26", "done"));
  store.setStatus(ids[8], "2026-10-26", "missed");
  const weeklyId = store
    .createGoal(input({ title: "Planejar semana", frequency: "weekly" }))
    .goals.at(-1)!.id;
  store.setStatus(weeklyId, "2026-10-26", "done");
  const snapshot = store.snapshot();
  expect(dailySummary(snapshot, "2026-10-26", "2026-10-26")).toMatchObject({
    total: 10,
    done: 8,
    missed: 1,
    pending: 1,
    percent: 80,
  });
  expect(weeklySummary(snapshot, "2026-10-26", "2026-10-26")).toMatchObject({
    total: 1,
    done: 1,
    percent: 100,
  });
  expect(dailyWeekSummary(snapshot, "2026-10-26", "2026-10-26")).toMatchObject({
    total: 10,
    done: 8,
    percent: 80,
  });
  store.close();
});

test("one of three displays 33% and weekly daily totals weight opportunities instead of averaging rounded days", async () => {
  const { store, advance } = await setup();
  const ids = Array.from(
    { length: 3 },
    (_, index) =>
      store.createGoal(input({ title: `Meta ${index}` })).goals.at(-1)!.id,
  );
  store.setStatus(ids[0], "2026-10-26", "done");
  expect(
    dailySummary(store.snapshot(), "2026-10-26", "2026-10-26").percent,
  ).toBe(33);
  advance("2026-10-27");
  store.load();
  store.archiveGoal(ids[1]);
  store.archiveGoal(ids[2]);
  store.setStatus(ids[0], "2026-10-27", "done");
  expect(
    dailySummary(store.snapshot(), "2026-10-27", "2026-10-27").percent,
  ).toBe(100);
  expect(
    dailyWeekSummary(store.snapshot(), "2026-10-27", "2026-10-27"),
  ).toMatchObject({ total: 4, done: 2, percent: 50, partial: true });
  store.close();
});

test("empty agenda, rest and future have no performance percentage", async () => {
  const { store } = await setup();
  expect(
    dailySummary(store.snapshot(), "2026-10-26", "2026-10-26"),
  ).toMatchObject({ state: "empty", percent: null });
  expect(
    weeklySummary(store.snapshot(), "2026-10-26", "2026-10-26").percent,
  ).toBeNull();
  store.createGoal(input());
  expect(
    dailySummary(store.snapshot(), "2026-10-27", "2026-10-26"),
  ).toMatchObject({ state: "planned", percent: null });
  store.planRest("2026-10-26", "Um tempo para mim");
  expect(
    dailySummary(store.snapshot(), "2026-10-26", "2026-10-26"),
  ).toMatchObject({ state: "rest", percent: null });
  expect(dayLabel(store.snapshot(), "2026-10-26", "2026-10-26")).toBe(
    "Descanso planejado",
  );
  store.close();
});

test("past unassessed goals remain pending with a missing-record label instead of becoming missed", async () => {
  const { store, advance } = await setup();
  store.createGoal(input());
  advance("2026-10-27");
  const snapshot = store.load();
  expect(
    snapshot.occurrences!.find((item) => item.periodStart === "2026-10-26")!
      .status,
  ).toBe("pending");
  expect(snapshot.events).toHaveLength(0);
  expect(
    resultLabel(
      goalsOn(snapshot, "2026-10-26", "2026-10-27")[0],
      "2026-10-26",
      snapshot,
      "2026-10-27",
    ),
  ).toBe("Sem registro");
  expect(dailySummary(snapshot, "2026-10-26", "2026-10-27")).toMatchObject({
    pending: 1,
    missed: 0,
    percent: 0,
  });
  store.close();
});

test("rest dispenses daily and routine goals, including newly added ones, without touching a weekly result", async () => {
  const { store } = await setup();
  const daily = store.createGoal(input()).goals[0].id;
  const weekly = store
    .createGoal(input({ title: "Semanal", frequency: "weekly" }))
    .goals.at(-1)!.id;
  store.setStatus(weekly, "2026-10-26", "done");
  store.planRest("2026-10-26", "Recuperar as energias");
  store.createGoal(input({ title: "Outra diária" }));
  store.addRoutine("ilia", "2026-10-26");
  const snapshot = store.snapshot();
  expect(
    snapshot
      .occurrences!.filter((item) => item.periodKind === "day")
      .every(
        (item) => item.disposition === "rest" && item.status === "pending",
      ),
  ).toBe(true);
  expect(snapshot.events).toHaveLength(1);
  expect(() => store.setStatus(daily, "2026-10-26", "done")).toThrow(
    "disponível",
  );
  expect(weeklySummary(snapshot, "2026-10-26", "2026-10-26")).toMatchObject({
    done: 1,
    total: 1,
    percent: 100,
  });
  expect(
    opportunities(snapshot, "2026-10-26", "2026-10-26").filter(
      (item) => item.goal.frequency !== "weekly",
    ),
  ).toHaveLength(0);
  const restored = store.removeRest("2026-10-26");
  expect(dailySummary(restored, "2026-10-26", "2026-10-26")).toMatchObject({
    state: "active",
    total: 6,
    percent: 0,
  });
  expect(restored.dayPlans).toHaveLength(0);
  store.close();
});

test("future rest is idempotent, materializes when its day arrives and survives reopening", async () => {
  const { store, advance, reopen } = await setup();
  store.createGoal(input());
  const planned = store.planRest("2026-10-28", "Folga");
  expect(
    planned.occurrences!.some((item) => item.periodStart === "2026-10-28"),
  ).toBe(false);
  expect(goalsOn(planned, "2026-10-28", "2026-10-26")).toHaveLength(0);
  expect(store.planRest("2026-10-28", "Folga")).toEqual(planned);
  advance("2026-10-27");
  const edited = store.planRest("2026-10-28", "Descansar");
  expect(edited.dayPlans![0].createdAt).toBe(planned.dayPlans![0].createdAt);
  expect(edited.dayPlans![0].updatedAt).not.toBe(
    planned.dayPlans![0].updatedAt,
  );
  advance("2026-10-28");
  const arrived = store.load();
  expect(
    arrived.occurrences!.find((item) => item.periodStart === "2026-10-28")!
      .disposition,
  ).toBe("rest");
  store.close();
  const restored = await reopen();
  expect(restored.snapshot()).toEqual(arrived);
  restored.close();
});

test.each(["done", "missed"] as const)(
  "rest cannot erase a %s result, even after undoing it",
  async (status) => {
    const { store, file } = await setup();
    const id = store.createGoal(input()).goals[0].id;
    store.setStatus(id, "2026-10-26", status);
    store.setStatus(id, "2026-10-26", "pending");
    const before = store.snapshot();
    const bytes = readFileSync(file);
    expect(() => store.planRest("2026-10-26", "")).toThrow("histórico");
    expect(store.snapshot()).toEqual(before);
    expect(readFileSync(file)).toEqual(bytes);
    store.close();
  },
);

test("closed days cannot gain or lose rest retroactively", async () => {
  const { store, advance, file } = await setup();
  store.createGoal(input());
  store.planRest("2026-10-26", "Já planejado");
  advance("2026-10-27");
  const before = store.load();
  const bytes = readFileSync(file);
  expect(() => store.removeRest("2026-10-26")).toThrow("encerrado");
  expect(() => store.planRest("2026-10-26", "Outra")).toThrow("futura");
  expect(store.snapshot()).toEqual(before);
  expect(readFileSync(file)).toEqual(bytes);
  store.close();
});

test("rest removal does not revive archived or deleted goals", async () => {
  const { store } = await setup();
  const a = store.createGoal(input({ title: "Arquivar" })).goals[0].id;
  const b = store.createGoal(input({ title: "Excluir" })).goals[1].id;
  const c = store.createGoal(input({ title: "Manter" })).goals[2].id;
  store.planRest("2026-10-26", "");
  store.archiveGoal(a);
  store.deleteGoal(b);
  const state = store.removeRest("2026-10-26");
  expect(
    goalsOn(state, "2026-10-26", "2026-10-26").map((goal) => goal.id),
  ).toEqual([c]);
  expect(
    state.occurrences!.find((item) => item.goalId === a)!.disposition,
  ).toBe("cancelled");
  store.close();
});

test("rest save and removal failures restore both memory and disk", async () => {
  const { store, file } = await setup();
  store.createGoal(input());
  let before = store.snapshot();
  let bytes = readFileSync(file);
  mkdirSync(`${file}.tmp`);
  expect(() => store.planRest("2026-10-26", "")).toThrow();
  expect(store.snapshot()).toEqual(before);
  expect(readFileSync(file)).toEqual(bytes);
  rmdirSync(`${file}.tmp`);
  store.planRest("2026-10-26", "");
  before = store.snapshot();
  bytes = readFileSync(file);
  mkdirSync(`${file}.tmp`);
  expect(() => store.removeRest("2026-10-26")).toThrow();
  expect(store.snapshot()).toEqual(before);
  expect(readFileSync(file)).toEqual(bytes);
  rmdirSync(`${file}.tmp`);
  store.close();
});

test("invalid rest input cannot change stored data", async () => {
  const { store, file } = await setup();
  const bytes = readFileSync(file);
  for (const date of ["2026-02-30", "2026-10-25", null, {}])
    expect(() => store.planRest(date as never, "")).toThrow();
  for (const note of [null, {}, "x".repeat(501)])
    expect(() => store.planRest("2026-10-26", note as never)).toThrow();
  expect(() => store.removeRest("invalid")).toThrow();
  expect(store.removeRest("2026-10-26").dayPlans).toHaveLength(0);
  expect(readFileSync(file)).toEqual(bytes);
  store.close();
});

test("calendar corrections recalculate totals and retain an ordered, duplicate-free audit trail across reopening", async () => {
  const { store, advance, reopen } = await setup();
  const id = store.createGoal(input()).goals[0].id;
  advance("2026-10-27");
  store.load();
  for (const status of ["done", "done", "missed", "pending"] as Status[])
    store.setStatus(id, "2026-10-26", status);
  const state = store.snapshot();
  expect(state.events!.map((event) => event.nextStatus)).toEqual([
    "done",
    "missed",
    "pending",
  ]);
  expect(
    state.events!.every(
      (event) =>
        event.reason === "history_correction" &&
        event.changedAt.startsWith("2026-10-27"),
    ),
  ).toBe(true);
  expect(dailySummary(state, "2026-10-26", "2026-10-27")).toMatchObject({
    percent: 0,
    pending: 1,
    missed: 0,
  });
  expect(state.occurrences![0]).toMatchObject({
    title: "Ler um pouco",
    category: "Estudos",
    status: "pending",
  });
  store.close();
  const restored = await reopen();
  expect(restored.snapshot()).toEqual(state);
  restored.close();
});

test("a weekly goal created midweek remains one opportunity in every date view and is not dispensed by rest", async () => {
  const { store, advance } = await setup();
  advance("2026-10-28");
  const id = store.createGoal(
    input({ frequency: "weekly", startDate: "2026-10-28" }),
  ).goals[0].id;
  store.setStatus(id, "2026-10-28", "done");
  store.planRest("2026-10-28", "");
  const state = store.snapshot();
  expect(weeklyGoals(state, "2026-10-26", "2026-10-28")).toHaveLength(1);
  expect(weeklySummary(state, "2026-10-26", "2026-10-28")).toMatchObject({
    total: 1,
    done: 1,
    percent: 100,
  });
  expect(dailySummary(state, "2026-10-28", "2026-10-28").percent).toBeNull();
  expect(weeklySummary(state, "2026-11-04", "2026-10-28")).toMatchObject({
    planned: true,
    percent: null,
  });
  expect(state.occurrences).toHaveLength(1);
  store.close();
});

test("the existing streak skips rest and unscheduled dates but breaks on an unevaluated eligible past day", async () => {
  const { store, advance } = await setup();
  const id = store.createGoal(input({ weekdayMask: 21 })).goals[0].id;
  store.setStatus(id, "2026-10-26", "done");
  store.planRest("2026-10-28", "");
  advance("2026-10-29");
  expect(streak(store.load(), "2026-10-29")).toBe(1);
  advance("2026-10-30");
  store.load();
  store.setStatus(id, "2026-10-30", "done");
  expect(streak(store.snapshot(), "2026-10-30")).toBe(2);
  advance("2026-11-03");
  expect(streak(store.load(), "2026-11-03")).toBe(0);
  store.close();
});

test("checklist follows creation order and keeps it after evaluations", async () => {
  const { store } = await setup();
  const ids = ["Primeira", "Segunda", "Terceira"].map(
    (title) => store.createGoal(input({ title })).goals.at(-1)!.id,
  );
  expect(
    dailySummary(store.snapshot(), "2026-10-26", "2026-10-26").goals.map(
      (goal) => goal.id,
    ),
  ).toEqual(ids);
  store.setStatus(ids[1], "2026-10-26", "done");
  expect(
    dailySummary(store.snapshot(), "2026-10-26", "2026-10-26").goals.map(
      (goal) => goal.id,
    ),
  ).toEqual(ids);
  store.close();
});

test('a backup cannot disguise an evaluated day as rest or replace the active bank', async () => {
  const { store, file } = await setup();
  const id = store.createGoal(input()).goals[0].id;
  store.setStatus(id, '2026-10-26', 'done');
  const before = store.snapshot(); const original = readFileSync(file);
  const SQL = await initSqlJs({ locateFile: () => wasm });
  const candidate = new SQL.Database(store.exportBytes());
  candidate.run("INSERT INTO day_plans VALUES ('2026-10-26', 'rest', '', 'America/Bahia', '2026-10-26T12:00:00Z', '2026-10-26T12:00:00Z')");
  await expect(store.importBytes(candidate.export())).rejects.toThrow('descanso');
  expect(store.snapshot()).toEqual(before); expect(readFileSync(file)).toEqual(original);
  candidate.close(); store.close();
});
