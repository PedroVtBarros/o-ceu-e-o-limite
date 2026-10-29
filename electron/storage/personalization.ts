import type { Database } from "sql.js";
import type { LongTermGoal, Preferences } from "../../shared/types";
import { rows } from "./sql";

export function readPersonalization(db: Database): {
  preferences: Preferences;
  longTermGoals: LongTermGoal[];
} {
  const pref = rows<any>(
    db,
    "SELECT * FROM personal_preferences WHERE id = 1",
  )[0];
  return {
    preferences: {
      theme: pref.theme,
      showEncouragement: pref.show_encouragement === 1,
    },
    longTermGoals: rows<any>(
      db,
      "SELECT * FROM long_term_goals ORDER BY rowid",
    ).map((row) => ({
      id: row.id,
      operationKey: row.operation_key,
      title: row.title,
      description: row.description,
      category: row.category,
      target: row.target_value,
      current: row.current_value,
      unit: row.unit,
      dueOn: row.due_on,
      createdOn: row.created_on,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at,
    })),
  };
}
