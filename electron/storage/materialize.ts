import { randomUUID } from "node:crypto";
import type { Database } from "sql.js";
import { shiftDate, weekStart } from "../../shared/domain";
import { rows } from "./sql";
import { weekdayBit } from "../../shared/schedule";

export interface RevisionRow {
  id: string;
  goal_id: string;
  title: string;
  description: string;
  category: string;
  frequency: string;
  weekday_mask: number;
  effective_from: string;
  effective_to: string | null;
  archived_from: string | null;
  origin_reference: string | null;
}

export function insertOccurrence(
  db: Database,
  revision: RevisionRow,
  period: string,
  eligible: string,
  now: string,
  timezone: string,
) {
  const weekly = revision.frequency === "weekly";
  db.run(
    `INSERT INTO goal_occurrences (
    id, goal_id, revision_id, period_kind, period_start, period_end_exclusive, eligible_from, timezone,
    title_snapshot, description_snapshot, category_snapshot, frequency_snapshot, origin_snapshot,
    disposition, status, recorded_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', 'pending', NULL, ?, ?)`,
    [
      randomUUID(),
      revision.goal_id,
      revision.id,
      weekly ? "week" : "day",
      period,
      shiftDate(period, weekly ? 7 : 1),
      eligible,
      timezone,
      revision.title,
      revision.description,
      revision.category,
      revision.frequency,
      revision.origin_reference,
      now,
      now,
    ],
  );
}

export function materialize(
  db: Database,
  through: string,
  now: string,
  timezone: string,
): boolean {
  const existing = new Set(
    rows<{ goal_id: string; period_kind: string; period_start: string }>(
      db,
      "SELECT goal_id, period_kind, period_start FROM goal_occurrences",
    ).map((item) => `${item.goal_id}:${item.period_kind}:${item.period_start}`),
  );
  const rests = new Set(
    rows<{ local_date: string }>(db, "SELECT local_date FROM day_plans").map(
      (item) => item.local_date,
    ),
  );
  const revisions = rows<RevisionRow>(
    db,
    `SELECT r.*, g.archived_from, g.origin_reference FROM goal_revisions r JOIN goals g ON g.id = r.goal_id ORDER BY r.effective_from`,
  );
  let changed = false;
  for (const revision of revisions) {
    const last = [
      through,
      revision.effective_to ? shiftDate(revision.effective_to, -1) : through,
      revision.archived_from ? shiftDate(revision.archived_from, -1) : through,
    ].sort()[0];
    for (let date = revision.effective_from; date <= last;) {
      const weekly = revision.frequency === "weekly";
      const period = weekly ? weekStart(date) : date;
      const key = `${revision.goal_id}:${weekly ? "week" : "day"}:${period}`;
      const eligible =
        revision.frequency !== "daily" ||
        (revision.weekday_mask & weekdayBit(date)) !== 0;
      if (eligible && !existing.has(key)) {
        insertOccurrence(db, revision, period, date, now, timezone);
        if (!weekly && rests.has(date))
          db.run(
            "UPDATE goal_occurrences SET disposition = 'rest' WHERE goal_id = ? AND period_start = ? AND period_kind = 'day'",
            [revision.goal_id, date],
          );
        existing.add(key);
        changed = true;
      }
      if (revision.frequency === "once") break;
      date = weekly ? shiftDate(period, 7) : shiftDate(date, 1);
    }
  }
  return changed;
}
