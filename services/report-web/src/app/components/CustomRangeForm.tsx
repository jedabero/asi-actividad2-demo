import type { CreateReportJobAction } from "../actions";

type Props = {
  action: CreateReportJobAction;
};

export function CustomRangeForm({ action }: Props) {
  return (
    <form action={action} className="rounded-lg border border-zinc-200 p-4">
      <h2 className="text-sm font-semibold">Rango personalizado</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Define fechas exactas para el reporte.
      </p>
      <input type="hidden" name="windowKind" value="range" />

      <label className="mt-3 block text-xs text-zinc-700" htmlFor="rangeFrom">
        Desde
      </label>
      <input
        id="rangeFrom"
        name="from"
        type="datetime-local"
        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        required
      />

      <label className="mt-3 block text-xs text-zinc-700" htmlFor="rangeTo">
        Hasta
      </label>
      <input
        id="rangeTo"
        name="to"
        type="datetime-local"
        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        required
      />

      <label
        className="mt-3 block text-xs text-zinc-700"
        htmlFor="sensorIdRange"
      >
        Sensor ID (opcional)
      </label>
      <input
        id="sensorIdRange"
        name="sensorId"
        type="text"
        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        placeholder="sensor-1"
      />

      <button
        className="mt-3 rounded bg-zinc-900 px-3 py-2 text-sm text-white"
        type="submit"
      >
        Crear job
      </button>
    </form>
  );
}
