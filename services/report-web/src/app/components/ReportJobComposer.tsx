"use client";

import { useMemo, useState } from "react";
import { LastMinuteForm } from "./LastMinuteForm";
import { LastHourForm } from "./LastHourForm";
import { LastDayForm } from "./LastDayForm";
import { CustomRangeForm } from "./CustomRangeForm";
import type { CreateReportJobAction, WindowKind } from "../actions";

type Props = {
  createReportJob: CreateReportJobAction;
};

const OPTIONS: Array<{ value: WindowKind; label: string }> = [
  { value: "last_minute", label: "Último minuto" },
  { value: "last_hour", label: "Última hora" },
  { value: "last_day", label: "Último día" },
  { value: "range", label: "Rango personalizado" },
];

export function ReportJobComposer({ createReportJob }: Props) {
  const [windowKind, setWindowKind] = useState<WindowKind>("last_minute");

  const selectedLabel = useMemo(
    () =>
      OPTIONS.find((opt) => opt.value === windowKind)?.label ?? "Último minuto",
    [windowKind],
  );

  return (
    <div className="mt-5 rounded-lg border border-zinc-200 p-4">
      <label className="block text-xs text-zinc-700" htmlFor="windowKindSelect">
        Ventana de reporte
      </label>
      <select
        id="windowKindSelect"
        className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm md:max-w-xs"
        value={windowKind}
        onChange={(e) => setWindowKind(e.target.value as WindowKind)}
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <p className="mt-2 text-xs text-zinc-600">Seleccionado: {selectedLabel}</p>

      <div className="mt-4">
        {windowKind === "last_minute" ? (
          <LastMinuteForm action={createReportJob} />
        ) : null}
        {windowKind === "last_hour" ? (
          <LastHourForm action={createReportJob} />
        ) : null}
        {windowKind === "last_day" ? (
          <LastDayForm action={createReportJob} />
        ) : null}
        {windowKind === "range" ? (
          <CustomRangeForm action={createReportJob} />
        ) : null}
      </div>
    </div>
  );
}
