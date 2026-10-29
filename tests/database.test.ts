import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { SkyDatabase } from "../electron/database";
import { dateKey, parseDate, shiftDate, weekStart } from "../shared/domain";
import type { GoalInput } from "../shared/types";

const wasm = resolve("node_modules/sql.js/dist/sql-wasm.wasm");
const root = resolve(".test-data");
mkdirSync(root, { recursive: true });
const input = (overrides: Partial<GoalInput> = {}): GoalInput => ({
  title: "Ler um capítulo",
  description: "Meu próximo passo",
  category: "Estudos",
  frequency: "daily",
  startDate: dateKey(),
  ...overrides,
});
async function createStore(day = dateKey()) {
  const dir = mkdtempSync(join(root, "database-"));
  const file = join(dir, "sky.sqlite");
  let instant = parseDate(day);
  return {
    dir,
    file,
    store: await SkyDatabase.open(file, wasm, { now: () => instant }),
    advance: (date: string) => {
      instant = parseDate(date);
    },
  };
}
test("SQLite preserves goals and statuses after closing and reopening the database", async () => {
  const { file, store } = await createStore();
  const created = store.createGoal(input());
  const id = created.goals[0].id;
  store.setStatus(id, dateKey(), "done");
  store.close();
  assert.equal(
    readFileSync(file).subarray(0, 15).toString(),
    "SQLite format 3",
  );
  const reopened = await SkyDatabase.open(file, wasm);
  assert.equal(reopened.snapshot().goals[0].title, "Ler um capítulo");
  assert.deepEqual(reopened.snapshot().entries, [
    { goalId: id, period: dateKey(), status: "done" },
  ]);
  reopened.close();
});
test("weekly status upserts one row; pending removes the recorded result", async () => {
  const { store, advance } = await createStore(weekStart(dateKey()));
  const id = store.createGoal(
    input({ frequency: "weekly", startDate: weekStart(dateKey()) }),
  ).goals[0].id;
  store.setStatus(id, weekStart(dateKey()), "done");
  advance(dateKey());
  store.setStatus(id, dateKey(), "missed");
  assert.equal(store.snapshot().entries.length, 1);
  assert.equal(store.snapshot().entries[0].status, "missed");
  store.setStatus(id, dateKey(), "pending");
  assert.equal(store.snapshot().entries.length, 0);
  store.close();
});
test("archive preserves past records; validation rejects future, invalid and unscheduled writes", async () => {
  const { store, advance } = await createStore(shiftDate(dateKey(), -1));
  const id = store.createGoal(input({ startDate: shiftDate(dateKey(), -1) }))
    .goals[0].id;
  store.setStatus(id, shiftDate(dateKey(), -1), "done");
  advance(dateKey());
  store.archiveGoal(id);
  assert.equal(store.snapshot().entries.length, 1);
  assert.throws(() => store.setStatus(id, dateKey(), "done"));
  assert.throws(() => store.setStatus(id, "2026-02-30", "done"));
  assert.throws(() =>
    store.createGoal(input({ startDate: shiftDate(dateKey(), -1) })),
  );
  assert.throws(() => store.createGoal(input({ title: " " })));
  store.close();
});
test("routine is inserted atomically and cannot be added twice on the same day", async () => {
  const { store } = await createStore();
  const state = store.addRoutine("ilia", dateKey());
  assert.equal(state.goals.length, 4);
  assert.ok(
    state.goals.every(
      (goal) => goal.frequency === "once" && goal.startDate === dateKey(),
    ),
  );
  assert.throws(() => store.addRoutine("ilia", dateKey()));
  assert.equal(store.snapshot().goals.length, 4);
  assert.throws(() => store.addRoutine("unknown", dateKey()));
  store.close();
});
test("backup restore validates before replacing and preserves the previous file as a backup", async () => {
  const { store, file } = await createStore();
  store.createGoal(input());
  const bytes = store.exportBytes();
  store.createGoal(input({ title: "Meta posterior" }));
  const restored = await store.importBytes(bytes, wasm);
  assert.equal(restored.goals.length, 1);
  assert.ok(readFileSync(`${file}.bak`).length > 0);
  await assert.rejects(store.importBytes(new Uint8Array([1, 2, 3]), wasm));
  assert.equal(store.snapshot().goals.length, 1);
  store.close();
});
test("failed filesystem writes roll memory back instead of showing unsaved changes as saved", async () => {
  const { store, file } = await createStore();
  mkdirSync(`${file}.tmp`);
  assert.throws(() => store.createGoal(input()));
  assert.equal(store.snapshot().goals.length, 0);
  store.close();
  rmdirSync(`${file}.tmp`);
  const reopened = await SkyDatabase.open(file, wasm);
  assert.equal(reopened.snapshot().goals.length, 0);
  reopened.close();
});
