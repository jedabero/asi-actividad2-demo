import type { CreateReportJobAction } from "../actions";

type Props = {
  action: CreateReportJobAction;
};

export function LastMinuteForm({ action }: Props) {
  return (
    <form action={action} className="rounded-lg border border-zinc-200 p-4">
      <h2 className="text-sm font-semibold">Último minuto</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Reporte de los ultimos 60 segundos.
      </p>
      <input type="hidden" name="windowKind" value="last_minute" />

      <label
        className="mt-3 block text-xs text-zinc-700"
        htmlFor="sensorIdMinute"
      >
        Sensor ID (opcional)
      </label>
      <input
        id="sensorIdMinute"
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
