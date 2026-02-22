import type { CreateReportJobAction } from "../actions";

type Props = {
  action: CreateReportJobAction;
};

export function LastDayForm({ action }: Props) {
  return (
    <form action={action} className="rounded-lg border border-zinc-200 p-4">
      <h2 className="text-sm font-semibold">Last Day</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Reporte de las ultimas 24 horas.
      </p>
      <input type="hidden" name="windowKind" value="last_day" />

      <label className="mt-3 block text-xs text-zinc-700" htmlFor="sensorIdDay">
        Sensor ID (opcional)
      </label>
      <input
        id="sensorIdDay"
        name="sensorId"
        type="text"
        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        placeholder="sensor-1"
      />

      <button
        className="mt-3 rounded bg-zinc-900 px-3 py-2 text-sm text-white"
        type="submit"
      >
        Enqueue
      </button>
    </form>
  );
}
