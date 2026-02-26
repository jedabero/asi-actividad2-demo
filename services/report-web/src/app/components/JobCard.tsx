import type { ReportJobView } from "@/lib/db.server";

type Props = {
  job: ReportJobView;
};

function isoToLocal(value: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? value : dt.toLocaleString();
}

function metric(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return value.toFixed(2);
}

function countMetric(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return value.toLocaleString();
}

function shortId(jobId: string) {
  if (jobId.length <= 14) return jobId;
  return `${jobId.slice(0, 8)}...${jobId.slice(-4)}`;
}

function statusClasses(status: string) {
  if (status === "completed") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (status === "failed") return "bg-rose-100 text-rose-900 border-rose-200";
  if (status === "dlq") return "bg-amber-100 text-amber-900 border-amber-200";
  if (status === "processing") return "bg-sky-100 text-sky-900 border-sky-200";
  return "bg-zinc-100 text-zinc-900 border-zinc-200";
}

function statusLabel(status: string) {
  if (status === "completed") return "completado";
  if (status === "failed") return "fallido";
  if (status === "dlq") return "dlq";
  if (status === "processing") return "procesando";
  if (status === "queued") return "en cola";
  return status;
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-zinc-900">{value}</div>
    </div>
  );
}

export function JobCard({ job }: Props) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <code className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700" title={job.jobId}>
          {shortId(job.jobId)}
        </code>
        <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClasses(job.status)}`}>
          {statusLabel(job.status)}
        </span>
        <span className="ml-auto text-xs text-zinc-500">actualizado: {isoToLocal(job.updatedAt)}</span>
      </header>

      <div className="mt-2 text-xs text-zinc-600">
        creado: {isoToLocal(job.createdAt)} | completado: {isoToLocal(job.completedAt)}
      </div>

      {job.result ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <section className="rounded-lg border border-zinc-200 bg-white p-3">
            <div className="text-xs font-semibold text-zinc-700">Contexto</div>
            <div className="mt-2 space-y-1 text-xs text-zinc-700">
              <div>sensor: {job.result.sensorId ?? "todos"}</div>
              <div>desde: {isoToLocal(job.result.from)}</div>
              <div>hasta: {isoToLocal(job.result.to)}</div>
              <div>total: {countMetric(job.result.temperatureC?.count)}</div>
            </div>
          </section>

          <section className="rounded-lg border border-rose-100 bg-rose-50 p-3">
            <div className="text-xs font-semibold text-rose-900">Temperatura (C)</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <StatCell label="Prom" value={metric(job.result.temperatureC?.avg)} />
              <StatCell label="Mín" value={metric(job.result.temperatureC?.min)} />
              <StatCell label="Máx" value={metric(job.result.temperatureC?.max)} />
              <StatCell label="P95" value={metric(job.result.temperatureC?.p95)} />
              <StatCell label="Desv" value={metric(job.result.temperatureC?.stddev)} />
              <StatCell label="Total" value={countMetric(job.result.temperatureC?.count)} />
            </div>
          </section>

          <section className="rounded-lg border border-sky-100 bg-sky-50 p-3">
            <div className="text-xs font-semibold text-sky-900">Humedad (%)</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <StatCell label="Prom" value={metric(job.result.humidityPct?.avg)} />
              <StatCell label="Mín" value={metric(job.result.humidityPct?.min)} />
              <StatCell label="Máx" value={metric(job.result.humidityPct?.max)} />
              <StatCell label="P95" value={metric(job.result.humidityPct?.p95)} />
              <StatCell label="Desv" value={metric(job.result.humidityPct?.stddev)} />
              <StatCell label="Total" value={countMetric(job.result.humidityPct?.count)} />
            </div>
          </section>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
          El resultado aún no está disponible.
        </div>
      )}
    </article>
  );
}
