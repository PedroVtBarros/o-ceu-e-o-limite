import type { Database, SqlValue } from "sql.js";

export function rows<T = Record<string, SqlValue>>(
  db: Database,
  sql: string,
  values: SqlValue[] = [],
): T[] {
  const statement = db.prepare(sql);
  try {
    statement.bind(values);
    const result: T[] = [];
    while (statement.step()) result.push(statement.getAsObject() as T);
    return result;
  } finally {
    statement.free();
  }
}
export function versionOf(db: Database): number {
  return Number(db.exec("PRAGMA user_version")[0]?.values[0]?.[0] ?? 0);
}
