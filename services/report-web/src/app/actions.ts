"use server";

import amqp from "amqplib";
import { revalidatePath } from "next/cache";
import { upsertQueuedJob, updateJobStatus } from "@/lib/db.server";

type ReportWindow =
  | { kind: "last_minute" }
  | { kind: "last_hour" }
  | { kind: "range"; from: string; to: string };

type ReportJobRequest = {
  jobId: string;
  type: "telemetry_report";
  sensorId?: string;
  window: ReportWindow;
  submittedAt: string;
};

const RABBIT_URL = process.env.RABBIT_URL ?? "amqp://guest:guest@localhost:5672";
const JOBS_QUEUE = "jobs.report.request";

function toIsoDateTime(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    throw new Error("Invalid date");
  }
  return dt.toISOString();
}

function buildWindow(kind: string, from: string, to: string): ReportWindow {
  if (kind === "last_minute") return { kind: "last_minute" };
  if (kind === "last_hour") return { kind: "last_hour" };
  if (kind === "range") {
    if (!from || !to) throw new Error("range requires from and to");
    const fromIso = toIsoDateTime(from);
    const toIso = toIsoDateTime(to);
    if (fromIso >= toIso) throw new Error("from must be before to");
    return { kind: "range", from: fromIso, to: toIso };
  }
  throw new Error("Invalid window kind");
}

function toText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function createReportJob(formData: FormData) {
  const windowKind = toText(formData.get("windowKind")).trim();
  const from = toText(formData.get("from")).trim();
  const to = toText(formData.get("to")).trim();
  const sensorIdRaw = toText(formData.get("sensorId")).trim();
  const sensorId = sensorIdRaw.length > 0 ? sensorIdRaw : undefined;

  const window = buildWindow(windowKind, from, to);
  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();

  const payload: ReportJobRequest = {
    jobId,
    type: "telemetry_report",
    sensorId,
    window,
    submittedAt: now,
  };

  upsertQueuedJob(jobId, now);

  let conn: amqp.ChannelModel | null = null;
  let ch: amqp.ConfirmChannel | null = null;

  try {
    conn = await amqp.connect(RABBIT_URL);
    ch = await conn.createConfirmChannel();
    await ch.assertQueue(JOBS_QUEUE, { durable: true });
    ch.sendToQueue(JOBS_QUEUE, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
      contentType: "application/json",
    });
    await ch.waitForConfirms();
  } catch {
    updateJobStatus(jobId, "failed", new Date().toISOString());
    throw new Error("Could not enqueue report job");
  } finally {
    if (ch) await ch.close();
    if (conn) await conn.close();
  }

  revalidatePath("/");
}

export async function refreshDashboard() {
  revalidatePath("/");
}
