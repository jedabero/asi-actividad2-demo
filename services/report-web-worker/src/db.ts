import { Database } from "bun:sqlite";

export function initTelemetryDb(dbPath: string) {
  const db = new Database(dbPath);

  db.run(`
    PRAGMA journal_mode=WAL;
  `);

  return db;
}