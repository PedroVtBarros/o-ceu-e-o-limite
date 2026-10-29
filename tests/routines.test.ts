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
import { routines } from "../shared/routines";
import {
  defaultRoutineInput,
  normalizeRoutineInput,
  routineProgress,
} from "../shared/routineRuns";
import { goalsOn, parseDate } from "../shared/domain";
import { dailySummary } from "../shared/checklist";
import { rangeSummary } from "../shared/analytics";
import { rows } from "../electron/storage/sql";
import { sqliteBytes } from "../electron/storage/files";
import type { RoutineRunInput } from "../shared/types";

const wasm = resolve("node_modules/sql.js/dist/sql-wasm.wasm");
mkdirSync(".test-data", { recursive: true });
async function setup(start = "2026-10-28") {
  let day = start;
  const dir = mkdtempSync(resolve(".test-data/routines-"));
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
  };
}
const input = (change: Partial<RoutineRunInput> = {}) => ({
  ...defaultRoutineInput(routines[0], "2026-10-28", "operation-one"),
  ...change,
});

async function v2Fixture() {
  const fixture = await setup("2026-10-26");
  const { store, advance } = fixture;
  const daily = store
    .createGoal({
      title: "Ler",
      description: "Original",
      category: "Estudos",
      frequency: "daily",
      startDate: "2026-10-26",
    })
    .goals.at(-1)!.id;
  store.setStatus(daily, "2026-10-26", "done");
  store.setStatus(daily, "2026-10-26", "pending");
  store.setStatus(daily, "2026-10-26", "done");
  store.createGoal({
    title: "Rotina anterior",
    description: "Cópia sem versão",
    category: "Pessoal",
    frequency: "once",
    startDate: "2026-10-26",
    routineId: "ilia",
  });
  const weekly = store
    .createGoal({
      title: "Planejar",
      description: "",
      category: "Trabalho",
      frequency: "weekly",
      startDate: "2026-10-26",
    })
    .goals.at(-1)!.id;
  store.setStatus(weekly, "2026-10-26", "done");
  store.planRest("2026-10-27", "Folga");
  store.updateGoal(daily, {
    title: "Novo nome",
    description: "Novo",
    category: "Saúde",
    effectiveFrom: "2026-10-29",
  });
  advance("2026-10-28");
  const snapshot = store.snapshot();
  const exported = store.exportBytes();
  store.close();
  const SQL = await initSqlJs({ locateFile: () => wasm });
  const db = new SQL.Database(exported);
  db.run("DROP TABLE long_term_goals");
  db.run("DROP TABLE personal_preferences");
  db.run("DELETE FROM schema_migrations WHERE version = 4");
  db.run("DROP TABLE routine_runs");
  db.run("DELETE FROM schema_migrations WHERE version = 3");
  db.run("PRAGMA user_version = 2");
  const bytes = sqliteBytes(db);
  const tables = [
    "goals",
    "goal_revisions",
    "goal_occurrences",
    "occurrence_events",
    "day_plans",
  ];
  const original = tables.map((table) =>
    rows(db, `SELECT * FROM ${table} ORDER BY rowid`),
  );
  db.close();
  writeFileSync(fixture.file, bytes);
  return { ...fixture, snapshot, bytes, original, SQL, tables };
}

test("offline templates have reviewed sources, stable activity ids and versions; default is only today with optional schedule blank", () => {
  expect(routines).toHaveLength(3);
  for (const template of routines) {
    expect(template.version).toBeGreaterThanOrEqual(1);
    expect(template.sourceCheckedOn).toBe("2026-10-28");
    expect(new URL(template.sourceUrl).protocol).toBe("https:");
    expect(template.sourceSummary.length).toBeGreaterThan(20);
    expect(new Set(template.goals.map((goal) => goal.id)).size).toBe(
      template.goals.length,
    );
    const draft = defaultRoutineInput(template, "2026-10-28", "once");
    expect(draft.startsOn).toBe(draft.endsOn);
    expect(draft.allowRepeat).toBe(false);
    expect(
      draft.activities.every(
        (activity) =>
          activity.time === null &&
          activity.minutes === null &&
          activity.intensity === "",
      ),
    ).toBe(true);
  }
});

test("selected and personalized activities create independent once goals across a month boundary, without future performance", async () => {
  const { store, advance, reopen } = await setup("2026-10-30");
  const draft = input({ startsOn: "2026-10-30", endsOn: "2026-11-02" });
  draft.activities = [
    {
      ...draft.activities[0],
      title: "Minha prioridade",
      description: "Um passo pequeno",
      category: "Trabalho",
      time: "08:30",
      minutes: 15,
      intensity: "Com calma",
    },
    draft.activities[2],
  ];
  const result = store.startRoutine(draft);
  expect(result.goals).toHaveLength(8);
  expect(result.occurrences).toHaveLength(2);
  expect(new Set(result.goals.map((goal) => goal.id)).size).toBe(8);
  expect(
    result.goals.every(
      (goal) =>
        goal.frequency === "once" &&
        goal.routineId === "ilia" &&
        goal.routineRunId === result.routineRuns![0].id,
    ),
  ).toBe(true);
  expect(goalsOn(result, "2026-10-30", "2026-10-30")[0]).toMatchObject({
    title: "Minha prioridade",
    category: "Trabalho",
    routineActivity: { time: "08:30", minutes: 15, intensity: "Com calma" },
  });
  expect(
    routineProgress(result, result.routineRuns![0], "2026-10-30"),
  ).toMatchObject({
    planned: 8,
    total: 2,
    future: 6,
    partial: true,
    percent: 0,
  });
  expect(() =>
    store.setStatus(result.goals[1].id, "2026-10-31", "done"),
  ).toThrow();
  advance("2026-11-03");
  expect(store.snapshot().occurrences).toHaveLength(8);
  const before = store.snapshot();
  store.close();
  const restored = await reopen();
  expect(restored.snapshot()).toEqual(before);
  restored.close();
});

test("future experiences stay without a score and materialize only on their own dates", async () => {
  const { store, advance } = await setup();
  try {
    const result = store.startRoutine(
      input({ startsOn: "2026-11-01", endsOn: "2026-11-02" }),
    );
    expect(result.occurrences).toHaveLength(0);
    expect(
      routineProgress(result, result.routineRuns![0], "2026-10-28"),
    ).toMatchObject({ percent: null, total: 0, future: 8, isFuture: true });
    expect(dailySummary(result, "2026-11-01", "2026-10-28").percent).toBeNull();
    advance("2026-11-01");
    expect(store.snapshot().occurrences).toHaveLength(4);
    advance("2026-11-03");
    expect(store.snapshot().occurrences).toHaveLength(8);
    expect(goalsOn(store.snapshot(), "2026-11-03", "2026-11-03")).toHaveLength(
      0,
    );
  } finally {
    store.close();
  }
});

test("operation retries are idempotent even across reopening and catalog version changes; changed payload is refused", async () => {
  const { store, reopen, file } = await setup();
  const draft = input();
  const before = store.startRoutine(draft);
  const bytes = readFileSync(file);
  expect(store.startRoutine(structuredClone(draft))).toEqual(before);
  expect(readFileSync(file)).toEqual(bytes);
  expect(() =>
    store.startRoutine({
      ...draft,
      activities: [{ ...draft.activities[0], title: "Outra" }],
    }),
  ).toThrow("outras escolhas");
  store.close();
  const saved = { ...routines[0] };
  try {
    routines[0].version = 2;
    routines[0].name = "Nome atualizado no catálogo";
    routines[0].sourceUrl = "https://example.com/nova-fonte";
    routines[0].goals = [
      { ...routines[0].goals[0], title: "Um modelo diferente" },
    ];
    const restored = await reopen();
    try {
      expect(restored.startRoutine(draft)).toEqual(before);
      expect(restored.snapshot().routineRuns![0]).toMatchObject({
        name: saved.name,
        templateVersion: 1,
        sourceUrl: saved.sourceUrl,
      });
    } finally {
      restored.close();
    }
  } finally {
    Object.assign(routines[0], saved);
  }
});

test("overlapping dates require explicit repeat and the second experience has separate goals and outcomes", async () => {
  const { store } = await setup();
  try {
    const first = store.startRoutine(input()).routineRuns![0];
    const repeat = input({ operationKey: "second" });
    expect(() => store.startRoutine(repeat)).toThrow("Confirme");
    const result = store.startRoutine({ ...repeat, allowRepeat: true });
    const second = result.routineRuns![1];
    store.setStatus(first.activities[0].goals[0].id, "2026-10-28", "done");
    expect(routineProgress(store.snapshot(), first, "2026-10-28").done).toBe(1);
    expect(routineProgress(store.snapshot(), second, "2026-10-28").done).toBe(
      0,
    );
    expect(store.snapshot().goals).toHaveLength(8);
    expect(
      store.startRoutine({ ...repeat, allowRepeat: true }).routineRuns,
    ).toHaveLength(2);
  } finally {
    store.close();
  }
});

test("rest applies to copied goals and is excluded from the experiment denominator while future dates remain separate", async () => {
  const { store, advance } = await setup();
  try {
    store.planRest("2026-10-28", "Descanso de hoje");
    store.planRest("2026-10-29", "Folga de amanhã");
    const result = store.startRoutine(input({ endsOn: "2026-10-30" }));
    const run = result.routineRuns![0];
    expect(
      result.occurrences!.every((item) => item.disposition === "rest"),
    ).toBe(true);
    expect(routineProgress(result, run, "2026-10-28")).toMatchObject({
      planned: 12,
      total: 0,
      percent: null,
      rest: 8,
      future: 4,
      removed: 0,
    });
    store.removeRest("2026-10-28");
    store.setStatus(run.activities[0].goals[0].id, "2026-10-28", "done");
    advance("2026-10-30");
    const report = routineProgress(store.snapshot(), run, "2026-10-30");
    expect(report).toMatchObject({
      total: 8,
      done: 1,
      rest: 4,
      future: 0,
      percent: 13,
    });
    expect(
      rangeSummary(store.snapshot(), run.startsOn, run.endsOn, "2026-10-30")
        .daily,
    ).toMatchObject({ total: 8, done: 1, percent: 13 });
  } finally {
    store.close();
  }
});

test("malformed IPC inputs are refused before saving any experience or goal", async () => {
  const { store, file } = await setup();
  try {
    const draft = input();
    const badActivity = (change: object) => ({
      ...draft,
      activities: [{ ...draft.activities[0], ...change }],
    });
    const invalid = [
      null,
      {},
      { ...draft, operationKey: 3 },
      { ...draft, templateId: "unknown" },
      { ...draft, templateVersion: 99 },
      { ...draft, activities: [] },
      { ...draft, activities: [draft.activities[0], draft.activities[0]] },
      badActivity({ activityId: "unknown" }),
      badActivity({ title: " " }),
      badActivity({ title: "x".repeat(101) }),
      badActivity({ description: "x".repeat(501) }),
      badActivity({ category: "Outra" }),
      badActivity({ minutes: 0 }),
      badActivity({ minutes: 1.5 }),
      badActivity({ minutes: 1441 }),
      badActivity({ time: "24:00" }),
      badActivity({ time: 9 }),
      badActivity({ intensity: "x".repeat(121) }),
      { ...draft, startsOn: "2026-10-27" },
      { ...draft, endsOn: "2026-02-30" },
      { ...draft, endsOn: "2026-12-01" },
      { ...draft, allowRepeat: "true" },
    ];
    const bytes = readFileSync(file);
    for (const value of invalid)
      expect(() => store.startRoutine(value as never)).toThrow();
    expect(store.snapshot().goals).toHaveLength(0);
    expect(store.snapshot().routineRuns).toHaveLength(0);
    expect(readFileSync(file)).toEqual(bytes);
    expect(normalizeRoutineInput(draft)).toEqual(draft);
  } finally {
    store.close();
  }
});

test("a failed atomic save rolls back both copied goals and the operation key; retry creates a single full experience", async () => {
  const { store, file } = await setup();
  try {
    const bytes = readFileSync(file);
    mkdirSync(`${file}.tmp`);
    expect(() => store.startRoutine(input())).toThrow();
    expect(store.snapshot().routineRuns).toHaveLength(0);
    expect(store.snapshot().goals).toHaveLength(0);
    expect(readFileSync(file)).toEqual(bytes);
    rmdirSync(`${file}.tmp`);
    expect(store.startRoutine(input()).goals).toHaveLength(4);
    expect(store.startRoutine(input()).routineRuns).toHaveLength(1);
  } finally {
    store.close();
  }
});

test("v2 upgrades additively with exact rollback bytes, preserving every old table and showing legacy routines without an invented version", async () => {
  const { file, dir, bytes, original, tables, SQL, snapshot } =
    await v2Fixture();
  const store = await SkyDatabase.open(file, wasm, {
    now: () => parseDate("2026-10-28"),
  });
  try {
    const result = store.snapshot();
    expect(result).toEqual(snapshot);
    expect(result.routineRuns).toEqual([]);
    expect(
      result.goals.find((goal) => goal.title === "Rotina anterior"),
    ).toMatchObject({ routineId: "ilia" });
    expect(
      result.goals.find((goal) => goal.title === "Rotina anterior")!
        .routineRunId,
    ).toBeUndefined();
    const reopened = new SQL.Database(readFileSync(file));
    try {
      expect(
        tables.map((table) =>
          rows(reopened, `SELECT * FROM ${table} ORDER BY rowid`),
        ),
      ).toEqual(original);
      expect(reopened.exec("PRAGMA user_version")[0].values[0][0]).toBe(4);
      expect(
        rows(
          reopened,
          "SELECT version FROM schema_migrations ORDER BY version",
        ),
      ).toEqual([{ version: 2 }, { version: 3 }, { version: 4 }]);
    } finally {
      reopened.close();
    }
    const backup = readdirSync(dir).filter((name) => name.includes(".pre-v3-"));
    expect(backup).toHaveLength(1);
    expect(readFileSync(join(dir, backup[0]))).toEqual(Buffer.from(bytes));
  } finally {
    store.close();
  }
  const again = await SkyDatabase.open(file, wasm, {
    now: () => parseDate("2026-10-28"),
  });
  again.close();
  expect(
    readdirSync(dir).filter((name) => name.includes(".pre-v3-")),
  ).toHaveLength(1);
});

test("v2 migration failure and invalid old checksum preserve the original; a valid retry upgrades once", async () => {
  const { file, bytes, SQL } = await v2Fixture();
  mkdirSync(`${file}.tmp`);
  await expect(
    SkyDatabase.open(file, wasm, { now: () => parseDate("2026-10-28") }),
  ).rejects.toThrow();
  expect(readFileSync(file)).toEqual(Buffer.from(bytes));
  rmdirSync(`${file}.tmp`);
  const bad = new SQL.Database(bytes);
  bad.run("UPDATE schema_migrations SET checksum = 'invalid'");
  const corrupt = sqliteBytes(bad);
  bad.close();
  writeFileSync(file, corrupt);
  await expect(SkyDatabase.open(file, wasm)).rejects.toThrow("migração");
  expect(readFileSync(file)).toEqual(Buffer.from(corrupt));
  writeFileSync(file, bytes);
  const restored = await SkyDatabase.open(file, wasm, {
    now: () => parseDate("2026-10-28"),
  });
  expect(restored.snapshot().schemaVersion).toBe(4);
  restored.close();
});

test("legacy dates also require repeat confirmation, while versioned copies keep independent metadata", async () => {
  const { file } = await v2Fixture();
  const store = await SkyDatabase.open(file, wasm, {
    now: () => parseDate("2026-10-26"),
  });
  try {
    const draft = input({ startsOn: "2026-10-26", endsOn: "2026-10-26" });
    expect(() => store.startRoutine(draft)).toThrow("Confirme");
    expect(
      store.startRoutine({ ...draft, allowRepeat: true }).routineRuns,
    ).toHaveLength(1);
  } finally {
    store.close();
  }
});

test("importing v2 upgrades before replacing and preserves the active v3 experiences in the rollback file", async () => {
  const legacy = await v2Fixture();
  const { store, file } = await setup();
  try {
    const original = store.startRoutine(input());
    const originalBytes = store.exportBytes();
    const restored = await store.importBytes(legacy.bytes);
    expect(restored.schemaVersion).toBe(4);
    expect(restored.routineRuns).toEqual([]);
    expect(restored.entries).toEqual(legacy.snapshot.entries);
    expect(readFileSync(`${file}.bak`)).toEqual(Buffer.from(originalBytes));
    expect(await store.importBytes(originalBytes)).toEqual(original);
  } finally {
    store.close();
  }
});

test("tampered experience backups with invalid schedules, relationships or source URLs are refused without replacing active data", async () => {
  const { store, file } = await setup();
  try {
    const snapshot = store.startRoutine(input());
    const source = store.exportBytes();
    const before = readFileSync(file);
    const SQL = await initSqlJs({ locateFile: () => wasm });
    for (const kind of [
      "json",
      "schedule",
      "relationship",
      "source",
      "request",
    ]) {
      const db = new SQL.Database(source);
      const activities = structuredClone(snapshot.routineRuns![0].activities);
      if (kind === "json")
        db.run("UPDATE routine_runs SET activities_snapshot_json = 'not json'");
      if (kind === "source")
        db.run(
          "UPDATE routine_runs SET source_url_snapshot = 'javascript:alert(1)'",
        );
      if (kind === "request")
        db.run("UPDATE routine_runs SET request_json = '{}' ");
      if (kind === "schedule") {
        activities[0].minutes = -1;
        db.run("UPDATE routine_runs SET activities_snapshot_json = ?", [
          JSON.stringify(activities),
        ]);
      }
      if (kind === "relationship") {
        activities[0].goals[0].id = activities[1].goals[0].id;
        db.run("UPDATE routine_runs SET activities_snapshot_json = ?", [
          JSON.stringify(activities),
        ]);
      }
      const bytes = sqliteBytes(db);
      db.close();
      await expect(store.importBytes(bytes)).rejects.toThrow();
      expect(store.snapshot()).toEqual(snapshot);
      expect(readFileSync(file)).toEqual(before);
    }
  } finally {
    store.close();
  }
});

test("deleting an unevaluated copied goal preserves original choices; assessed goals retain the existing history protection", async () => {
  const { store, reopen } = await setup();
  const run = store.startRoutine(input()).routineRuns![0];
  store.deleteGoal(run.activities[0].goals[0].id);
  store.setStatus(run.activities[1].goals[0].id, "2026-10-28", "done");
  expect(() => store.deleteGoal(run.activities[1].goals[0].id)).toThrow();
  expect(routineProgress(store.snapshot(), run, "2026-10-28")).toMatchObject({
    total: 3,
    done: 1,
    removed: 1,
    percent: 33,
  });
  const before = store.snapshot();
  expect(before.routineRuns![0]).toEqual(run);
  store.close();
  const restored = await reopen();
  expect(restored.snapshot()).toEqual(before);
  restored.close();
});
