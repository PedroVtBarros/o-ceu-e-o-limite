import { createHash, randomUUID } from "node:crypto";
import type { Database, SqlJsStatic } from "sql.js";
import { isValidDate, weekStart } from "../../shared/domain";
import { schemaV2, schemaV3, schemaV4, SCHEMA_VERSION } from "./schema";
import { rows, versionOf } from "./sql";
import {
  validateId,
  validateInput,
  validateIntegrity,
  validateV2,
  validateDatabase,
} from "./validation";
import { insertOccurrence, materialize, type RevisionRow } from "./materialize";

export const schemaChecksum = createHash("sha256")
  .update(schemaV2)
  .digest("hex");

export const routineSchemaChecksum = createHash("sha256")
  .update(schemaV3)
  .digest("hex");

export const personalSchemaChecksum = createHash("sha256")
  .update(schemaV4)
  .digest("hex");

export function newDatabase(
  SQL: SqlJsStatic,
  now: string,
  version: 2 | 3 | 4 = SCHEMA_VERSION,
): Database {
  const db = new SQL.Database();
  db.run(schemaV2);
  db.run("INSERT INTO schema_migrations VALUES (?, ?, ?, ?)", [
    2,
    "versioned-goals-and-occurrences",
    schemaChecksum,
    now,
  ]);
  if (version >= 3) applyV3(db, now);
  if (version >= 4) applyV4(db, now);
  db.run(`PRAGMA user_version = ${version}`);
  return db;
}

function applyV3(db: Database, now: string) {
  db.run(schemaV3);
  db.run("INSERT INTO schema_migrations VALUES (3, ?, ?, ?)", [
    "versioned-routine-experiences",
    routineSchemaChecksum,
    now,
  ]);
  db.run("PRAGMA user_version = 3");
}

function applyV4(db: Database, now: string) {
  db.run(schemaV4);
  db.run("INSERT INTO personal_preferences VALUES (1, 'violet', 1, ?)", [now]);
  db.run("INSERT INTO schema_migrations VALUES (4, ?, ?, ?)", [
    "personal-goals-and-preferences",
    personalSchemaChecksum,
    now,
  ]);
  db.run("PRAGMA user_version = 4");
}

export function migrateV3(
  SQL: SqlJsStatic,
  source: Database,
  now: string,
): Database {
  if (versionOf(source) !== 3)
    throw new Error("Versão de origem incompatível com a personalização.");
  validateDatabase(source);
  const bytes = source.export();
  source.run("PRAGMA foreign_keys = ON");
  const target = new SQL.Database(bytes);
  try {
    target.run("BEGIN");
    applyV4(target, now);
    target.run("COMMIT");
    validateDatabase(target);
    for (const table of [
      "goals",
      "goal_revisions",
      "goal_occurrences",
      "occurrence_events",
      "day_plans",
      "routine_runs",
    ]) {
      if (
        JSON.stringify(
          rows(source, `SELECT * FROM ${table} ORDER BY rowid`),
        ) !==
        JSON.stringify(rows(target, `SELECT * FROM ${table} ORDER BY rowid`))
      )
        throw new Error("A personalização alterou o histórico anterior.");
    }
    return target;
  } catch (error) {
    target.close();
    throw error;
  }
}

// The caller owns source throughout. Intermediate copies are closed here; the
// final candidate is returned for write/reopen validation before replacing disk.
export function upgradeToCurrent(
  SQL: SqlJsStatic,
  source: Database,
  today: string,
  now: string,
  timezone: string,
): Database {
  let current = source;
  try {
    while (versionOf(current) !== SCHEMA_VERSION) {
      const version = versionOf(current);
      if (![1, 2, 3].includes(version))
        throw new Error("Versão de origem incompatível com a atualização.");
      const next =
        version === 1
          ? migrateV1(SQL, current, today, now, timezone)
          : version === 2
            ? migrateV2(SQL, current, now)
            : migrateV3(SQL, current, now);
      if (current !== source) current.close();
      current = next;
    }
    return current;
  } catch (error) {
    if (current !== source) current.close();
    throw error;
  }
}

export function migrateV2(
  SQL: SqlJsStatic,
  source: Database,
  now: string,
): Database {
  validateV2(source);
  const bytes = source.export();
  source.run("PRAGMA foreign_keys = ON");
  const target = new SQL.Database(bytes);
  try {
    target.run("BEGIN");
    applyV3(target, now);
    target.run("COMMIT");
    validateDatabase(target);
    for (const table of [
      "goals",
      "goal_revisions",
      "goal_occurrences",
      "occurrence_events",
      "day_plans",
    ]) {
      if (
        JSON.stringify(
          rows(source, `SELECT * FROM ${table} ORDER BY rowid`),
        ) !==
        JSON.stringify(rows(target, `SELECT * FROM ${table} ORDER BY rowid`))
      )
        throw new Error("A atualização alterou o histórico original.");
    }
    return target;
  } catch (error) {
    target.close();
    throw error;
  }
}

export function migrateV1(
  SQL: SqlJsStatic,
  source: Database,
  today: string,
  now: string,
  timezone: string,
): Database {
  if (versionOf(source) !== 1)
    throw new Error("Versão de origem incompatível com a migração.");
  validateIntegrity(source);
  const goals = rows<any>(
    source,
    "SELECT id, title, description, category, frequency, start_date, archived_on, routine_id FROM goals ORDER BY rowid",
  );
  const entries = rows<any>(
    source,
    "SELECT goal_id, period, status FROM entries",
  );
  const target = newDatabase(SQL, now, 2);
  try {
    target.run("BEGIN");
    for (const goal of goals) {
      validateId(goal.id);
      validateInput({
        title: goal.title,
        description: goal.description,
        category: goal.category,
        frequency: goal.frequency,
        startDate: goal.start_date,
        routineId: goal.routine_id ?? undefined,
      });
      if (
        goal.start_date > today ||
        (goal.archived_on !== null &&
          (!isValidDate(goal.archived_on) ||
            goal.archived_on < goal.start_date))
      )
        throw new Error("O banco antigo contém uma data inválida.");
      target.run("INSERT INTO goals VALUES (?, ?, ?, ?, ?)", [
        goal.id,
        now,
        goal.archived_on,
        goal.routine_id ? "routine" : "personal",
        goal.routine_id,
      ]);
      target.run(
        "INSERT INTO goal_revisions VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, NULL, ?)",
        [
          randomUUID(),
          goal.id,
          goal.title,
          goal.description,
          goal.category,
          goal.frequency,
          goal.frequency === "daily" ? 127 : 0,
          goal.start_date,
          now,
        ],
      );
    }
    materialize(target, today, now, timezone);
    for (const entry of entries) {
      const goal = goals.find((goal) => goal.id === entry.goal_id);
      if (
        !goal ||
        !isValidDate(entry.period) ||
        entry.period > today ||
        !["done", "missed"].includes(entry.status)
      )
        throw new Error("O banco antigo contém um resultado inválido.");
      const weekly = goal.frequency === "weekly";
      if (
        (weekly && weekStart(entry.period) !== entry.period) ||
        entry.period <
          (weekly ? weekStart(goal.start_date) : goal.start_date) ||
        (goal.frequency === "once" && goal.start_date !== entry.period) ||
        (goal.archived_on &&
          entry.period >
            (weekly ? weekStart(goal.archived_on) : goal.archived_on))
      )
        throw new Error("O banco antigo contém um resultado fora da vigência.");
      const kind = weekly ? "week" : "day";
      const existing = rows(
        target,
        "SELECT id FROM goal_occurrences WHERE goal_id = ? AND period_kind = ? AND period_start = ?",
        [goal.id, kind, entry.period],
      );
      if (!existing.length) {
        const revision = rows<RevisionRow>(
          target,
          "SELECT r.*, g.archived_from, g.origin_reference FROM goal_revisions r JOIN goals g ON g.id = r.goal_id WHERE r.goal_id = ?",
          [goal.id],
        )[0];
        insertOccurrence(
          target,
          revision,
          entry.period,
          entry.period < goal.start_date ? goal.start_date : entry.period,
          now,
          timezone,
        );
      }
      // v1 did not record the completion time. Do not invent one during migration.
      target.run(
        "UPDATE goal_occurrences SET status = ?, recorded_at = NULL WHERE goal_id = ? AND period_kind = ? AND period_start = ?",
        [entry.status, goal.id, kind, entry.period],
      );
    }
    target.run("COMMIT");
    validateV2(target);
    const migratedResults = rows(
      target,
      "SELECT id FROM goal_occurrences WHERE status != 'pending'",
    ).length;
    if (
      rows(target, "SELECT id FROM goals").length !== goals.length ||
      migratedResults !== entries.length
    )
      throw new Error(
        "A conferência da migração encontrou uma diferença nos registros.",
      );
    return target;
  } catch (error) {
    target.close();
    throw error;
  }
}
