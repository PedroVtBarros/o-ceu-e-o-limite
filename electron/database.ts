import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  type Goal,
  type GoalInput,
  type GoalUpdate,
  type DayPlan,
  type OutcomeEvent,
  type GoalRevision,
  type Occurrence,
  type Snapshot,
  type Status,
  type RoutineRunInput,
  type RoutineRun,
  type Preferences,
  type LongTermGoalFields,
  type LongTermGoalInput,
} from "../shared/types";
import { dateKey, isValidDate, shiftDate, weekStart } from "../shared/domain";
import { routines } from "../shared/routines";
import { SCHEMA_VERSION } from "./storage/schema";
import { rows, versionOf } from "./storage/sql";
import {
  validateId,
  validateInput,
  validateDatabase,
} from "./storage/validation";
import {
  defaultRoutineInput,
  normalizeRoutineInput,
  overlappingRuns,
  routineDates,
  validateTemplate,
} from "../shared/routineRuns";
import { readRoutineRuns } from "./storage/routineRuns";
import { readPersonalization } from "./storage/personalization";
import {
  normalizeLongTermInput,
  validateLongTermFields,
  validatePreferences,
} from "../shared/personalization";
import { materialize } from "./storage/materialize";
import { upgradeToCurrent, newDatabase } from "./storage/migrations";
import { assertSqlite, sqliteBytes, writeAtomic } from "./storage/files";
import { MAX_BACKUP_BYTES, type BackupPreview } from "../shared/backup";
import { saveRestoreCheckpoint } from "./storage/backupFiles";
import { earliestRevision, revisionDateError } from "../shared/schedule";

interface OpenOptions {
  now?: () => Date;
}
export interface PreparedRestore {
  readonly preview: BackupPreview;
  restore(options?: { preserveRollingBackup?: boolean }): {
    snapshot: Snapshot;
    recoveryPath: string;
  };
  dispose(): void;
}
export class SkyDatabase {
  private constructor(
    private db: Database,
    private SQL: SqlJsStatic,
    readonly filePath: string,
    private clock: () => Date,
  ) {}
  private get today() {
    return dateKey(this.clock());
  }
  private get now() {
    return this.clock().toISOString();
  }
  private get timezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  static async open(
    filePath: string,
    wasmPath: string,
    options: OpenOptions = {},
  ): Promise<SkyDatabase> {
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const clock = options.now ?? (() => new Date());
    const original = existsSync(filePath) ? readFileSync(filePath) : null;
    if (original) assertSqlite(original);
    let db: Database | undefined;
    try {
      db = original
        ? new SQL.Database(original)
        : newDatabase(SQL, clock().toISOString());
      const version = versionOf(db);
      if (version > SCHEMA_VERSION)
        throw new Error(
          "Este banco foi criado por uma versão mais recente do aplicativo. Atualize o aplicativo para abri-lo.",
        );
      if ([1, 2, 3].includes(version)) {
        const backup = `${filePath}.pre-v${version + 1}-${clock().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.sqlite`;
        writeFileSync(backup, original!, { flag: "wx", flush: true });
        const upgraded = upgradeToCurrent(
          SQL,
          db,
          dateKey(clock()),
          clock().toISOString(),
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        );
        db.close();
        db = upgraded;
        writeAtomic(db, filePath, SQL, true);
      } else if (version !== SCHEMA_VERSION)
        throw new Error(
          "Formato de banco não reconhecido. O arquivo original foi preservado.",
        );
      validateDatabase(db);
      db.run("PRAGMA foreign_keys = ON");
      if (!original) writeAtomic(db, filePath, SQL, true, false);
      const store = new SkyDatabase(db, SQL, filePath, clock);
      store.load();
      return store;
    } catch (error) {
      db?.close();
      throw error;
    }
  }

  private mutate(change: () => void | boolean): Snapshot {
    const before = sqliteBytes(this.db);
    try {
      this.db.run("BEGIN");
      const changed = change();
      this.db.run("COMMIT");
      if (changed !== false) writeAtomic(this.db, this.filePath, this.SQL);
      return this.snapshot();
    } catch (error) {
      this.db.close();
      this.db = new this.SQL.Database(before);
      this.db.run("PRAGMA foreign_keys = ON");
      throw error;
    }
  }
  load(): Snapshot {
    return this.mutate(() =>
      materialize(this.db, this.today, this.now, this.timezone),
    );
  }
  snapshot(): Snapshot {
    return this.project(this.db);
  }
  private project(db: Database): Snapshot {
    const routineRuns = readRoutineRuns(db);
    const origins = new Map(routineRuns.map((run) => [run.id, run]));
    const activityByGoal = new Map(
      routineRuns.flatMap((run) =>
        run.activities.flatMap((activity) =>
          activity.goals.map(
            (goal) =>
              [
                goal.id,
                {
                  time: activity.time,
                  minutes: activity.minutes,
                  intensity: activity.intensity,
                },
              ] as const,
          ),
        ),
      ),
    );
    const revisions = rows<any>(
      db,
      "SELECT * FROM goal_revisions ORDER BY goal_id, effective_from",
    ).map((row) => ({
      id: row.id,
      goalId: row.goal_id,
      revisionNumber: row.revision_number,
      title: row.title,
      description: row.description,
      category: row.category,
      frequency: row.frequency,
      weekdayMask: row.weekday_mask,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
    })) as GoalRevision[];
    const goals = rows<any>(db, "SELECT * FROM goals ORDER BY rowid").map(
      (row) => {
        const versions = revisions.filter(
          (revision) => revision.goalId === row.id,
        );
        const asOf =
          row.archived_from && row.archived_from < this.today
            ? row.archived_from
            : this.today;
        const current =
          versions
            .filter((revision) => revision.effectiveFrom <= asOf)
            .at(-1) ?? versions[0];
        const nextRevision = versions.find(
          (revision) => revision.effectiveFrom > asOf,
        );
        const goal: Goal = {
          id: row.id,
          title: current.title,
          description: current.description,
          category: current.category,
          frequency: current.frequency,
          weekdayMask: current.weekdayMask,
          startDate: versions[0].effectiveFrom,
          archivedOn: row.archived_from,
          routineId:
            row.origin_kind === "routine"
              ? (origins.get(row.origin_reference)?.templateId ??
                row.origin_reference)
              : null,
          canDelete: !this.hasHistory(row.id, db),
        };
        if (origins.has(row.origin_reference)) {
          goal.routineRunId = row.origin_reference;
          goal.routineActivity = activityByGoal.get(row.id);
        }
        if (nextRevision) goal.nextRevision = nextRevision;
        return goal;
      },
    );
    const occurrences = rows<any>(
      db,
      "SELECT * FROM goal_occurrences ORDER BY goal_id, period_start",
    ).map((row) => ({
      id: row.id,
      goalId: row.goal_id,
      revisionId: row.revision_id,
      periodKind: row.period_kind,
      periodStart: row.period_start,
      periodEndExclusive: row.period_end_exclusive,
      eligibleFrom: row.eligible_from,
      timezone: row.timezone,
      title: row.title_snapshot,
      description: row.description_snapshot,
      category: row.category_snapshot,
      frequency: row.frequency_snapshot,
      routineId:
        origins.get(row.origin_snapshot)?.templateId ?? row.origin_snapshot,
      ...(origins.has(row.origin_snapshot)
        ? {
            routineRunId: row.origin_snapshot,
            routineActivity: activityByGoal.get(row.goal_id),
          }
        : {}),
      disposition: row.disposition,
      status: row.status,
      recordedAt: row.recorded_at,
    })) as Occurrence[];
    const entries = occurrences
      .filter((item) => item.status !== "pending")
      .map((item) => ({
        goalId: item.goalId,
        period: item.periodStart,
        status: item.status as "done" | "missed",
      }));
    const dayPlans = rows<any>(
      db,
      "SELECT * FROM day_plans ORDER BY local_date",
    ).map((row) => ({
      date: row.local_date,
      kind: row.kind,
      note: row.note,
      timezone: row.timezone,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })) as DayPlan[];
    const events = rows<any>(
      db,
      "SELECT * FROM occurrence_events ORDER BY rowid",
    ).map((row) => ({
      id: row.id,
      occurrenceId: row.occurrence_id,
      previousStatus: row.previous_status,
      nextStatus: row.next_status,
      changedAt: row.changed_at,
      reason: row.change_reason,
    })) as OutcomeEvent[];
    return {
      schemaVersion: 4,
      ...readPersonalization(db),
      routineRuns,
      goals,
      revisions,
      occurrences,
      entries,
      dayPlans,
      events,
    };
  }
  private find(id: string): Goal {
    validateId(id);
    const goal = this.snapshot().goals.find((goal) => goal.id === id);
    if (!goal) throw new Error("Meta não encontrada.");
    return goal;
  }
  private hasHistory(id: string, db: Database = this.db): boolean {
    return (
      rows(
        db,
        `SELECT id FROM goal_occurrences o WHERE o.goal_id = ?
      AND (o.status != 'pending' OR EXISTS (SELECT 1 FROM occurrence_events e WHERE e.occurrence_id = o.id)) LIMIT 1`,
        [id],
      ).length > 0
    );
  }
  private insert(input: GoalInput, allowPast = false, runId?: string) {
    validateInput(input);
    if (!allowPast && input.startDate < this.today)
      throw new Error("Novas metas devem começar hoje ou em uma data futura.");
    if (
      input.routineId &&
      !routines.some((routine) => routine.id === input.routineId)
    )
      throw new Error("Rotina inválida.");
    const id = randomUUID();
    this.db.run("INSERT INTO goals VALUES (?, ?, NULL, ?, ?)", [
      id,
      this.now,
      input.routineId ? "routine" : "personal",
      runId ?? input.routineId ?? null,
    ]);
    this.db.run(
      "INSERT INTO goal_revisions VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, NULL, ?)",
      [
        randomUUID(),
        id,
        input.title.trim(),
        input.description.trim(),
        input.category,
        input.frequency,
        input.weekdayMask ?? (input.frequency === "daily" ? 127 : 0),
        input.startDate,
        this.now,
      ],
    );
    return id;
  }
  createGoal(input: GoalInput): Snapshot {
    return this.mutate(() => {
      this.insert(input);
      materialize(this.db, this.today, this.now, this.timezone);
    });
  }
  updateGoal(id: string, input: GoalUpdate): Snapshot {
    const goal = this.find(id);
    if (!input || typeof input !== "object")
      throw new Error("Alteração de meta inválida.");
    if (
      input.frequency !== undefined &&
      !["daily", "weekly"].includes(input.frequency)
    )
      throw new Error("Frequência inválida.");
    if (input.weekdayMask !== undefined && !Number.isInteger(input.weekdayMask))
      throw new Error("Dias programados inválidos.");
    if (input.effectiveFrom !== undefined && !isValidDate(input.effectiveFrom))
      throw new Error("Data de vigência inválida.");
    if (goal.archivedOn) throw new Error("Esta meta já foi arquivada.");
    const frequency =
      input.frequency ?? goal.nextRevision?.frequency ?? goal.frequency;
    if (frequency === "once" || goal.frequency === "once")
      throw new Error(
        "Esta atividade pontual mantém sua definição original. Crie uma nova meta para a alteração.",
      );
    const mask =
      input.weekdayMask ??
      (frequency === "daily"
        ? goal.nextRevision?.frequency === "daily"
          ? goal.nextRevision.weekdayMask
          : goal.frequency === "daily"
            ? (goal.weekdayMask ?? 127)
            : 127
        : 0);
    validateInput({
      title: input.title,
      description: input.description,
      category: input.category,
      frequency,
      weekdayMask: mask,
      startDate: goal.startDate,
    });
    return this.mutate(() => {
      materialize(this.db, this.today, this.now, this.timezone);
      const versions = rows<any>(
        this.db,
        "SELECT * FROM goal_revisions WHERE goal_id = ? ORDER BY effective_from",
        [id],
      );
      const hasOccurrences =
        rows(
          this.db,
          "SELECT id FROM goal_occurrences WHERE goal_id = ? LIMIT 1",
          [id],
        ).length > 0;
      const current =
        versions.filter((item) => item.effective_from <= this.today).at(-1) ??
        versions[0];
      const pending = hasOccurrences
        ? versions.find((item) => item.effective_from > this.today)
        : versions[0];
      const effective =
        input.effectiveFrom ??
        pending?.effective_from ??
        earliestRevision(
          this.today,
          current.frequency,
          frequency,
          hasOccurrences,
        );
      const error = revisionDateError(
        effective,
        this.today,
        current.frequency,
        frequency,
        hasOccurrences,
      );
      if (error) throw new Error(error);
      const following = pending
        ? versions.find((item) => item.effective_from > pending.effective_from)
        : undefined;
      if (following && effective >= following.effective_from)
        throw new Error(
          "A vigência deve ser anterior à próxima versão já programada.",
        );
      if (
        hasOccurrences &&
        current.effective_to &&
        current.effective_to <= this.today
      )
        throw new Error(
          "Esta meta não possui uma versão vigente para alterar.",
        );
      if (pending) {
        this.db.run(
          "UPDATE goal_revisions SET title = ?, description = ?, category = ?, frequency = ?, weekday_mask = ?, effective_from = ? WHERE id = ?",
          [
            input.title.trim(),
            input.description.trim(),
            input.category,
            frequency,
            mask,
            effective,
            pending.id,
          ],
        );
        if (hasOccurrences)
          this.db.run(
            "UPDATE goal_revisions SET effective_to = ? WHERE id = ?",
            [effective, current.id],
          );
      } else {
        this.db.run("UPDATE goal_revisions SET effective_to = ? WHERE id = ?", [
          effective,
          current.id,
        ]);
        this.db.run(
          "INSERT INTO goal_revisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)",
          [
            randomUUID(),
            id,
            Math.max(...versions.map((item) => item.revision_number)) + 1,
            input.title.trim(),
            input.description.trim(),
            input.category,
            frequency,
            mask,
            effective,
            this.now,
          ],
        );
      }
      materialize(this.db, this.today, this.now, this.timezone);
    });
  }
  deleteGoal(id: string): Snapshot {
    this.find(id);
    if (this.hasHistory(id))
      throw new Error(
        "Esta meta tem histórico de resultados. Você pode arquivá-la para preservá-lo.",
      );
    return this.mutate(() => {
      if (this.hasHistory(id))
        throw new Error(
          "A meta passou a ter histórico e não pode ser excluída.",
        );
      this.db.run("DELETE FROM goal_occurrences WHERE goal_id = ?", [id]);
      this.db.run("DELETE FROM goal_revisions WHERE goal_id = ?", [id]);
      this.db.run("DELETE FROM goals WHERE id = ?", [id]);
    });
  }
  archiveGoal(id: string): Snapshot {
    const goal = this.find(id);
    if (goal.archivedOn) return this.snapshot();
    return this.mutate(() => {
      materialize(this.db, this.today, this.now, this.timezone);
      this.db.run("UPDATE goals SET archived_from = ? WHERE id = ?", [
        this.today,
        id,
      ]);
      this.db.run(
        `UPDATE goal_occurrences SET disposition = 'cancelled', updated_at = ?
        WHERE goal_id = ? AND status = 'pending' AND period_end_exclusive > ?
        AND NOT EXISTS (SELECT 1 FROM occurrence_events WHERE occurrence_id = goal_occurrences.id)`,
        [this.now, id, this.today],
      );
    });
  }
  setStatus(id: string, date: string, status: Status): Snapshot {
    this.find(id);
    if (!isValidDate(date) || date > this.today)
      throw new Error("Escolha uma data válida até hoje.");
    if (!["done", "missed", "pending"].includes(status))
      throw new Error("Resultado inválido.");
    return this.mutate(() => {
      const materialized = materialize(
        this.db,
        this.today,
        this.now,
        this.timezone,
      );
      const occurrence = rows<any>(
        this.db,
        `SELECT * FROM goal_occurrences WHERE goal_id = ?
        AND eligible_from <= ? AND period_end_exclusive > ? AND disposition = 'scheduled'`,
        [id, date, date],
      )[0];
      if (!occurrence)
        throw new Error("Esta meta não está disponível nessa data.");
      if (occurrence.status === status) return materialized;
      this.db.run(
        "UPDATE goal_occurrences SET status = ?, recorded_at = ?, updated_at = ? WHERE id = ?",
        [
          status,
          status === "pending" ? null : this.now,
          this.now,
          occurrence.id,
        ],
      );
      this.db.run("INSERT INTO occurrence_events VALUES (?, ?, ?, ?, ?, ?)", [
        randomUUID(),
        occurrence.id,
        occurrence.status,
        status,
        this.now,
        date === this.today ? "checklist" : "history_correction",
      ]);
    });
  }
  planRest(date: string, note: string): Snapshot {
    if (!isValidDate(date) || date < this.today)
      throw new Error("Planeje o descanso para hoje ou uma data futura.");
    if (typeof note !== "string" || note.length > 500)
      throw new Error("A observação deve ter até 500 caracteres.");
    return this.mutate(() => {
      const materialized = materialize(
        this.db,
        this.today,
        this.now,
        this.timezone,
      );
      const evaluated = rows(
        this.db,
        `SELECT id FROM goal_occurrences o WHERE period_kind = 'day' AND period_start = ?
        AND (status != 'pending' OR EXISTS (SELECT 1 FROM occurrence_events e WHERE e.occurrence_id = o.id)) LIMIT 1`,
        [date],
      );
      if (evaluated.length)
        throw new Error(
          "Este dia já teve resultados diários registrados. O descanso não pode dispensar esse histórico.",
        );
      const existing = rows<any>(
        this.db,
        "SELECT note FROM day_plans WHERE local_date = ?",
        [date],
      )[0];
      if (existing?.note === note.trim()) return materialized;
      this.db.run(
        `INSERT INTO day_plans VALUES (?, 'rest', ?, ?, ?, ?)
        ON CONFLICT(local_date) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at`,
        [date, note.trim(), this.timezone, this.now, this.now],
      );
      this.db.run(
        `UPDATE goal_occurrences SET disposition = 'rest', updated_at = ?
        WHERE period_kind = 'day' AND period_start = ? AND disposition = 'scheduled' AND status = 'pending'`,
        [this.now, date],
      );
    });
  }
  removeRest(date: string): Snapshot {
    if (!isValidDate(date) || date < this.today)
      throw new Error("O descanso de um dia encerrado permanece no histórico.");
    return this.mutate(() => {
      const materialized = materialize(
        this.db,
        this.today,
        this.now,
        this.timezone,
      );
      if (
        !rows(
          this.db,
          "SELECT local_date FROM day_plans WHERE local_date = ?",
          [date],
        ).length
      )
        return materialized;
      this.db.run("DELETE FROM day_plans WHERE local_date = ?", [date]);
      this.db.run(
        `UPDATE goal_occurrences SET disposition = 'scheduled', updated_at = ?
        WHERE period_kind = 'day' AND period_start = ? AND disposition = 'rest'`,
        [this.now, date],
      );
    });
  }
  // Compatibility entry point; new UI always previews explicit choices first.
  addRoutine(id: string, date: string): Snapshot {
    validateId(id);
    const template = routines.find((routine) => routine.id === id);
    if (!template || !isValidDate(date) || date !== this.today)
      throw new Error(
        "Rotina ou data inválida. Novas experiências começam hoje ou no futuro.",
      );
    return this.startRoutine(defaultRoutineInput(template, date, randomUUID()));
  }
  startRoutine(value: RoutineRunInput): Snapshot {
    const input = normalizeRoutineInput(value);
    const request = JSON.stringify(input);
    const existing = rows<any>(
      this.db,
      "SELECT request_json FROM routine_runs WHERE operation_key = ?",
      [input.operationKey],
    )[0];
    if (existing) {
      if (existing.request_json !== request)
        throw new Error(
          "Esta solicitação já foi usada com outras escolhas. Abra uma nova experiência.",
        );
      return this.load();
    }
    const template = validateTemplate(input);
    if (input.startsOn < this.today)
      throw new Error("Novas experiências devem começar hoje ou no futuro.");
    if (
      !input.allowRepeat &&
      overlappingRuns(
        this.snapshot(),
        input.templateId,
        input.startsOn,
        input.endsOn,
      )
    )
      throw new Error(
        "Esta rotina já foi adicionada nesse período. Confirme que deseja uma nova experiência.",
      );
    return this.mutate(() => {
      const id = randomUUID();
      const dates = routineDates(input.startsOn, input.endsOn);
      const activities: RoutineRun["activities"] = input.activities.map(
        (activity) => ({
          ...activity,
          goals: dates.map((date) => ({
            id: this.insert(
              {
                title: activity.title,
                description: activity.description,
                category: activity.category,
                frequency: "once",
                startDate: date,
                routineId: template.id,
              },
              false,
              id,
            ),
            date,
          })),
        }),
      );
      this.db.run(
        "INSERT INTO routine_runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          input.operationKey,
          template.id,
          template.version,
          template.name,
          template.principle,
          template.sourceLabel,
          template.sourceUrl,
          template.sourceCheckedOn,
          JSON.stringify(activities),
          input.startsOn,
          input.endsOn,
          this.now,
          request,
        ],
      );
      materialize(this.db, this.today, this.now, this.timezone);
    });
  }
  updatePreferences(value: Preferences): Snapshot {
    const input = validatePreferences(value);
    return this.mutate(() => {
      const current = readPersonalization(this.db).preferences;
      if (
        current.theme === input.theme &&
        current.showEncouragement === input.showEncouragement
      )
        return false;
      this.db.run(
        "UPDATE personal_preferences SET theme = ?, show_encouragement = ?, updated_at = ? WHERE id = 1",
        [input.theme, input.showEncouragement ? 1 : 0, this.now],
      );
    });
  }
  createLongTermGoal(value: LongTermGoalInput): Snapshot {
    const input = normalizeLongTermInput(value);
    const request = JSON.stringify(input);
    const existing = rows<any>(
      this.db,
      "SELECT create_request_json FROM long_term_goals WHERE operation_key = ?",
      [input.operationKey],
    )[0];
    if (existing) {
      if (existing.create_request_json !== request)
        throw new Error(
          "Esta solicitação já criou outro objetivo. Abra um novo formulário.",
        );
      return this.load();
    }
    if (input.dueOn !== null && input.dueOn < this.today)
      throw new Error("O prazo do novo objetivo deve ser hoje ou futuro.");
    return this.mutate(() => {
      this.db.run(
        "INSERT INTO long_term_goals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)",
        [
          randomUUID(),
          input.operationKey,
          input.title,
          input.description,
          input.category,
          input.target,
          input.current,
          input.unit,
          input.dueOn,
          this.today,
          this.now,
          this.now,
          request,
        ],
      );
    });
  }
  updateLongTermGoal(id: string, value: LongTermGoalFields): Snapshot {
    validateId(id);
    const input = validateLongTermFields(value);
    const goal = readPersonalization(this.db).longTermGoals.find(
      (goal) => goal.id === id,
    );
    if (!goal) throw new Error("Objetivo não encontrado.");
    if (goal.archivedAt) throw new Error("Reative o objetivo antes de editar.");
    if (input.dueOn && input.dueOn !== goal.dueOn && input.dueOn < this.today)
      throw new Error("Escolha um novo prazo hoje ou no futuro.");
    return this.mutate(() => {
      this.db.run(
        "UPDATE long_term_goals SET title = ?, description = ?, category = ?, target_value = ?, current_value = ?, unit = ?, due_on = ?, updated_at = ? WHERE id = ?",
        [
          input.title,
          input.description,
          input.category,
          input.target,
          input.current,
          input.unit,
          input.dueOn,
          this.now,
          id,
        ],
      );
    });
  }
  archiveLongTermGoal(id: string, archived: boolean): Snapshot {
    validateId(id);
    if (typeof archived !== "boolean")
      throw new Error("Ação de arquivamento inválida.");
    const goal = readPersonalization(this.db).longTermGoals.find(
      (goal) => goal.id === id,
    );
    if (!goal) throw new Error("Objetivo não encontrado.");
    return this.mutate(() => {
      if (Boolean(goal.archivedAt) === archived) return false;
      this.db.run(
        "UPDATE long_term_goals SET archived_at = ?, updated_at = ? WHERE id = ?",
        [archived ? this.now : null, this.now, id],
      );
    });
  }
  exportBytes(): Uint8Array {
    validateDatabase(this.db);
    return sqliteBytes(this.db);
  }
  prepareImport(bytes: Uint8Array): PreparedRestore {
    if (!(bytes instanceof Uint8Array))
      throw new Error("Conteúdo de backup inválido.");
    if (bytes.length > MAX_BACKUP_BYTES)
      throw new Error("O backup deve ter no máximo 50 MB.");
    assertSqlite(bytes);
    let candidate: Database | null = new this.SQL.Database(bytes);
    let sourceVersion: number;
    let snapshot: Snapshot;
    try {
      sourceVersion = versionOf(candidate);
      if (sourceVersion > SCHEMA_VERSION)
        throw new Error(
          "Backup incompatível: foi criado por uma versão mais recente. Atualize o aplicativo.",
        );
      if (![1, 2, 3, SCHEMA_VERSION].includes(sourceVersion))
        throw new Error("Backup incompatível com esta versão.");
      if (sourceVersion < SCHEMA_VERSION) {
        const upgraded = upgradeToCurrent(
          this.SQL,
          candidate,
          this.today,
          this.now,
          this.timezone,
        );
        candidate.close();
        candidate = upgraded;
      }
      validateDatabase(candidate);
      materialize(candidate, this.today, this.now, this.timezone);
      snapshot = this.project(candidate);
    } catch (error) {
      candidate?.close();
      throw error;
    }
    const preview: BackupPreview = {
      sourceVersion,
      targetVersion: SCHEMA_VERSION,
      goals: snapshot.goals.length,
      results: snapshot.entries.length,
      routines: snapshot.routineRuns?.length ?? 0,
      objectives: snapshot.longTermGoals?.length ?? 0,
    };
    return {
      preview,
      restore: (options = {}) => {
        if (!candidate)
          throw new Error(
            "Esta preparação de backup já foi encerrada. Escolha a cópia novamente.",
          );
        materialize(candidate, this.today, this.now, this.timezone);
        const restored = this.project(candidate);
        const recoveryPath = saveRestoreCheckpoint(this.filePath, this.now);
        writeAtomic(
          candidate,
          this.filePath,
          this.SQL,
          true,
          !options.preserveRollingBackup,
        );
        this.db.close();
        this.db = candidate;
        candidate = null;
        this.db.run("PRAGMA foreign_keys = ON");
        return { snapshot: restored, recoveryPath };
      },
      dispose: () => {
        candidate?.close();
        candidate = null;
      },
    };
  }
  async importBytes(bytes: Uint8Array, _wasmPath?: string): Promise<Snapshot> {
    const prepared = this.prepareImport(bytes);
    try {
      return prepared.restore().snapshot;
    } finally {
      prepared.dispose();
    }
  }
  close() {
    this.db.close();
  }
}
