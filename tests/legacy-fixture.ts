import initSqlJs from "sql.js";
import { resolve } from "node:path";

export const wasm = resolve("node_modules/sql.js/dist/sql-wasm.wasm");
export async function legacyFixture() {
  const SQL = await initSqlJs({ locateFile: () => wasm });
  const db = new SQL.Database();
  db.run(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE goals (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      category TEXT NOT NULL, frequency TEXT NOT NULL, start_date TEXT NOT NULL, archived_on TEXT, routine_id TEXT);
    CREATE TABLE entries (goal_id TEXT NOT NULL REFERENCES goals(id), period TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('done', 'missed')), PRIMARY KEY(goal_id, period));
    INSERT INTO goals VALUES
      ('daily', 'Ler 10 páginas', 'Um capítulo por dia', 'Estudos', 'daily', '2026-10-26', NULL, NULL),
      ('archived', 'Caminhar', 'Um passo de cada vez', 'Saúde', 'daily', '2026-10-26', '2026-10-27', NULL),
      ('weekly', 'Organizar a semana', '', 'Trabalho', 'weekly', '2026-10-28', NULL, NULL),
      ('once', 'Desacelerar e revisar o dia', '', 'Pessoal', 'once', '2026-10-27', NULL, 'ilia');
    INSERT INTO entries VALUES
      ('daily', '2026-10-26', 'done'), ('archived', '2026-10-27', 'done'),
      ('weekly', '2026-10-26', 'missed'), ('once', '2026-10-27', 'done');
    PRAGMA user_version = 1;
  `);
  const bytes = db.export();
  db.close();
  return bytes;
}
