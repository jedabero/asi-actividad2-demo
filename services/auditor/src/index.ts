import amqp from "amqplib";
import { initAuditDb } from "./db";

const RABBIT_URL = process.env.RABBIT_URL ?? "amqp://guest:guest@localhost:5672";
const DB_PATH = process.env.AUDIT_DB_PATH ?? "./audit.db";

const AUDIT_EXCHANGE = "events.audit";

async function main() {
  const db = initAuditDb(DB_PATH);
  const insert = db.query(
    `INSERT INTO audit_events(event_type, payload_json, at) VALUES(?, ?, ?)`
  );

  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();

  await ch.assertExchange(AUDIT_EXCHANGE, "topic", { durable: true });

  // Queue durable para auditoría (no exclusiva)
  const q = await ch.assertQueue("audit.events", { durable: true });

  // Listen EVERYTHING
  await ch.bindQueue(q.queue, AUDIT_EXCHANGE, "#");

  console.log(`[audit] DB: ${DB_PATH}`);
  console.log(`[audit] Listening on "${AUDIT_EXCHANGE}" (#)`);

  ch.consume(
    q.queue,
    (msg) => {
      if (!msg) return;

      try {
        const raw = msg.content.toString();
        const evt = JSON.parse(raw) as any;

        const type = typeof evt?.type === "string" ? evt.type : "unknown";
        const at = typeof evt?.at === "string" ? evt.at : new Date().toISOString();

        insert.run(type, raw, at);
        ch.ack(msg);
      } catch (e: any) {
        console.error("[audit] Parse error:", e?.message ?? e);
        // descartamos evento corrupto
        ch.nack(msg, false, false);
      }
    },
    { noAck: false }
  );
}

main().catch((e) => {
  console.error("[audit] Fatal:", e);
  process.exit(1);
});