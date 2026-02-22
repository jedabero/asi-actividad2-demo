import { Database } from "bun:sqlite";

export type Window =
  | { kind: "last_minute" }
  | { kind: "last_hour" }
  | { kind: "range"; from: string; to: string };

export type ReportJobRequest = {
  jobId: string;
  type: "telemetry_report";
  sensorId?: string;
  window: Window;
  submittedAt: string;
};

export type Stats = {
  count: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
  stddev: number;
};

export type TelemetryReport = {
  sensorId?: string;
  from: string;
  to: string;
  temperatureC: Stats;
  humidityPct: Stats;
};

type Range = { from: string; to: string };
type WindowKind = Window["kind"];
type WindowStrategy<K extends WindowKind> = (window: Extract<Window, { kind: K }>) => Range;

const WINDOW_STRATEGIES: { [K in WindowKind]: WindowStrategy<K> } = {
  last_minute: () => {
    const now = Date.now();
    return { from: new Date(now - 60_000).toISOString(), to: new Date(now).toISOString() };
  },
  last_hour: () => {
    const now = Date.now();
    return { from: new Date(now - 3_600_000).toISOString(), to: new Date(now).toISOString() };
  },
  range: (window) => ({ from: window.from, to: window.to }),
};

function toRange(window: Window): Range {
  const strategy = WINDOW_STRATEGIES[window.kind] as WindowStrategy<typeof window.kind>;
  return strategy(window as Extract<Window, { kind: typeof window.kind }>);
}

function statsForColumn(db: Database, column: "temperature_c" | "humidity_pct", args: { from: string; to: string; sensorId?: string }): Stats {
  const { from, to } = args;
  const sensorId = args.sensorId ?? null;

  const agg = db.query(`
    SELECT
      COUNT(*) as count,
      AVG(${column}) as avg,
      MIN(${column}) as min,
      MAX(${column}) as max
    FROM telemetry_readings
    WHERE recorded_at >= ? AND recorded_at <= ?
      AND (? IS NULL OR sensor_id = ?)
  `).get(from, to, sensorId, sensorId) as any;

  const count = Number(agg?.count ?? 0);
  const avg = Number(agg?.avg ?? 0);
  const min = Number(agg?.min ?? 0);
  const max = Number(agg?.max ?? 0);

  // stddev via E[x^2] - (E[x])^2
  const moments = db.query(`
    SELECT
      AVG(${column}) as avg,
      AVG(${column} * ${column}) as avg2
    FROM telemetry_readings
    WHERE recorded_at >= ? AND recorded_at <= ?
      AND (? IS NULL OR sensor_id = ?)
  `).get(from, to, sensorId, sensorId) as any;

  const avg2 = Number(moments?.avg2 ?? 0);
  const variance = Math.max(avg2 - avg * avg, 0);
  const stddev = Math.sqrt(variance);

  // p95 via ORDER + OFFSET
  let p95 = 0;
  if (count > 0) {
    const offset = Math.max(Math.ceil(0.95 * count) - 1, 0);
    const row = db.query(`
      SELECT ${column} as v
      FROM telemetry_readings
      WHERE recorded_at >= ? AND recorded_at <= ?
        AND (? IS NULL OR sensor_id = ?)
      ORDER BY ${column}
      LIMIT 1 OFFSET ?
    `).get(from, to, sensorId, sensorId, offset) as any;

    p95 = Number(row?.v ?? 0);
  }

  return { count, avg, min, max, p95, stddev };
}

export function buildTelemetryReport(db: Database, req: ReportJobRequest): TelemetryReport {
  const { from, to } = toRange(req.window);

  return {
    sensorId: req.sensorId,
    from,
    to,
    temperatureC: statsForColumn(db, "temperature_c", { from, to, sensorId: req.sensorId }),
    humidityPct: statsForColumn(db, "humidity_pct", { from, to, sensorId: req.sensorId })
  };
}
