import { Database } from "bun:sqlite";

export function initAuditDb(dbPath: string) {
  const db = new Database(dbPath);

  db.run(`
    PRAGMA journal_mode=WAL;

    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_events(at);
    CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_events(event_type);
  `);

  return db;
}