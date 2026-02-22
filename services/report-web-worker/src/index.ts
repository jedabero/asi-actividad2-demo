import amqp from "amqplib";
import { initWebDb } from "./db";

const RABBIT_URL = process.env.RABBIT_URL ?? "amqp://guest:guest@localhost:5672";
const DB_PATH = process.env.WEB_DB_PATH ?? "./web.db";

const AUDIT_EXCHANGE = "events.audit";
const REPORTS_QUEUE = "report-web.events";
const JOBS = "job.*";

async function main() {
  const db = initWebDb(DB_PATH);

  // prepared statements
  const upsertJob = db.query(`
    INSERT INTO report_jobs(job_id, status, created_at, updated_at)
    VALUES(?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET
      status=excluded.status,
      updated_at=excluded.updated_at
  `);

  const upsertResult = db.query(`
    INSERT OR REPLACE INTO report_results(job_id, result_json, completed_at)
    VALUES(?, ?, ?)
  `);

  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();

  await ch.assertExchange(AUDIT_EXCHANGE, "topic", { durable: true });
  await ch.assertQueue(REPORTS_QUEUE, { durable: true });
  await ch.bindQueue(REPORTS_QUEUE, AUDIT_EXCHANGE, JOBS);

  await ch.prefetch(20);

  console.log(`[report-web-worker] DB: ${DB_PATH}`);
  console.log(`[report-web-worker] Waiting for reports on "${REPORTS_QUEUE}" "${JOBS}"...`);

  ch.consume(
    REPORTS_QUEUE,
    (msg) => {
      if (!msg) return;

      try {
        const event = JSON.parse(msg.content.toString());

        const type = event?.type;
        const jobId = event?.jobId;
        const at = typeof event?.at === "string" ? event.at : new Date().toISOString();

        if (typeof jobId !== "string" || typeof type !== "string") {
          // evento sin forma esperada: ack y fuera
          ch.ack(msg);
          return;
        }

        if (type === "job.received") {
          upsertJob.run(jobId, "processing", at, at);
        } else if (type === "job.failed") {
          upsertJob.run(jobId, "failed", at, at);
        } else if (type === "job.sent_to_dlq") {
          upsertJob.run(jobId, "dlq", at, at);
        } else if (type === "job.completed") {
          upsertJob.run(jobId, "completed", at, at);
          if (event.result !== undefined) {
            upsertResult.run(jobId, JSON.stringify(event.result), at);
          }
        }

        ch.ack(msg);
      } catch (e: any) {
        const errMsg = e?.message ?? String(e);
        console.error("[report-web-worker] Error:", errMsg);

        // Para demo: descartamos mensajes corruptos (no requeue)
        ch.nack(msg, false, false);

        const rejectedType = "report-web.event.rejected";
        ch.publish(
          AUDIT_EXCHANGE,
          rejectedType,
          Buffer.from(
            JSON.stringify({
              type: rejectedType,
              at: new Date().toISOString(),
              error: errMsg,
              raw: msg.content.toString()
            })
          )
        );
      }
    },
    { noAck: false }
  );
}

main().catch((e) => {
  console.error("[report-web-worker] Fatal:", e);
  process.exit(1);
});