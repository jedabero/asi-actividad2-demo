import { Database } from "bun:sqlite";

export type JobStatus = "queued" | "processing" | "completed" | "failed" | "dlq";

export type Stats = {
  count: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
  stddev: number;
};

export type TelemetryReport = {
  sensorId?: string;
  from: string;
  to: string;
  temperatureC: Stats;
  humidityPct: Stats;
};

export type ReportJobView = {
  jobId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  result: TelemetryReport | null;
};

const DB_PATH = process.env.WEB_DB_PATH ?? "/data/web.db";

let db: Database | null = null;

function getDb() {
  if (db) return db;

  db = new Database(DB_PATH);
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

function parseResult(value: string | null): TelemetryReport | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as TelemetryReport;
  } catch {
    return null;
  }
}

export function upsertQueuedJob(jobId: string, at: string) {
  const database = getDb();
  const stmt = database.query(`
    INSERT INTO report_jobs(job_id, status, created_at, updated_at)
    VALUES(?, 'queued', ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET
      status='queued',
      updated_at=excluded.updated_at
  `);
  stmt.run(jobId, at, at);
}

export function updateJobStatus(jobId: string, status: JobStatus, at: string) {
  const database = getDb();
  const stmt = database.query(
    `UPDATE report_jobs SET status=?, updated_at=? WHERE job_id=?`
  );
  stmt.run(status, at, jobId);
}

export function listRecentJobs(limit = 20): ReportJobView[] {
  const database = getDb();
  const stmt = database.query(`
    SELECT
      j.job_id,
      j.status,
      j.created_at,
      j.updated_at,
      r.completed_at,
      r.result_json
    FROM report_jobs j
    LEFT JOIN report_results r ON r.job_id = j.job_id
    ORDER BY j.updated_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as Array<{
    job_id: string;
    status: string;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    result_json: string | null;
  }>;

  return rows.map((row) => ({
    jobId: row.job_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    result: parseResult(row.result_json),
  }));
}
