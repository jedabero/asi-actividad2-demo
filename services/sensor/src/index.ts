import amqp from "amqplib";

export type TelemetryReading = {
  sensorId: string;
  temperatureC: number;
  humidityPct: number;
  recordedAt: string;
};

const RABBIT_URL = process.env.RABBIT_URL ?? "amqp://guest:guest@localhost:5672";
const SENSOR_ID = process.env.SENSOR_ID ?? "sensor-1";
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? "1000");

const QUEUE = "telemetry.readings";
const AUDIT_EXCHANGE = "events.audit";

function makeReading(): TelemetryReading {
  const temperatureC = 10 + Math.random() * 30;     // C 10..40
  const humidityPct = 30 + Math.random() * 60;      // % 30..90

  return {
    sensorId: SENSOR_ID,
    temperatureC: Number(temperatureC.toFixed(2)),
    humidityPct: Number(humidityPct.toFixed(2)),
    recordedAt: new Date().toISOString()
  };
}

async function main() {
  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();

  await ch.assertQueue(QUEUE, { durable: true });
  await ch.assertExchange(AUDIT_EXCHANGE, "topic", { durable: true });

  console.log(
    `[sensor] Publishing to "${QUEUE}" every ${INTERVAL_MS}ms as ${SENSOR_ID}`
  );

  setInterval(() => {
    const reading = makeReading();

    ch.sendToQueue(QUEUE, Buffer.from(JSON.stringify(reading)), { persistent: true });

    ch.publish(
      AUDIT_EXCHANGE,
      "telemetry.reading.published",
      Buffer.from(
        JSON.stringify({ type: "telemetry.reading.published", at: new Date().toISOString(), reading })
      )
    );

    console.log(
      `[sensor] ➡️ T=${reading.temperatureC}C H=${reading.humidityPct}% @ ${reading.recordedAt}`
    );
  }, INTERVAL_MS);
}

main().catch((e) => {
  console.error("[sensor] Fatal:", e);
  process.exit(1);
});