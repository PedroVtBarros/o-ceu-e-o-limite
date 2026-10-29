import type { Database } from "sql.js";
import { createHash } from "node:crypto";
import {
  categories,
  type GoalInput,
  type RoutineRun,
} from "../../shared/types";
import {
  normalizeRoutineInput,
  routineDates,
  validateActivity,
} from "../../shared/routineRuns";
import { isValidDate, shiftDate, weekStart } from "../../shared/domain";
import { rows, versionOf } from "./sql";
import { schemaV2, schemaV3, schemaV4 } from "./schema";
import {
  normalizeLongTermInput,
  validateLongTermFields,
  validatePreferences,
} from "../../shared/personalization";
import { readPersonalization } from "./personalization";
import { readRoutineRuns } from "./routineRuns";

const fail = (message = "O banco de dados contém registros inválidos.") => {
  throw new Error(message);
};
const timestamp = (value: unknown) =>
  typeof value === "string" &&
  /^\d{4}-\d\d-\d\dT/.test(value) &&
  Number.isFinite(Date.parse(value));

function validateRoutineRuns(db: Database, goals: any[], revisions: any[]) {
  const assigned = new Map<string, string>();
  const runs = readRoutineRuns(db);
  for (const run of runs) {
    validateId(run.id);
    validateId(run.operationKey);
    const storedRequest = rows<any>(
      db,
      "SELECT request_json FROM routine_runs WHERE id = ?",
      [run.id],
    )[0];
    const request = normalizeRoutineInput(
      JSON.parse(storedRequest.request_json),
    );
    const dates = routineDates(run.startsOn, run.endsOn);
    if (
      request.operationKey !== run.operationKey ||
      request.templateId !== run.templateId ||
      request.templateVersion !== run.templateVersion ||
      request.startsOn !== run.startsOn ||
      request.endsOn !== run.endsOn ||
      !timestamp(run.createdAt) ||
      !isValidDate(run.sourceCheckedOn)
    )
      fail("Há uma experiência de rotina inválida.");
    for (const [value, limit] of [
      [run.name, 200],
      [run.principle, 2000],
      [run.sourceLabel, 300],
      [run.sourceUrl, 2000],
    ] as const) {
      if (typeof value !== "string" || !value.trim() || value.length > limit)
        fail("A origem da experiência é inválida.");
    }
    try {
      const url = new URL(run.sourceUrl);
      if (url.protocol !== "https:" || url.username || url.password) fail();
    } catch {
      fail("A fonte da experiência é inválida.");
    }
    if (
      !Array.isArray(run.activities) ||
      run.activities.length !== request.activities.length
    )
      fail("As atividades da experiência são inválidas.");
    run.activities.forEach((activity, index) => {
      const normalized = validateActivity(activity);
      if (
        JSON.stringify(normalized) !==
          JSON.stringify(request.activities[index]) ||
        !Array.isArray(activity.goals) ||
        activity.goals.length !== dates.length
      )
        fail(
          "As escolhas da experiência não correspondem ao registro original.",
        );
      activity.goals.forEach((plan, day) => {
        validateId(plan.id);
        if (plan.date !== dates[day] || assigned.has(plan.id))
          fail("Há compromissos de rotina duplicados ou fora do período.");
        assigned.set(plan.id, run.id);
        const goal = goals.find((goal) => goal.id === plan.id);
        // Deleted, never-evaluated goals may be absent. The original choice remains in the run.
        if (!goal) return;
        const versions = revisions.filter(
          (revision) => revision.goal_id === plan.id,
        );
        if (
          goal.origin_kind !== "routine" ||
          goal.origin_reference !== run.id ||
          versions.length !== 1 ||
          versions[0].frequency !== "once" ||
          versions[0].effective_from !== plan.date ||
          versions[0].title !== normalized.title ||
          versions[0].description !== normalized.description ||
          versions[0].category !== normalized.category
        )
          fail("O vínculo da experiência com a agenda é inválido.");
      });
    });
  }
  for (const goal of goals) {
    if (
      runs.some((run) => run.id === goal.origin_reference) &&
      assigned.get(goal.id) !== goal.origin_reference
    )
      fail("Há uma meta sem vínculo válido com a experiência.");
  }
}
export function validateId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 200)
    fail("Identificador inválido.");
}
export function validateInput(input: GoalInput) {
  if (
    !input ||
    typeof input.title !== "string" ||
    !input.title.trim() ||
    input.title.trim().length > 100
  )
    fail("A meta precisa de um título de até 100 caracteres.");
  if (typeof input.description !== "string" || input.description.length > 500)
    fail("A descrição deve ter até 500 caracteres.");
  if (!categories.includes(input.category)) fail("Categoria inválida.");
  if (!["daily", "weekly", "once"].includes(input.frequency))
    fail("Frequência inválida.");
  const mask = input.weekdayMask ?? (input.frequency === "daily" ? 127 : 0);
  if (input.weekdayMask !== undefined && !Number.isInteger(input.weekdayMask))
    fail("Os dias programados são inválidos.");
  if (
    !Number.isInteger(mask) ||
    (input.frequency === "daily" ? mask < 1 || mask > 127 : mask !== 0)
  )
    fail(
      "Selecione pelo menos um dia válido para a meta diária. Metas semanais não usam dias avulsos.",
    );
  if (!isValidDate(input.startDate) || input.startDate < "1900-01-01")
    fail("Escolha uma data válida a partir de 1900.");
  if (
    input.routineId !== undefined &&
    (typeof input.routineId !== "string" || input.routineId.length > 200)
  )
    fail("Origem da rotina inválida.");
}
export function validateIntegrity(db: Database) {
  if (
    db.exec("PRAGMA integrity_check")[0]?.values[0]?.[0] !== "ok" ||
    db.exec("PRAGMA foreign_key_check").length
  )
    fail("O banco de dados está danificado. Seus arquivos foram preservados.");
}
export function validateV2(db: Database) {
  if (versionOf(db) !== 2) fail("Versão do banco incompatível.");
  validateDatabase(db);
}
function validatePersonalization(db: Database) {
  const preferences = rows<any>(db, "SELECT * FROM personal_preferences");
  if (
    preferences.length !== 1 ||
    preferences[0].id !== 1 ||
    ![0, 1].includes(preferences[0].show_encouragement) ||
    !timestamp(preferences[0].updated_at)
  )
    fail("As preferências salvas são inválidas.");
  const data = readPersonalization(db);
  validatePreferences(data.preferences);
  for (const goal of data.longTermGoals) {
    validateId(goal.id);
    validateId(goal.operationKey);
    validateLongTermFields(goal);
    const raw = rows<any>(
      db,
      "SELECT create_request_json FROM long_term_goals WHERE id = ?",
      [goal.id],
    )[0];
    const original = normalizeLongTermInput(
      JSON.parse(raw.create_request_json),
    );
    if (
      original.operationKey !== goal.operationKey ||
      !isValidDate(goal.createdOn) ||
      goal.createdOn < "1900-01-01" ||
      !timestamp(goal.createdAt) ||
      !timestamp(goal.updatedAt) ||
      (goal.archivedAt !== null && !timestamp(goal.archivedAt)) ||
      (goal.dueOn !== null && goal.dueOn < goal.createdOn) ||
      (original.dueOn !== null && original.dueOn < goal.createdOn)
    )
      fail("Há um objetivo de longo prazo inválido.");
  }
}
export function validateDatabase(db: Database) {
  const version = versionOf(db);
  if (![2, 3, 4].includes(version)) fail("Versão do banco incompatível.");
  validateIntegrity(db);
  const required = [
    "schema_migrations",
    "goals",
    "goal_revisions",
    "day_plans",
    "goal_occurrences",
    "occurrence_events",
    ...(version >= 3 ? ["routine_runs"] : []),
    ...(version >= 4 ? ["personal_preferences", "long_term_goals"] : []),
  ];
  const tableNames = rows<{ name: string }>(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  ).map((row) => row.name);
  if (!required.every((name) => tableNames.includes(name)))
    fail("O banco não possui a estrutura esperada.");
  const marker = rows<any>(
    db,
    "SELECT * FROM schema_migrations WHERE version = 2",
  )[0];
  if (
    !marker ||
    marker.checksum !== createHash("sha256").update(schemaV2).digest("hex")
  )
    fail("O banco não possui o registro de migração esperado.");
  const reference = new (db.constructor as new () => Database)();
  try {
    reference.run(schemaV2);
    if (version >= 3) {
      reference.run(schemaV3);
      const routineMarker = rows<any>(
        db,
        "SELECT * FROM schema_migrations WHERE version = 3",
      )[0];
      if (
        routineMarker?.checksum !==
        createHash("sha256").update(schemaV3).digest("hex")
      )
        fail("O banco não possui o registro de rotinas esperado.");
    }
    if (version >= 4) {
      reference.run(schemaV4);
      const marker = rows<any>(
        db,
        "SELECT * FROM schema_migrations WHERE version = 4",
      )[0];
      if (
        marker?.checksum !== createHash("sha256").update(schemaV4).digest("hex")
      )
        fail("O banco não possui o registro de personalização esperado.");
    }
    for (const table of required) {
      if (
        JSON.stringify(rows(db, `PRAGMA table_info(${table})`)) !==
        JSON.stringify(rows(reference, `PRAGMA table_info(${table})`))
      )
        fail("A estrutura do banco não corresponde à versão informada.");
      if (
        JSON.stringify(rows(db, `PRAGMA foreign_key_list(${table})`)) !==
        JSON.stringify(rows(reference, `PRAGMA foreign_key_list(${table})`))
      )
        fail(
          "Os relacionamentos do banco não correspondem à versão informada.",
        );
    }
  } finally {
    reference.close();
  }
  if (
    rows(db, "SELECT name FROM sqlite_master WHERE type IN ('trigger', 'view')")
      .length
  )
    fail("O banco contém estruturas não reconhecidas.");
  const goals = rows<any>(db, "SELECT * FROM goals");
  const revisions = rows<any>(
    db,
    "SELECT * FROM goal_revisions ORDER BY goal_id, effective_from",
  );
  if (version >= 3) validateRoutineRuns(db, goals, revisions);
  if (version >= 4) validatePersonalization(db);
  for (const goal of goals) {
    validateId(goal.id);
    if (
      !timestamp(goal.created_at) ||
      !["personal", "routine"].includes(goal.origin_kind)
    )
      fail();
    if (goal.archived_from !== null && !isValidDate(goal.archived_from)) fail();
    if (!revisions.some((revision) => revision.goal_id === goal.id))
      fail("Há uma meta sem definição válida.");
  }
  for (let index = 0; index < revisions.length; index++) {
    const revision = revisions[index];
    validateId(revision.id);
    if (!goals.some((goal) => goal.id === revision.goal_id))
      fail("Há uma definição sem meta de origem.");
    validateInput({
      title: revision.title,
      description: revision.description,
      category: revision.category,
      frequency: revision.frequency,
      startDate: revision.effective_from,
    });
    if (
      !Number.isInteger(revision.revision_number) ||
      revision.revision_number < 1 ||
      !timestamp(revision.created_at)
    )
      fail();
    if (
      revision.effective_to !== null &&
      (!isValidDate(revision.effective_to) ||
        revision.effective_to <= revision.effective_from)
    )
      fail();
    if (
      revision.frequency === "daily"
        ? !Number.isInteger(revision.weekday_mask) ||
          revision.weekday_mask < 1 ||
          revision.weekday_mask > 127
        : revision.weekday_mask !== 0
    )
      fail();
    const previous = revisions[index - 1];
    if (
      previous?.goal_id === revision.goal_id &&
      (!previous.effective_to ||
        previous.effective_to > revision.effective_from)
    )
      fail("Há revisões sobrepostas no banco.");
  }
  const occurrences = rows<any>(db, "SELECT * FROM goal_occurrences");
  const keys = new Set<string>();
  for (const item of occurrences) {
    validateId(item.id);
    const revision = revisions.find(
      (revision) =>
        revision.id === item.revision_id && revision.goal_id === item.goal_id,
    );
    if (!revision) fail();
    const key = `${item.goal_id}:${item.period_kind}:${item.period_start}`;
    if (keys.has(key)) fail("Há compromissos duplicados no banco.");
    keys.add(key);
    validateInput({
      title: item.title_snapshot,
      description: item.description_snapshot,
      category: item.category_snapshot,
      frequency: item.frequency_snapshot,
      startDate: item.eligible_from,
    });
    if (
      !isValidDate(item.period_start) ||
      !isValidDate(item.period_end_exclusive) ||
      item.eligible_from < item.period_start ||
      item.eligible_from >= item.period_end_exclusive
    )
      fail();
    if (
      !["day", "week"].includes(item.period_kind) ||
      !["pending", "done", "missed"].includes(item.status) ||
      !["scheduled", "rest", "cancelled"].includes(item.disposition)
    )
      fail();
    if (item.disposition !== "scheduled" && item.status !== "pending") fail();
    if (item.period_kind === "week") {
      if (
        item.frequency_snapshot !== "weekly" ||
        weekStart(item.period_start) !== item.period_start ||
        shiftDate(item.period_start, 7) !== item.period_end_exclusive
      )
        fail();
    } else if (
      item.frequency_snapshot === "weekly" ||
      shiftDate(item.period_start, 1) !== item.period_end_exclusive ||
      item.eligible_from !== item.period_start
    )
      fail();
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: item.timezone });
    } catch {
      fail("Fuso inválido no banco.");
    }
    if (item.recorded_at !== null && !timestamp(item.recorded_at)) fail();
    if (!timestamp(item.created_at) || !timestamp(item.updated_at)) fail();
  }
  const plans = rows<any>(db, "SELECT * FROM day_plans");
  const events = rows<any>(db, "SELECT * FROM occurrence_events");
  for (const plan of plans) {
    if (
      !isValidDate(plan.local_date) ||
      plan.kind !== "rest" ||
      typeof plan.note !== "string" ||
      plan.note.length > 500 ||
      !timestamp(plan.created_at) ||
      !timestamp(plan.updated_at)
    )
      fail();
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: plan.timezone });
    } catch {
      fail("Fuso inválido no descanso planejado.");
    }
  }
  for (const item of occurrences.filter((item) => item.period_kind === "day")) {
    const rest = plans.some((plan) => plan.local_date === item.period_start);
    if (
      item.disposition === "rest" &&
      (!rest || events.some((event) => event.occurrence_id === item.id))
    )
      fail("Há um descanso incompatível com o histórico de avaliações.");
    if (rest && item.disposition === "scheduled")
      fail("Há compromissos ativos em um dia de descanso planejado.");
  }
  for (const event of events) {
    validateId(event.id);
    if (
      !["pending", "done", "missed"].includes(event.previous_status) ||
      !["pending", "done", "missed"].includes(event.next_status) ||
      event.previous_status === event.next_status ||
      !timestamp(event.changed_at) ||
      !["checklist", "history_correction"].includes(event.change_reason)
    )
      fail();
  }
}
