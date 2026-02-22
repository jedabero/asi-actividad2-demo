import { Database } from "bun:sqlite";

export function initTelemetryDb(dbPath: string) {
  const db = new Database(dbPath);

  db.exec(`
    PRAGMA journal_mode=WAL;

    -- readings (created by ingestor; safe to re-run)
    CREATE TABLE IF NOT EXISTS telemetry_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      temperature_c REAL NOT NULL,
      humidity_pct REAL NOT NULL,
      recorded_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_telemetry_time ON telemetry_readings(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_telemetry_sensor_time ON telemetry_readings(sensor_id, recorded_at);

    -- jobs
    CREATE TABLE IF NOT EXISTS jobs (
      job_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      attempt_no INTEGER NOT NULL,
      error TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_results (
      job_id TEXT PRIMARY KEY,
      result_json TEXT NOT NULL,
      completed_at TEXT NOT NULL
    );
  `);

  return db;
}