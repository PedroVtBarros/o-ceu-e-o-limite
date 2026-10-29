import { test, expect } from "vitest";
import initSqlJs from "sql.js";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { SkyDatabase } from "../electron/database";
import { goalsOn, opportunities } from "../shared/domain";
import { legacyFixture, wasm } from "./legacy-fixture";
import { sqliteBytes } from "../electron/storage/files";

const fixedNow = () => new Date("2026-10-28T12:00:00-03:00");
const root = resolve(".test-data");
mkdirSync(root, { recursive: true });
const location = () => {
  const dir = mkdtempSync(join(root, "migration-"));
  return { dir, file: join(dir, "sky.sqlite") };
};
async function inspect(bytes: Uint8Array, sql: string) {
  const SQL = await initSqlJs({ locateFile: () => wasm });
  const db = new SQL.Database(bytes);
  try {
    return db.exec(sql);
  } finally {
    db.close();
  }
}

test("v1 migrates with exact rollback backup, archived-day result, routine origin and one weekly occurrence", async () => {
  const { dir, file } = location();
  const bytes = await legacyFixture();
  writeFileSync(file, bytes);
  const store = await SkyDatabase.open(file, wasm, { now: fixedNow });
  const snapshot = store.snapshot();
  expect(snapshot.schemaVersion).toBe(4);
  expect(snapshot.goals).toHaveLength(4);
  expect(snapshot.entries).toHaveLength(4);
  expect(
    snapshot.occurrences!.filter((item) => item.goalId === "weekly"),
  ).toHaveLength(1);
  expect(
    snapshot.occurrences!.find((item) => item.goalId === "weekly")!
      .eligibleFrom,
  ).toBe("2026-10-28");
  expect(
    goalsOn(snapshot, "2026-10-26").some((goal) => goal.id === "weekly"),
  ).toBe(false);
  expect(
    snapshot.occurrences!.find(
      (item) => item.goalId === "archived" && item.periodStart === "2026-10-27",
    ),
  ).toMatchObject({
    status: "done",
    title: "Caminhar",
    category: "Saúde",
    disposition: "scheduled",
    recordedAt: null,
  });
  expect(snapshot.goals.find((goal) => goal.id === "once")!.routineId).toBe(
    "ilia",
  );
  const backupName = readdirSync(dir).find((name) =>
    name.includes(".pre-v2-"),
  )!;
  expect(Buffer.from(readFileSync(join(dir, backupName)))).toEqual(
    Buffer.from(bytes),
  );
  store.close();
  const reopened = await SkyDatabase.open(file, wasm, { now: fixedNow });
  expect(reopened.snapshot()).toEqual(snapshot);
  expect(
    readdirSync(dir).filter((name) => name.includes(".pre-v2-")),
  ).toHaveLength(1);
  expect(
    (
      await inspect(
        reopened.exportBytes(),
        "SELECT count(*) FROM schema_migrations",
      )
    )[0].values[0][0],
  ).toBe(3);
  reopened.close();
});

test("migration failure preserves original bytes, then retry is idempotent", async () => {
  const { file } = location();
  const bytes = await legacyFixture();
  writeFileSync(file, bytes);
  mkdirSync(`${file}.tmp`);
  await expect(
    SkyDatabase.open(file, wasm, { now: fixedNow }),
  ).rejects.toThrow();
  expect(readFileSync(file)).toEqual(Buffer.from(bytes));
  rmdirSync(`${file}.tmp`);
  const store = await SkyDatabase.open(file, wasm, { now: fixedNow });
  expect(store.snapshot().goals).toHaveLength(4);
  expect(store.snapshot().entries).toHaveLength(4);
  const before = store.snapshot();
  expect(store.load()).toEqual(before);
  expect(store.load()).toEqual(before);
  store.close();
});

test("unrecognized, corrupt and future database files are refused without overwriting them", async () => {
  const SQL = await initSqlJs({ locateFile: () => wasm });
  for (const kind of ["future", "unknown", "corrupt", "empty"]) {
    const { file } = location();
    const db = new SQL.Database();
    if (kind === "future") db.run("PRAGMA user_version = 99");
    const bytes =
      kind === "corrupt"
        ? Buffer.from("invalid SQLite file")
        : kind === "empty"
          ? new Uint8Array()
          : db.export();
    db.close();
    writeFileSync(file, bytes);
    await expect(
      SkyDatabase.open(file, wasm, { now: fixedNow }),
    ).rejects.toThrow();
    expect(readFileSync(file)).toEqual(Buffer.from(bytes));
  }
});

test("new revisions preserve past copies and become visible only at the next daily boundary", async () => {
  const { file } = location();
  let instant = new Date("2026-10-26T12:00:00-03:00");
  const store = await SkyDatabase.open(file, wasm, { now: () => instant });
  const id = store.createGoal({
    title: "Ler 10 páginas",
    description: "",
    category: "Estudos",
    frequency: "daily",
    startDate: "2026-10-26",
  }).goals[0].id;
  instant = fixedNow();
  store.setStatus(id, "2026-10-26", "done");
  const previous = store.snapshot().occurrences;
  const result = store.updateGoal(id, {
    title: "Praticar escrita",
    description: "Um novo passo",
    category: "Pessoal",
  });
  expect(result.occurrences).toEqual(previous);
  expect(result.goals[0].nextRevision).toMatchObject({
    title: "Praticar escrita",
    effectiveFrom: "2026-10-29",
  });
  expect(goalsOn(result, "2026-10-26")[0].title).toBe("Ler 10 páginas");
  expect(
    opportunities(result, "2026-10-26", "2026-10-28").filter(
      (item) => item.goal.category === "Estudos",
    ),
  ).toHaveLength(3);
  instant = new Date("2026-10-29T12:00:00-03:00");
  const next = store.load();
  expect(goalsOn(next, "2026-10-29")[0]).toMatchObject({
    title: "Praticar escrita",
    category: "Pessoal",
  });
  expect(goalsOn(next, "2026-10-26")[0]).toMatchObject({
    title: "Ler 10 páginas",
    category: "Estudos",
  });
  expect(next.occurrences!.slice(0, 3)).toEqual(previous);
  store.close();
});

test("weekly edits start next Monday and old results keep their labels and category", async () => {
  const { file } = location();
  const store = await SkyDatabase.open(file, wasm, { now: fixedNow });
  const id = store.createGoal({
    title: "Planejar",
    description: "",
    category: "Trabalho",
    frequency: "weekly",
    startDate: "2026-10-28",
  }).goals[0].id;
  store.setStatus(id, "2026-10-28", "done");
  const state = store.updateGoal(id, {
    title: "Revisar",
    description: "",
    category: "Pessoal",
  });
  expect(state.goals[0].nextRevision?.effectiveFrom).toBe("2026-11-02");
  expect(state.occurrences![0]).toMatchObject({
    title: "Planejar",
    category: "Trabalho",
    status: "done",
  });
  store.close();
});

test("result changes preserve an occurrence and an audit trail; unchanged status adds no event", async () => {
  const { file } = location();
  const store = await SkyDatabase.open(file, wasm, { now: fixedNow });
  const id = store.createGoal({
    title: "Ler",
    description: "",
    category: "Estudos",
    frequency: "daily",
    startDate: "2026-10-28",
  }).goals[0].id;
  store.setStatus(id, "2026-10-28", "done");
  store.setStatus(id, "2026-10-28", "done");
  store.setStatus(id, "2026-10-28", "pending");
  expect(store.snapshot().entries).toHaveLength(0);
  expect(store.snapshot().occurrences).toHaveLength(1);
  expect(
    (
      await inspect(
        store.exportBytes(),
        "SELECT count(*) FROM occurrence_events",
      )
    )[0].values[0][0],
  ).toBe(2);
  store.close();
});

test("restoring v1 migrates safely; failed or incompatible restores preserve active memory and disk", async () => {
  const { file } = location();
  const store = await SkyDatabase.open(file, wasm, { now: fixedNow });
  const before = store.snapshot();
  const bytes = readFileSync(file);
  mkdirSync(`${file}.tmp`);
  await expect(store.importBytes(await legacyFixture())).rejects.toThrow();
  expect(store.snapshot()).toEqual(before);
  expect(readFileSync(file)).toEqual(bytes);
  rmdirSync(`${file}.tmp`);
  const SQL = await initSqlJs({ locateFile: () => wasm });
  const future = new SQL.Database();
  future.run("PRAGMA user_version = 99");
  await expect(store.importBytes(future.export())).rejects.toThrow(
    "incompatível",
  );
  future.close();
  expect(readFileSync(file)).toEqual(bytes);
  const imported = await store.importBytes(await legacyFixture());
  expect(imported.schemaVersion).toBe(4);
  expect(imported.entries).toHaveLength(4);
  expect(readFileSync(`${file}.bak`)).toEqual(bytes);
  store.close();
  const reopened = await SkyDatabase.open(file, wasm, { now: fixedNow });
  expect(reopened.snapshot()).toEqual(imported);
  reopened.close();
});

test("IPC-facing operations reject malformed runtime values without changing the bank", async () => {
  const { file } = location();
  const store = await SkyDatabase.open(file, wasm, { now: fixedNow });
  const before = readFileSync(file);
  expect(() => store.createGoal(null as never)).toThrow();
  expect(() =>
    store.createGoal({
      title: "x",
      description: "",
      category: "invalid",
      frequency: "daily",
      startDate: "2026-10-28",
    } as never),
  ).toThrow();
  expect(() => store.setStatus({} as never, "2026-10-28", "done")).toThrow();
  expect(() => store.addRoutine("ilia", "2026-02-30")).toThrow();
  expect(readFileSync(file)).toEqual(before);
  store.close();
});

test("a pending no-op after midnight still persists newly materialized occurrences", async () => {
  const { file } = location();
  let instant = fixedNow();
  const store = await SkyDatabase.open(file, wasm, { now: () => instant });
  const id = store.createGoal({
    title: "Ler",
    description: "",
    category: "Estudos",
    frequency: "daily",
    startDate: "2026-10-28",
  }).goals[0].id;
  instant = new Date("2026-10-29T12:00:00-03:00");
  const state = store.setStatus(id, "2026-10-29", "pending");
  expect(state.occurrences).toHaveLength(2);
  store.close();
  const reopened = await SkyDatabase.open(file, wasm, { now: () => instant });
  expect(reopened.snapshot()).toEqual(state);
  reopened.close();
});

test("export keeps foreign-key enforcement active on the live sql.js connection", async () => {
  const SQL = await initSqlJs({ locateFile: () => wasm });
  const db = new SQL.Database();
  db.run(
    "CREATE TABLE parents (id TEXT PRIMARY KEY); CREATE TABLE children (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parents(id)); PRAGMA foreign_keys = ON;",
  );
  sqliteBytes(db);
  expect(() =>
    db.run("INSERT INTO children VALUES ('child', 'missing')"),
  ).toThrow("FOREIGN KEY");
  db.close();
});
