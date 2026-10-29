import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  renameSync,
} from "node:fs";
import { dirname } from "node:path";
import type { Database, SqlJsStatic } from "sql.js";
import { validateDatabase } from "./validation";

export function sqliteBytes(db: Database): Uint8Array {
  const bytes = db.export();
  // sql.js reopens the connection after export, resetting connection-level pragmas.
  db.run("PRAGMA foreign_keys = ON");
  return bytes;
}
export function assertSqlite(bytes: Uint8Array) {
  if (
    bytes.length < 100 ||
    Buffer.from(bytes.subarray(0, 16)).toString("binary") !==
      "SQLite format 3\0"
  )
    throw new Error(
      "O arquivo não é um banco SQLite válido. Seus dados foram preservados.",
    );
}
export function writeAtomic(
  db: Database,
  filePath: string,
  SQL: SqlJsStatic,
  verify = false,
  backup = true,
) {
  mkdirSync(dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  writeFileSync(temporary, sqliteBytes(db), { flush: true });
  if (verify) {
    const reopened = new SQL.Database(readFileSync(temporary));
    try {
      validateDatabase(reopened);
    } finally {
      reopened.close();
    }
  }
  if (backup && existsSync(filePath)) copyFileSync(filePath, `${filePath}.bak`);
  // The original remains untouched until the complete temporary file is ready.
  renameSync(temporary, filePath);
}
