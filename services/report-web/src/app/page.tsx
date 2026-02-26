import { createReportJob, refreshDashboard } from "./actions";
import { listRecentJobs } from "@/lib/db.server";
import { ReportJobComposer } from "./components/ReportJobComposer";
import { JobCard } from "./components/JobCard";

export const dynamic = "force-dynamic";

export default function Home() {
  const jobs = listRecentJobs(30);

  return (
    <main className="min-h-screen bg-zinc-100 p-4 text-zinc-900 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold">Reportes de Telemetría</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Crea jobs y consulta su estado.
          </p>

          <ReportJobComposer createReportJob={createReportJob} />

          <form action={refreshDashboard} className="mt-4">
            <button
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
              type="submit"
            >
              Actualizar
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Jobs Recientes</h2>

          {jobs.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">Todavía no hay jobs.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {jobs.map((job) => (
                <JobCard key={job.jobId} job={job} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
