import type { Database } from "sql.js";
import type { RoutineRun } from "../../shared/types";
import { rows } from "./sql";

export function readRoutineRuns(db: Database): RoutineRun[] {
  return rows<any>(db, "SELECT * FROM routine_runs ORDER BY rowid").map(
    (row) => ({
      id: row.id,
      operationKey: row.operation_key,
      templateId: row.template_id,
      templateVersion: row.template_version,
      name: row.name_snapshot,
      principle: row.principle_snapshot,
      sourceLabel: row.source_label_snapshot,
      sourceUrl: row.source_url_snapshot,
      sourceCheckedOn: row.source_checked_on,
      activities: JSON.parse(row.activities_snapshot_json),
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      createdAt: row.created_at,
    }),
  );
}
