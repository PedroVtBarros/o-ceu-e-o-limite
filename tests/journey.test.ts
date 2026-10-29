import { test, expect } from "vitest";
import initSqlJs from "sql.js";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { SkyDatabase } from "../electron/database";
import { dateKey, parseDate, shiftDate } from "../shared/domain";
import { dailySummary, weeklySummary } from "../shared/checklist";
import { journeySummary, encouragement } from "../shared/journey";
import {
  defaultPreferences,
  longTermPercent,
  themeOptions,
} from "../shared/personalization";
import { defaultRoutineInput } from "../shared/routineRuns";
import { routines } from "../shared/routines";
import { rows } from "../electron/storage/sql";
import { sqliteBytes } from "../electron/storage/files";
import type { GoalInput, LongTermGoalInput, Snapshot } from "../shared/types";

const wasm = resolve("node_modules/sql.js/dist/sql-wasm.wasm");
mkdirSync(".test-data", { recursive: true });
const objective = (
  change: Partial<LongTermGoalInput> = {},
): LongTermGoalInput => ({
  operationKey: "objective-one",
  title: "Ler doze livros",
  description: "Um capítulo por vez",
  category: "Estudos",
  target: 12,
  current: 0,
  unit: "livros",
  dueOn: "2026-12-31",
  ...change,
});
async function setup(start = "2026-10-26") {
  let day = start;
  const dir = mkdtempSync(resolve(".test-data/journey-"));
  const file = join(dir, "sky.sqlite");
  const clock = () => parseDate(day);
  const store = await SkyDatabase.open(file, wasm, { now: clock });
  return {
    store,
    file,
    dir,
    advance: (next: string) => {
      day = next;
      store.load();
    },
    reopen: () => SkyDatabase.open(file, wasm, { now: clock }),
    create: (change: Partial<GoalInput> = {}) =>
      store
        .createGoal({
          title: "Ler",
          description: "",
          category: "Estudos",
          frequency: "daily",
          startDate: day,
          ...change,
        })
        .goals.at(-1)!.id,
  };
}
function completedSnapshot(count: number): Snapshot {
  const today = "2026-10-28";
  const goals = Array.from({ length: count }, (_, i) => ({
    id: `goal-${i}`,
    title: `Passo ${i}`,
    description: "",
    category: "Pessoal" as const,
    frequency: "once" as const,
    startDate: today,
    routineId: null,
    archivedOn: null,
  }));
  return {
    goals,
    entries: goals.map((goal) => ({
      goalId: goal.id,
      period: today,
      status: "done",
    })),
  };
}
async function v3Fixture() {
  const fixture = await setup();
  const { store, create, advance } = fixture;
  const id = create();
  store.setStatus(id, "2026-10-26", "done");
  const weekly = create({ title: "Planejar", frequency: "weekly" });
  store.setStatus(weekly, "2026-10-26", "done");
  const draft = defaultRoutineInput(routines[0], "2026-10-26", "original-v3");
  draft.activities = [
    {
      ...draft.activities[0],
      time: "09:00",
      minutes: 15,
      intensity: "Com calma",
    },
  ];
  const run = store.startRoutine(draft).routineRuns![0];
  store.setStatus(run.activities[0].goals[0].id, "2026-10-26", "done");
  store.planRest("2026-10-27", "Folga");
  store.updateGoal(id, {
    title: "Meu novo passo",
    category: "Pessoal",
    description: "Versão futura",
  });
  advance("2026-10-28");
  const snapshot = store.snapshot();
  const SQL = await initSqlJs({ locateFile: () => wasm });
  const db = new SQL.Database(store.exportBytes());
  store.close();
  db.run("DROP TABLE long_term_goals");
  db.run("DROP TABLE personal_preferences");
  db.run("DELETE FROM schema_migrations WHERE version = 4");
  db.run("PRAGMA user_version = 3");
  const tables = [
    "goals",
    "goal_revisions",
    "goal_occurrences",
    "occurrence_events",
    "day_plans",
    "routine_runs",
  ];
  const expected = tables.map((table) =>
    rows(db, `SELECT * FROM ${table} ORDER BY rowid`),
  );
  const bytes = sqliteBytes(db);
  db.close();
  writeFileSync(fixture.file, bytes);
  return { ...fixture, SQL, snapshot, bytes, tables, expected };
}

test("empty history starts at zero points with locked achievements and explicit default preferences", async () => {
  const { store } = await setup();
  try {
    expect(store.snapshot().preferences).toEqual(defaultPreferences);
    const result = journeySummary(store.snapshot(), "2026-10-26");
    expect(result).toMatchObject({
      points: 0,
      completed: 0,
      bestStreak: 0,
      currentLevel: { level: 1 },
      levelPercent: 0,
    });
    expect(
      result.achievements.every((item) => !item.achieved && item.value === 0),
    ).toBe(true);
  } finally {
    store.close();
  }
});

test("points count each daily, weekly and routine completion once, regardless of repeated events and re-marking", async () => {
  const { store, create, advance } = await setup();
  try {
    const daily = create();
    const weekly = create({ frequency: "weekly" });
    const run = store.startRoutine(
      defaultRoutineInput(routines[0], "2026-10-26", "one-run"),
    ).routineRuns![0];
    store.setStatus(daily, "2026-10-26", "done");
    store.setStatus(weekly, "2026-10-26", "done");
    store.setStatus(run.activities[0].goals[0].id, "2026-10-26", "done");
    for (let i = 0; i < 3; i++) {
      store.setStatus(daily, "2026-10-26", "done");
      expect(journeySummary(store.snapshot(), "2026-10-26").points).toBe(30);
      store.setStatus(daily, "2026-10-26", "pending");
      expect(journeySummary(store.snapshot(), "2026-10-26").points).toBe(20);
      store.setStatus(daily, "2026-10-26", "done");
    }
    advance("2026-10-28");
    store.setStatus(weekly, "2026-10-28", "done");
    const result = journeySummary(store.snapshot(), "2026-10-28");
    expect(result.points).toBe(30);
    expect(
      result.achievements
        .filter((item) => item.achieved)
        .map((item) => item.id),
    ).toEqual(["first", "weekly", "routine"]);
  } finally {
    store.close();
  }
});

test("all level thresholds and next-level progress use current completions and can move back after a correction", () => {
  for (const [count, level, next] of [
    [0, 1, 2],
    [9, 1, 2],
    [10, 2, 3],
    [29, 2, 3],
    [30, 3, 4],
    [69, 3, 4],
    [70, 4, 5],
    [149, 4, 5],
    [150, 5, null],
  ] as const) {
    const result = journeySummary(completedSnapshot(count), "2026-10-28");
    expect(result.points).toBe(count * 10);
    expect(result.currentLevel.level).toBe(level);
    expect(result.nextLevel?.level ?? null).toBe(next);
  }
  const snapshot = completedSnapshot(10);
  expect(
    journeySummary(snapshot, "2026-10-28").achievements.find(
      (item) => item.id === "ten",
    )!.achieved,
  ).toBe(true);
  snapshot.entries.pop();
  expect(journeySummary(snapshot, "2026-10-28")).toMatchObject({
    points: 90,
    currentLevel: { level: 1 },
  });
  expect(
    journeySummary(snapshot, "2026-10-28").achievements.find(
      (item) => item.id === "ten",
    )!.achieved,
  ).toBe(false);
});

test("best historical sequence skips rest and scheduled days off, breaks on a closed unrecorded day and recalculates corrections", async () => {
  const { store, create, advance } = await setup("2026-10-19");
  try {
    const id = create({ weekdayMask: 31 });
    store.planRest("2026-10-20", "Folga");
    advance("2026-10-28");
    for (const day of [
      "2026-10-19",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-26",
      "2026-10-28",
    ])
      store.setStatus(id, day, "done");
    expect(journeySummary(store.snapshot(), "2026-10-28").bestStreak).toBe(5);
    store.setStatus(id, "2026-10-27", "done");
    expect(journeySummary(store.snapshot(), "2026-10-28").bestStreak).toBe(7);
    expect(
      journeySummary(store.snapshot(), "2026-10-28").achievements.find(
        (item) => item.id === "seven",
      )!.achieved,
    ).toBe(true);
    store.setStatus(id, "2026-10-21", "pending");
    expect(journeySummary(store.snapshot(), "2026-10-28").bestStreak).toBe(5);
    advance("2026-10-30");
    expect(journeySummary(store.snapshot(), "2026-10-30").bestStreak).toBe(5);
    expect(
      journeySummary(store.snapshot(), "2026-10-30").achievements.find(
        (item) => item.id === "seven",
      )!.achieved,
    ).toBe(false);
  } finally {
    store.close();
  }
});

test("rest, future, missed and pending entries do not grant points; archived historical completions retain them", async () => {
  const { store, create, advance } = await setup();
  try {
    const id = create();
    store.setStatus(id, "2026-10-26", "done");
    store.planRest("2026-10-27", "Folga");
    advance("2026-10-28");
    store.archiveGoal(id);
    const other = create({ title: "Outra" });
    store.setStatus(other, "2026-10-28", "missed");
    create({ title: "Futura", startDate: "2026-10-30" });
    expect(journeySummary(store.snapshot(), "2026-10-28")).toMatchObject({
      points: 10,
      completed: 1,
      bestStreak: 1,
    });
    expect(encouragement(store.snapshot(), "2026-10-27")).toContain(
      "Descansar",
    );
  } finally {
    store.close();
  }
});

test("completed long-term objectives do not create occurrences, scores or daily and weekly obligations", async () => {
  const { store } = await setup();
  try {
    const snapshot = store.createLongTermGoal(objective({ current: 12 }));
    expect(snapshot.longTermGoals).toHaveLength(1);
    expect(snapshot.goals).toEqual([]);
    expect(snapshot.occurrences).toEqual([]);
    expect(snapshot.entries).toEqual([]);
    expect(dailySummary(snapshot, "2026-10-26", "2026-10-26")).toMatchObject({
      total: 0,
      percent: null,
    });
    expect(weeklySummary(snapshot, "2026-10-26", "2026-10-26")).toMatchObject({
      total: 0,
      percent: null,
    });
    expect(journeySummary(snapshot, "2026-10-26").points).toBe(0);
    expect(
      journeySummary(snapshot, "2026-10-26").achievements.every(
        (item) => !item.achieved,
      ),
    ).toBe(true);
  } finally {
    store.close();
  }
});

test("objective creation is idempotent after editing and reopening; reusing the same key with other choices is refused", async () => {
  const { store, reopen } = await setup();
  const draft = objective();
  const goal = store.createLongTermGoal(draft).longTermGoals![0];
  store.updateLongTermGoal(goal.id, {
    ...goal,
    current: 4,
    title: "Um hábito de leitura",
  });
  expect(store.createLongTermGoal(draft).longTermGoals).toHaveLength(1);
  expect(() => store.createLongTermGoal({ ...draft, title: "Outro" })).toThrow(
    "solicitação",
  );
  const before = store.snapshot();
  store.close();
  const restored = await reopen();
  try {
    expect(restored.createLongTermGoal(draft)).toEqual(before);
  } finally {
    restored.close();
  }
});

test("objectives can be progressed, completed, corrected, archived and reactivated without altering daily history", async () => {
  const { store, create, advance, reopen } = await setup();
  const daily = create();
  store.setStatus(daily, "2026-10-26", "done");
  const beforeDaily = store.snapshot().occurrences;
  const goal = store.createLongTermGoal(objective({ dueOn: "2026-10-27" }))
    .longTermGoals![0];
  advance("2026-10-28");
  store.updateLongTermGoal(goal.id, { ...goal, current: 12 });
  expect(longTermPercent(store.snapshot().longTermGoals![0])).toBe(100);
  store.updateLongTermGoal(goal.id, { ...goal, current: 3 });
  expect(longTermPercent(store.snapshot().longTermGoals![0])).toBe(25);
  store.archiveLongTermGoal(goal.id, true);
  expect(() =>
    store.updateLongTermGoal(goal.id, { ...goal, current: 4 }),
  ).toThrow("Reative");
  store.archiveLongTermGoal(goal.id, false);
  expect(store.snapshot().longTermGoals![0].current).toBe(3);
  expect(
    store
      .snapshot()
      .occurrences!.filter((item) => item.periodStart === "2026-10-26"),
  ).toEqual(beforeDaily);
  const before = store.snapshot();
  store.close();
  const restored = await reopen();
  expect(restored.snapshot()).toEqual(before);
  restored.close();
});

test("objective progress never displays a completed 100% before reaching the target", () => {
  expect(longTermPercent({ current: 1, target: 3 })).toBe(33);
  expect(longTermPercent({ current: 999.99, target: 1000 })).toBe(99);
  expect(longTermPercent({ current: 1000, target: 1000 })).toBe(100);
});

test("theme and encouragement preferences persist across reopening without changing the agenda or points", async () => {
  const { store, create, reopen } = await setup();
  const id = create();
  store.setStatus(id, "2026-10-26", "done");
  const history = store.snapshot().occurrences;
  store.updatePreferences({ theme: "forest", showEncouragement: false });
  expect(store.snapshot().occurrences).toEqual(history);
  expect(journeySummary(store.snapshot(), "2026-10-26").points).toBe(10);
  const before = store.snapshot();
  store.close();
  const restored = await reopen();
  expect(restored.snapshot()).toEqual(before);
  restored.close();
});

test("theme palettes keep primary actions readable and focus colors distinct from both dark surfaces", () => {
  const luminance = (color: string) => {
    const rgb = color
      .match(/[a-f\d]{2}/gi)!
      .map((part) => parseInt(part, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const contrast = (a: string, b: string) => {
    const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  for (const theme of themeOptions) {
    expect(contrast("#FFFFFF", theme.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#C3CCDF", theme.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.light, theme.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(theme.light, theme.background)).toBeGreaterThanOrEqual(3);
  }
});

test("malformed goals and preferences are rejected in main without modifying memory or the active file", async () => {
  const { store, file } = await setup();
  try {
    const before = store.snapshot(),
      bytes = readFileSync(file);
    for (const bad of [
      null,
      {},
      { theme: "light", showEncouragement: true },
      { theme: "violet", showEncouragement: "yes" },
    ])
      expect(() => store.updatePreferences(bad as never)).toThrow();
    for (const bad of [
      null,
      {},
      objective({ title: " " }),
      objective({ target: NaN }),
      objective({ target: Infinity }),
      objective({ target: 0 }),
      objective({ target: 1e9 + 1 }),
      objective({ current: -1 }),
      objective({ current: 13 }),
      objective({ current: Infinity }),
      objective({ unit: "" }),
      objective({ description: "x".repeat(501) }),
      objective({ dueOn: "2026-02-30" }),
      objective({ dueOn: "2026-10-25" }),
      objective({ operationKey: "" }),
    ])
      expect(() => store.createLongTermGoal(bad as never)).toThrow();
    expect(() =>
      store.archiveLongTermGoal("missing", "yes" as never),
    ).toThrow();
    expect(() => store.updateLongTermGoal("missing", objective())).toThrow();
    expect(store.snapshot()).toEqual(before);
    expect(readFileSync(file)).toEqual(bytes);
  } finally {
    store.close();
  }
});

test("write failures roll back preferences and objectives, and a retry does not leave a duplicate operation", async () => {
  const { store, file } = await setup();
  try {
    const before = store.snapshot(),
      bytes = readFileSync(file);
    mkdirSync(`${file}.tmp`);
    expect(() =>
      store.updatePreferences({ theme: "ocean", showEncouragement: false }),
    ).toThrow();
    expect(() => store.createLongTermGoal(objective())).toThrow();
    expect(store.snapshot()).toEqual(before);
    expect(readFileSync(file)).toEqual(bytes);
    rmdirSync(`${file}.tmp`);
    const goal = store.createLongTermGoal(objective()).longTermGoals![0];
    const saved = store.snapshot();
    mkdirSync(`${file}.tmp`);
    expect(() =>
      store.updateLongTermGoal(goal.id, { ...goal, current: 3 }),
    ).toThrow();
    expect(() => store.archiveLongTermGoal(goal.id, true)).toThrow();
    expect(store.snapshot()).toEqual(saved);
    rmdirSync(`${file}.tmp`);
    expect(store.createLongTermGoal(objective()).longTermGoals).toHaveLength(1);
  } finally {
    store.close();
  }
});

test("v3 migrates to v4 with exact rollback backup, all prior content unchanged and defaults added once", async () => {
  const { file, dir, SQL, snapshot, bytes, tables, expected } =
    await v3Fixture();
  const store = await SkyDatabase.open(file, wasm, {
    now: () => parseDate("2026-10-28"),
  });
  expect(store.snapshot()).toEqual(snapshot);
  expect(store.snapshot().schemaVersion).toBe(4);
  const db = new SQL.Database(store.exportBytes());
  expect(
    tables.map((table) => rows(db, `SELECT * FROM ${table} ORDER BY rowid`)),
  ).toEqual(expected);
  expect(
    rows(db, "SELECT version FROM schema_migrations ORDER BY version"),
  ).toEqual([{ version: 2 }, { version: 3 }, { version: 4 }]);
  db.close();
  store.close();
  const backup = readdirSync(dir).filter((name) => name.includes(".pre-v4-"));
  expect(backup).toHaveLength(1);
  expect(readFileSync(join(dir, backup[0]))).toEqual(Buffer.from(bytes));
  const restored = await SkyDatabase.open(file, wasm, {
    now: () => parseDate("2026-10-28"),
  });
  expect(restored.snapshot()).toEqual(snapshot);
  restored.close();
  expect(
    readdirSync(dir).filter((name) => name.includes(".pre-v4-")),
  ).toHaveLength(1);
});

test("failed v3 migration preserves source bytes, and import of v3 preserves the active personalized v4 as rollback", async () => {
  const legacy = await v3Fixture();
  mkdirSync(`${legacy.file}.tmp`);
  await expect(SkyDatabase.open(legacy.file, wasm)).rejects.toThrow();
  expect(readFileSync(legacy.file)).toEqual(Buffer.from(legacy.bytes));
  rmdirSync(`${legacy.file}.tmp`);
  const { store, file } = await setup("2026-10-28");
  try {
    store.updatePreferences({ theme: "forest", showEncouragement: false });
    store.createLongTermGoal(objective());
    const snapshot = store.snapshot(),
      bytes = store.exportBytes();
    const result = await store.importBytes(legacy.bytes);
    expect(result).toEqual(legacy.snapshot);
    expect(readFileSync(`${file}.bak`)).toEqual(Buffer.from(bytes));
    expect(await store.importBytes(bytes)).toEqual(snapshot);
  } finally {
    store.close();
  }
});

test("tampered preference and long-term backup records are refused without replacing current memory or disk", async () => {
  const { store, file } = await setup();
  try {
    const snapshot = store.createLongTermGoal(objective());
    const bytes = store.exportBytes(),
      before = readFileSync(file);
    const SQL = await initSqlJs({ locateFile: () => wasm });
    for (const sql of [
      "DELETE FROM personal_preferences",
      "UPDATE long_term_goals SET create_request_json = '{}'",
      "UPDATE long_term_goals SET due_on = '2026-02-30'",
      "UPDATE long_term_goals SET archived_at = 'yesterday'",
      "UPDATE schema_migrations SET checksum = 'bad' WHERE version = 4",
    ]) {
      const db = new SQL.Database(bytes);
      db.run(sql);
      const bad = sqliteBytes(db);
      db.close();
      await expect(store.importBytes(bad)).rejects.toThrow();
      expect(store.snapshot()).toEqual(snapshot);
      expect(readFileSync(file)).toEqual(before);
    }
  } finally {
    store.close();
  }
});
