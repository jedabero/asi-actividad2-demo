import { Database } from "bun:sqlite";

export function initWebDb(dbPath: string) {
  const db = new Database(dbPath);

  db.run(`
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
    PRAGMA synchronous=NORMAL;

    CREATE TABLE IF NOT EXISTS report_jobs (
      job_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS report_results (
      job_id TEXT PRIMARY KEY,
      result_json TEXT NOT NULL,
      completed_at TEXT NOT NULL
    );
  `);

  return db;
}