import amqp from "amqplib";
import { Database } from "bun:sqlite";

type TelemetryReading = {
  sensorId: string;
  temperatureC: number;
  humidityPct: number;
  recordedAt: string;
};

const RABBIT_URL = process.env.RABBIT_URL ?? "amqp://guest:guest@localhost:5672";
const DB_PATH = process.env.TELEMETRY_DB_PATH ?? "./telemetry.db";

const QUEUE = "telemetry.readings";
const AUDIT_EXCHANGE = "events.audit";

function initDb() {
  const db = new Database(DB_PATH);

  db.run(`
    PRAGMA journal_mode=WAL;

    CREATE TABLE IF NOT EXISTS telemetry_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      temperature_c REAL NOT NULL,
      humidity_pct REAL NOT NULL,
      recorded_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_telemetry_time
      ON telemetry_readings(recorded_at);

    CREATE INDEX IF NOT EXISTS idx_telemetry_sensor_time
      ON telemetry_readings(sensor_id, recorded_at);
  `);

  return db;
}

function isValidReading(r: any): r is TelemetryReading {
  return (
    r &&
    typeof r.sensorId === "string" &&
    typeof r.temperatureC === "number" &&
    typeof r.humidityPct === "number" &&
    typeof r.recordedAt === "string"
  );
}

async function main() {
  const db = initDb();
  const insert = db.query(`
    INSERT INTO telemetry_readings(sensor_id, temperature_c, humidity_pct, recorded_at)
    VALUES(?, ?, ?, ?)
  `);

  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();

  await ch.assertQueue(QUEUE, { durable: true });
  await ch.assertExchange(AUDIT_EXCHANGE, "topic", { durable: true });

  // ingesta rápida: permite lotes pequeños
  await ch.prefetch(100);

  console.log(`[ingestor] DB: ${DB_PATH}`);
  console.log(`[ingestor] Waiting for readings on "${QUEUE}"...`);

  ch.consume(
    QUEUE,
    (msg) => {
      if (!msg) return;

      try {
        const reading = JSON.parse(msg.content.toString());

        if (!isValidReading(reading)) {
          throw new Error("Invalid reading payload");
        }

        insert.run(
          reading.sensorId,
          reading.temperatureC,
          reading.humidityPct,
          reading.recordedAt
        );

        ch.publish(
          AUDIT_EXCHANGE,
          "telemetry.reading.persisted",
          Buffer.from(
            JSON.stringify({
              type: "telemetry.reading.persisted",
              at: new Date().toISOString(),
              reading
            })
          )
        );

        ch.ack(msg);
      } catch (e: any) {
        const errMsg = e?.message ?? String(e);
        console.error("[ingestor] Error:", errMsg);

        // Para demo: descartamos mensajes corruptos (no requeue)
        ch.nack(msg, false, false);

        ch.publish(
          AUDIT_EXCHANGE,
          "telemetry.reading.rejected",
          Buffer.from(
            JSON.stringify({
              type: "telemetry.reading.rejected",
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
  console.error("[ingestor] Fatal:", e);
  process.exit(1);
});