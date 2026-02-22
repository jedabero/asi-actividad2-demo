import amqp from "amqplib";
import { initTelemetryDb } from "./db";
import { buildTelemetryReport, type ReportJobRequest } from "./report";

const RABBIT_URL = process.env.RABBIT_URL ?? "amqp://guest:guest@localhost:5672";
const DB_PATH = process.env.TELEMETRY_DB_PATH ?? "./telemetry.db";
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS ?? "3");

const JOBS_QUEUE = "jobs.report.request";
const JOBS_DLQ = "jobs.dlq";
const AUDIT_EXCHANGE = "events.audit";

function nowIso() {
  return new Date().toISOString();
}

function getAttempt(msg: amqp.ConsumeMessage) {
  const h = msg.properties.headers ?? {};
  const attempt = Number((h as any)["x-attempt"] ?? 1);
  return Number.isFinite(attempt) && attempt > 0 ? attempt : 1;
}

function validateJob(req: any): asserts req is ReportJobRequest {
  if (!req || typeof req.jobId !== "string") throw new Error("Missing jobId");
  if (req.type !== "telemetry_report") throw new Error("Invalid job type");
  if (!req.window || typeof req.window.kind !== "string") throw new Error("Missing window");
  const k = req.window.kind;
  if (k !== "last_minute" && k !== "last_hour" && k !== "range") throw new Error("Invalid window.kind");
  if (k === "range") {
    if (typeof req.window.from !== "string" || typeof req.window.to !== "string") throw new Error("range requires from/to");
  }
  if (req.sensorId !== undefined && typeof req.sensorId !== "string") throw new Error("sensorId must be string");
}

async function main() {
  const db = initTelemetryDb(DB_PATH);

  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();

  await ch.assertQueue(JOBS_QUEUE, { durable: true });
  await ch.assertQueue(JOBS_DLQ, { durable: true });
  await ch.assertExchange(AUDIT_EXCHANGE, "topic", { durable: true });

  await ch.prefetch(5);

  console.log(`[report-worker] DB: ${DB_PATH}`);
  console.log(`[report-worker] Waiting for jobs on "${JOBS_QUEUE}"...`);

  const qJob = db.query(`SELECT status FROM jobs WHERE job_id = ?`);
  const insJob = db.query(
    `INSERT OR IGNORE INTO jobs(job_id, type, status, created_at, updated_at) VALUES(?, ?, ?, ?, ?)`
  );
  const updJob = db.query(`UPDATE jobs SET status=?, updated_at=? WHERE job_id=?`);
  const insAttempt = db.query(
    `INSERT INTO job_attempts(job_id, attempt_no, error, started_at, ended_at) VALUES(?, ?, ?, ?, ?)`
  );
  const upsertResult = db.query(
    `INSERT OR REPLACE INTO job_results(job_id, result_json, completed_at) VALUES(?, ?, ?)`
  );

  ch.consume(
    JOBS_QUEUE,
    (msg) => {
      if (!msg) return;

      const startedAt = nowIso();
      const attemptNo = getAttempt(msg);

      let jobId = "unknown";

      try {
        const req = JSON.parse(msg.content.toString());
        validateJob(req);
        jobId = req.jobId;

        // Ensure job row exists
        insJob.run(req.jobId, req.type, "queued", startedAt, startedAt);

        // Idempotency: if already completed, ack
        const existing = qJob.get(req.jobId) as any;
        if (existing?.status === "completed") {
          ch.publish(AUDIT_EXCHANGE, "job.idempotent.skip", Buffer.from(JSON.stringify({
            type: "job.idempotent.skip", at: nowIso(), jobId: req.jobId
          })));
          ch.ack(msg);
          return;
        }

        updJob.run("processing", nowIso(), req.jobId);

        ch.publish(AUDIT_EXCHANGE, "job.received", Buffer.from(JSON.stringify({
          type: "job.received", at: nowIso(), jobId: req.jobId, attemptNo
        })));

        // (Opcional) simular un poquito de CPU
        for (let i = 0; i < 2_000_00; i++) { }

        const report = buildTelemetryReport(db, req);

        upsertResult.run(req.jobId, JSON.stringify(report), nowIso());
        updJob.run("completed", nowIso(), req.jobId);
        insAttempt.run(req.jobId, attemptNo, null, startedAt, nowIso());

        // Emit event with result (para que Next UI lo lea)
        ch.publish(AUDIT_EXCHANGE, "job.completed", Buffer.from(JSON.stringify({
          type: "job.completed", at: nowIso(), jobId: req.jobId, result: report
        })));

        ch.ack(msg);
      } catch (e: any) {
        const errMsg = e?.message ?? String(e);

        try {
          insJob.run(jobId, "telemetry_report", "queued", startedAt, startedAt);
          updJob.run("failed", nowIso(), jobId);
          insAttempt.run(jobId, attemptNo, errMsg, startedAt, nowIso());
        } catch { }

        ch.publish(AUDIT_EXCHANGE, "job.failed", Buffer.from(JSON.stringify({
          type: "job.failed", at: nowIso(), jobId, attemptNo, error: errMsg
        })));

        if (attemptNo < MAX_ATTEMPTS) {
          const nextAttempt = attemptNo + 1;
          const delayMs = 500 * nextAttempt;

          setTimeout(() => {
            ch.sendToQueue(JOBS_QUEUE, msg.content, {
              persistent: true,
              headers: { ...(msg.properties.headers ?? {}), "x-attempt": nextAttempt }
            });
          }, delayMs);

          ch.ack(msg);
        } else {
          ch.sendToQueue(JOBS_DLQ, msg.content, { persistent: true, headers: msg.properties.headers });

          ch.publish(AUDIT_EXCHANGE, "job.sent_to_dlq", Buffer.from(JSON.stringify({
            type: "job.sent_to_dlq", at: nowIso(), jobId, attemptNo
          })));

          ch.ack(msg);
        }
      }
    },
    { noAck: false }
  );
}

main().catch((e) => {
  console.error("[report-worker] Fatal:", e);
  process.exit(1);
});