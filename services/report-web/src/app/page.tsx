import { createReportJob, refreshDashboard } from "./actions";
import { listRecentJobs } from "@/lib/db.server";

export const dynamic = "force-dynamic";

function isoToLocal(value: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? value : dt.toLocaleString();
}

function statusClasses(status: string) {
  if (status === "completed") return "bg-emerald-100 text-emerald-900";
  if (status === "failed") return "bg-rose-100 text-rose-900";
  if (status === "dlq") return "bg-amber-100 text-amber-900";
  if (status === "processing") return "bg-sky-100 text-sky-900";
  return "bg-zinc-100 text-zinc-900";
}

function metric(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return value.toFixed(2);
}

export default function Home() {
  const jobs = listRecentJobs(30);

  return (
    <main className="min-h-screen bg-zinc-100 p-4 text-zinc-900 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold">Telemetry Reports</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Crea jobs y consulta su estado desde el read model de web.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <form action={createReportJob} className="rounded-lg border border-zinc-200 p-4">
              <h2 className="text-sm font-semibold">Last Minute</h2>
              <input type="hidden" name="windowKind" value="last_minute" />
              <label className="mt-3 block text-xs text-zinc-700" htmlFor="sensorIdMinute">
                Sensor ID (opcional)
              </label>
              <input
                id="sensorIdMinute"
                name="sensorId"
                type="text"
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                placeholder="sensor-1"
              />
              <button className="mt-3 rounded bg-zinc-900 px-3 py-2 text-sm text-white" type="submit">
                Enqueue
              </button>
            </form>

            <form action={createReportJob} className="rounded-lg border border-zinc-200 p-4">
              <h2 className="text-sm font-semibold">Last Hour</h2>
              <input type="hidden" name="windowKind" value="last_hour" />
              <label className="mt-3 block text-xs text-zinc-700" htmlFor="sensorIdHour">
                Sensor ID (opcional)
              </label>
              <input
                id="sensorIdHour"
                name="sensorId"
                type="text"
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                placeholder="sensor-1"
              />
              <button className="mt-3 rounded bg-zinc-900 px-3 py-2 text-sm text-white" type="submit">
                Enqueue
              </button>
            </form>

            <form action={createReportJob} className="rounded-lg border border-zinc-200 p-4">
              <h2 className="text-sm font-semibold">Custom Range</h2>
              <input type="hidden" name="windowKind" value="range" />
              <label className="mt-3 block text-xs text-zinc-700" htmlFor="rangeFrom">
                From
              </label>
              <input
                id="rangeFrom"
                name="from"
                type="datetime-local"
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                required
              />
              <label className="mt-3 block text-xs text-zinc-700" htmlFor="rangeTo">
                To
              </label>
              <input
                id="rangeTo"
                name="to"
                type="datetime-local"
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                required
              />
              <label className="mt-3 block text-xs text-zinc-700" htmlFor="sensorIdRange">
                Sensor ID (opcional)
              </label>
              <input
                id="sensorIdRange"
                name="sensorId"
                type="text"
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                placeholder="sensor-1"
              />
              <button className="mt-3 rounded bg-zinc-900 px-3 py-2 text-sm text-white" type="submit">
                Enqueue
              </button>
            </form>
          </div>

          <form action={refreshDashboard} className="mt-4">
            <button className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm" type="submit">
              Refresh
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Recent Jobs</h2>

          {jobs.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">No jobs yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {jobs.map((job) => (
                <article key={job.jobId} className="rounded-lg border border-zinc-200 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <code className="rounded bg-zinc-100 px-2 py-1 text-xs">{job.jobId}</code>
                    <span className={`rounded px-2 py-1 text-xs font-medium ${statusClasses(job.status)}`}>
                      {job.status}
                    </span>
                    <span className="text-xs text-zinc-600">updated: {isoToLocal(job.updatedAt)}</span>
                  </div>

                  <div className="mt-2 text-xs text-zinc-700">
                    created: {isoToLocal(job.createdAt)} | completed: {isoToLocal(job.completedAt)}
                  </div>

                  {job.result ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded bg-zinc-900 p-3 text-xs text-zinc-100">
                        <div>
                          window: {isoToLocal(job.result.from)} {"->"} {isoToLocal(job.result.to)}
                        </div>
                        <div>sensor: {job.result.sensorId ?? "all"}</div>
                      </div>
                      <div className="rounded bg-zinc-900 p-3 text-xs text-zinc-100">
                        <div>temp avg/min/max: {metric(job.result.temperatureC?.avg)} / {metric(job.result.temperatureC?.min)} / {metric(job.result.temperatureC?.max)}</div>
                        <div>humidity avg/min/max: {metric(job.result.humidityPct?.avg)} / {metric(job.result.humidityPct?.min)} / {metric(job.result.humidityPct?.max)}</div>
                        <div>count: {job.result.temperatureC?.count ?? "-"}</div>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
