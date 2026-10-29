import { test, expect } from "vitest";
import initSqlJs from "sql.js";
import { mkdirSync, mkdtempSync, readFileSync, rmdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { SkyDatabase } from "../electron/database";
import { goalsOn, opportunities, parseDate } from "../shared/domain";
import {
  scheduleLabel,
  revisionDateError,
  weekdayBit,
} from "../shared/schedule";
import type { GoalInput } from "../shared/types";

const wasm = resolve("node_modules/sql.js/dist/sql-wasm.wasm");
mkdirSync(".test-data", { recursive: true });
async function setup(day = "2026-10-26") {
  const file = join(mkdtempSync(resolve(".test-data/goals-")), "sky.sqlite");
  let current = day;
  const store = await SkyDatabase.open(file, wasm, {
    now: () => parseDate(current),
  });
  return {
    store,
    file,
    setDay: (next: string) => {
      current = next;
    },
    reopen: () =>
      SkyDatabase.open(file, wasm, { now: () => parseDate(current) }),
  };
}
const input = (overrides: Partial<GoalInput> = {}): GoalInput => ({
  title: "Meu próximo passo",
  description: "Um hábito possível",
  category: "Estudos",
  frequency: "daily",
  weekdayMask: 127,
  startDate: "2026-10-26",
  ...overrides,
});
async function query(bytes: Uint8Array, sql: string) {
  const SQL = await initSqlJs({ locateFile: () => wasm });
  const db = new SQL.Database(bytes);
  try {
    return db.exec(sql);
  } finally {
    db.close();
  }
}

test("selected weekdays generate only eligible dates and survive reopening", async () => {
  const { store, setDay, reopen } = await setup();
  store.createGoal(input({ weekdayMask: 21 }));
  setDay("2026-11-01");
  const state = store.load();
  expect(state.occurrences!.map((item) => item.periodStart)).toEqual([
    "2026-10-26",
    "2026-10-28",
    "2026-10-30",
  ]);
  expect(goalsOn(state, "2026-10-27", "2026-11-01")).toHaveLength(0);
  expect(state.goals[0].weekdayMask).toBe(21);
  store.close();
  const restored = await reopen();
  expect(restored.snapshot()).toEqual(state);
  restored.close();
});

test("future starts can be planned without retroactive obligations, results or statistics", async () => {
  const { store } = await setup();
  const state = store.createGoal(
    input({ startDate: "2026-10-30", weekdayMask: 16 }),
  );
  expect(state.occurrences).toHaveLength(0);
  expect(opportunities(state, "2026-10-01", "2026-10-26")).toHaveLength(0);
  expect(goalsOn(state, "2026-10-30", "2026-10-26")).toHaveLength(1);
  expect(goalsOn(state, "2026-10-29", "2026-10-26")).toHaveLength(0);
  expect(() =>
    store.setStatus(state.goals[0].id, "2026-10-30", "done"),
  ).toThrow();
  expect(() => store.createGoal(input({ startDate: "2026-10-25" }))).toThrow(
    "hoje",
  );
  store.close();
});

test("changing name, category and weekdays keeps earlier occurrences unchanged", async () => {
  const { store, setDay } = await setup();
  const id = store.createGoal(input()).goals[0].id;
  store.setStatus(id, "2026-10-26", "done");
  setDay("2026-10-28");
  store.load();
  const old = store.snapshot().occurrences;
  const state = store.updateGoal(id, {
    title: "Uma nova etapa",
    description: "",
    category: "Saúde",
    frequency: "daily",
    weekdayMask: 16,
    effectiveFrom: "2026-10-29",
  });
  expect(state.occurrences).toEqual(old);
  expect(state.revisions).toHaveLength(2);
  setDay("2026-10-31");
  const next = store.load();
  expect(goalsOn(next, "2026-10-29", "2026-10-31")).toHaveLength(0);
  expect(goalsOn(next, "2026-10-30", "2026-10-31")[0]).toMatchObject({
    title: "Uma nova etapa",
    category: "Saúde",
  });
  expect(goalsOn(next, "2026-10-26", "2026-10-31")[0]).toMatchObject({
    title: "Meu próximo passo",
    category: "Estudos",
  });
  expect(
    next.occurrences!.filter((item) => item.periodStart < "2026-10-29"),
  ).toEqual(old);
  store.close();
});

test("daily to weekly and back switches on Mondays without duplicate or overlapping commitments", async () => {
  const { store, setDay } = await setup();
  const id = store.createGoal(input()).goals[0].id;
  setDay("2026-10-28");
  store.load();
  expect(() =>
    store.updateGoal(id, {
      title: "Semanal",
      description: "",
      category: "Trabalho",
      frequency: "weekly",
      weekdayMask: 0,
      effectiveFrom: "2026-11-03",
    }),
  ).toThrow("segunda-feira");
  store.updateGoal(id, {
    title: "Semanal",
    description: "",
    category: "Trabalho",
    frequency: "weekly",
    weekdayMask: 0,
    effectiveFrom: "2026-11-02",
  });
  setDay("2026-11-04");
  const weekly = store.load();
  expect(
    weekly.occurrences!.filter((item) => item.periodStart >= "2026-11-02"),
  ).toHaveLength(1);
  store.setStatus(id, "2026-11-04", "done");
  store.updateGoal(id, {
    title: "Diária novamente",
    description: "",
    category: "Pessoal",
    frequency: "daily",
    weekdayMask: 31,
    effectiveFrom: "2026-11-09",
  });
  setDay("2026-11-10");
  const daily = store.load();
  expect(goalsOn(daily, "2026-11-09", "2026-11-10")[0].frequency).toBe("daily");
  expect(
    daily.occurrences!.filter((item) => item.periodKind === "week"),
  ).toHaveLength(1);
  expect(
    daily.occurrences!.find((item) => item.periodKind === "week"),
  ).toMatchObject({
    periodStart: "2026-11-02",
    periodEndExclusive: "2026-11-09",
    status: "done",
    title: "Semanal",
  });
  expect(
    new Set(
      daily.occurrences!.map(
        (item) => `${item.periodKind}:${item.periodStart}`,
      ),
    ).size,
  ).toBe(daily.occurrences!.length);
  store.close();
});

test("rescheduling an unapplied revision preserves current history and does not introduce a gap", async () => {
  const { store, setDay, reopen } = await setup();
  const id = store.createGoal(input()).goals[0].id;
  store.updateGoal(id, {
    title: "Próxima versão",
    description: "",
    category: "Estudos",
    frequency: "weekly",
    weekdayMask: 0,
    effectiveFrom: "2026-11-02",
  });
  const previous = store.snapshot().occurrences;
  const state = store.updateGoal(id, {
    title: "Revisão adiada",
    description: "",
    category: "Pessoal",
    frequency: "weekly",
    weekdayMask: 0,
    effectiveFrom: "2026-11-09",
  });
  expect(state.revisions).toHaveLength(2);
  expect(state.revisions![0].effectiveTo).toBe("2026-11-09");
  expect(state.occurrences).toEqual(previous);
  setDay("2026-11-03");
  const next = store.load();
  expect(goalsOn(next, "2026-11-03", "2026-11-03")[0].frequency).toBe("daily");
  store.close();
  const restored = await reopen();
  expect(restored.snapshot()).toEqual(next);
  restored.close();
});

test("a goal without any occurrence can be corrected immediately or moved before its first day", async () => {
  const { store } = await setup();
  const id = store.createGoal(input({ startDate: "2026-11-02" })).goals[0].id;
  const future = store.updateGoal(id, {
    title: "Planejada",
    description: "",
    category: "Trabalho",
    frequency: "weekly",
    weekdayMask: 0,
    effectiveFrom: "2026-11-04",
  });
  expect(future.revisions).toHaveLength(1);
  expect(future.goals[0].startDate).toBe("2026-11-04");
  const active = store.updateGoal(id, {
    title: "Começar hoje",
    description: "",
    category: "Trabalho",
    frequency: "daily",
    weekdayMask: 127,
    effectiveFrom: "2026-10-26",
  });
  expect(active.revisions).toHaveLength(1);
  expect(active.occurrences).toHaveLength(1);
  expect(() =>
    store.updateGoal(id, {
      title: "Não pode mais",
      description: "",
      category: "Trabalho",
      effectiveFrom: "2026-10-26",
    }),
  ).toThrow("mínima");
  store.close();
});

test("invalid runtime schedules and revision dates are rejected before changing memory or disk", async () => {
  const { store, file } = await setup();
  const id = store.createGoal(input()).goals[0].id;
  const before = store.snapshot();
  const bytes = readFileSync(file);
  for (const mask of [0, 128, -1, 1.5, null, "21"])
    expect(() =>
      store.createGoal(input({ weekdayMask: mask as never })),
    ).toThrow();
  expect(() =>
    store.createGoal(input({ frequency: "weekly", weekdayMask: 21 })),
  ).toThrow();
  for (const change of [
    { effectiveFrom: "2026-02-30" },
    { effectiveFrom: "2026-10-26" },
    { effectiveFrom: null },
    { frequency: null },
    { frequency: "monthly" },
    { weekdayMask: null },
    { weekdayMask: 0 },
  ])
    expect(() =>
      store.updateGoal(id, {
        title: "Inválida",
        description: "",
        category: "Pessoal",
        ...change,
      } as never),
    ).toThrow();
  expect(store.snapshot()).toEqual(before);
  expect(readFileSync(file)).toEqual(bytes);
  store.close();
});

test("deleting an unused goal removes pending occurrences and revisions without orphans", async () => {
  const { store, reopen } = await setup();
  const id = store.createGoal(input()).goals[0].id;
  expect(store.snapshot().goals[0].canDelete).toBe(true);
  const result = store.deleteGoal(id);
  expect(result.goals).toHaveLength(0);
  expect(result.revisions).toHaveLength(0);
  expect(result.occurrences).toHaveLength(0);
  expect(await query(store.exportBytes(), "PRAGMA foreign_key_check")).toEqual(
    [],
  );
  store.close();
  const restored = await reopen();
  expect(restored.snapshot().goals).toHaveLength(0);
  restored.close();
});

test("deletion is blocked after either outcome, including when undone and after reopening", async () => {
  const { store, reopen } = await setup();
  for (const status of ["done", "missed"] as const) {
    const id = store.createGoal(input({ title: status })).goals.at(-1)!.id;
    store.setStatus(id, "2026-10-26", status);
    store.setStatus(id, "2026-10-26", "pending");
    expect(
      store.snapshot().goals.find((goal) => goal.id === id)!.canDelete,
    ).toBe(false);
    expect(() => store.deleteGoal(id)).toThrow("histórico");
  }
  store.close();
  const restored = await reopen();
  for (const goal of restored.snapshot().goals)
    expect(() => restored.deleteGoal(goal.id)).toThrow("histórico");
  restored.close();
});

test("a failed deletion rolls back all rows and file bytes", async () => {
  const { store, file } = await setup();
  const id = store.createGoal(input()).goals[0].id;
  const before = store.snapshot();
  const bytes = readFileSync(file);
  mkdirSync(`${file}.tmp`);
  expect(() => store.deleteGoal(id)).toThrow();
  expect(store.snapshot()).toEqual(before);
  expect(readFileSync(file)).toEqual(bytes);
  rmdirSync(`${file}.tmp`);
  store.close();
});

test("archive preserves current results, stops new occurrences and blocks later edits", async () => {
  const { store, setDay } = await setup();
  const id = store.createGoal(input()).goals[0].id;
  store.setStatus(id, "2026-10-26", "done");
  store.updateGoal(id, {
    title: "Depois",
    description: "",
    category: "Estudos",
    effectiveFrom: "2026-10-28",
  });
  const before = store.snapshot().occurrences;
  store.archiveGoal(id);
  setDay("2026-10-30");
  const archived = store.load();
  expect(archived.goals[0].title).toBe("Meu próximo passo");
  expect(archived.goals[0].nextRevision?.title).toBe("Depois");
  expect(archived.occurrences).toEqual(before);
  expect(goalsOn(archived, "2026-10-26", "2026-10-30")[0].title).toBe(
    "Meu próximo passo",
  );
  expect(goalsOn(archived, "2026-10-30", "2026-10-30")).toHaveLength(0);
  expect(() =>
    store.updateGoal(id, {
      title: "Não",
      description: "",
      category: "Estudos",
    }),
  ).toThrow("arquivada");
  expect(() => store.deleteGoal(id)).toThrow("histórico");
  store.close();
});

test("schedule labels and week boundaries cover Sunday and month transitions", () => {
  expect(weekdayBit("2026-11-01")).toBe(64);
  expect(scheduleLabel("daily", 21)).toBe("Seg · Qua · Sex");
  expect(
    revisionDateError("2026-11-02", "2026-11-01", "weekly", "daily"),
  ).toBeNull();
  expect(
    revisionDateError("2026-11-03", "2026-11-01", "daily", "weekly"),
  ).toContain("segunda-feira");
});

test("a Sunday-only goal crosses the month boundary without creating Saturday or Monday obligations", async () => {
  const { store, setDay } = await setup("2026-10-31");
  store.createGoal(input({ startDate: "2026-10-31", weekdayMask: 64 }));
  setDay("2026-11-02");
  const state = store.load();
  expect(state.occurrences!.map((item) => item.periodStart)).toEqual([
    "2026-11-01",
  ]);
  expect(goalsOn(state, "2026-10-31", "2026-11-02")).toHaveLength(0);
  expect(goalsOn(state, "2026-11-02", "2026-11-02")).toHaveLength(0);
  store.close();
});
