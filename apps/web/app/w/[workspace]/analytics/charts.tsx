"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { CATEGORICAL, CHART, STATUS } from "@/lib/viz";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui";

/**
 * Analytics charts (Recharts, client). Fed by server-aggregated, serializable
 * props — the server never ships raw rows here and the charts never fabricate
 * data (empty subsets just render empty axes). Animation honors
 * prefers-reduced-motion; every chart carries an aria-label and the page keeps a
 * full data table as the accessible fallback.
 */

// --- shared ---------------------------------------------------------------

/** Live prefers-reduced-motion flag so Recharts JS animations can be disabled. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export type MonthPoint = {
  month: string;
  clicks: number;
  impressions: number;
  position: number | null;
};

const AXIS = { fontSize: 11, fill: CHART.axis, fontFamily: "'JetBrains Mono', monospace" };

const tipStyle = {
  borderRadius: 8,
  border: `1px solid ${CHART.grid}`,
  fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  boxShadow: "0 4px 12px -2px rgba(10,58,86,0.16)",
};

const RANGES = [
  { label: "3m", months: 3 },
  { label: "6m", months: 6 },
  { label: "12m", months: 12 },
  { label: "All", months: 0 },
] as const;

// --- time series (clicks/impressions + position) --------------------------

export function TimeSeriesCharts({ series }: { series: MonthPoint[] }) {
  const reduced = useReducedMotion();
  const [months, setMonths] = useState(0);
  const data = months > 0 ? series.slice(-months) : series;
  const hasPosition = data.some((d) => d.position != null);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-ink">
          Clicks &amp; impressions by month
        </h2>
        <div className="flex gap-1" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setMonths(r.months)}
              aria-pressed={months === r.months}
              className={cx(
                "rounded px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums transition-colors",
                months === r.months
                  ? "bg-blue text-white"
                  : "bg-paper2 text-ink/60 hover:text-ink",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="clicksFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={STATUS.good} stopOpacity={0.35} />
              <stop offset="100%" stopColor={STATUS.good} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={{ stroke: CHART.grid }} />
          <YAxis yAxisId="left" tick={AXIS} tickLine={false} axisLine={false} width={44} />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip contentStyle={tipStyle} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="clicks"
            name="Clicks"
            stroke={STATUS.good}
            strokeWidth={2.5}
            fill="url(#clicksFill)"
            isAnimationActive={!reduced}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="impressions"
            name="Impressions"
            stroke={CATEGORICAL[1]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={!reduced}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-1 flex gap-4 text-[0.62rem] text-ink/50">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: STATUS.good }} /> Clicks (left)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: CATEGORICAL[1] }} /> Impressions
          (right)
        </span>
      </div>

      {hasPosition && (
        <>
          <h3 className="mb-1 mt-5 font-display text-sm font-semibold text-ink">
            Average position over time
            <span className="ml-1 font-sans text-[0.6rem] font-normal text-ink/40">
              (lower is better)
            </span>
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={{ stroke: CHART.grid }} />
              <YAxis
                reversed
                domain={[1, (max: number) => Math.ceil(max + 1)]}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                width={44}
                allowDecimals={false}
              />
              <Tooltip contentStyle={tipStyle} />
              <Line
                type="monotone"
                dataKey="position"
                name="Avg position"
                stroke={CATEGORICAL[2]}
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: CATEGORICAL[2] }}
                connectNulls
                isAnimationActive={!reduced}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

// --- top pages horizontal bar ---------------------------------------------

export function TopPagesBar({
  pages,
}: {
  pages: Array<{ name: string; clicks: number }>;
}) {
  const reduced = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, pages.length * 38)}>
      <BarChart data={pages} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={CHART.grid} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: CHART.grid }} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ ...AXIS, fontFamily: "Quicksand, sans-serif" }}
          tickLine={false}
          axisLine={false}
          width={130}
        />
        <Tooltip contentStyle={tipStyle} cursor={{ fill: "rgba(13,90,132,0.06)" }} />
        <Bar dataKey="clicks" name="Clicks" radius={[0, 4, 4, 0]} isAnimationActive={!reduced}>
          {pages.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// --- position × clicks quadrant scatter -----------------------------------

export type ScatterPoint = {
  title: string;
  position: number;
  clicks: number;
  protected: boolean;
};

export function PerformanceScatter({
  points,
  clicksMid,
}: {
  points: ScatterPoint[];
  clicksMid: number;
}) {
  const reduced = useReducedMotion();
  const maxClicks = Math.max(...points.map((p) => p.clicks), clicksMid, 1);
  const maxPos = Math.max(...points.map((p) => p.position), 10);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 12, right: 16, bottom: 16, left: -4 }}>
        <CartesianGrid stroke={CHART.grid} />
        {/* Refresh zone: poor position (>10). Protect zone: strong clicks + good position. */}
        <ReferenceArea
          x1={10}
          x2={maxPos}
          y1={0}
          y2={maxClicks}
          fill={STATUS.warn}
          fillOpacity={0.05}
        />
        <ReferenceArea
          x1={1}
          x2={10}
          y1={clicksMid}
          y2={maxClicks}
          fill={STATUS.good}
          fillOpacity={0.05}
        />
        <ReferenceLine x={10} stroke={STATUS.warn} strokeDasharray="4 4" />
        <XAxis
          type="number"
          dataKey="position"
          name="Position"
          reversed
          domain={[1, Math.ceil(maxPos + 1)]}
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: CHART.grid }}
          label={{ value: "Position →", position: "insideBottomLeft", fontSize: 10, fill: CHART.axis }}
        />
        <YAxis
          type="number"
          dataKey="clicks"
          name="Clicks"
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <ZAxis range={[70, 70]} />
        <Tooltip contentStyle={tipStyle} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={points} isAnimationActive={!reduced}>
          {points.map((p, i) => (
            <Cell key={i} fill={p.protected ? STATUS.info : p.position > 10 ? STATUS.warn : STATUS.good} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// --- CSV export -----------------------------------------------------------

export function CsvExportButton({
  rows,
  headers,
  filename,
}: {
  rows: Array<Array<string | number>>;
  headers: string[];
  filename: string;
}) {
  const csv = useMemo(() => {
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  }, [rows, headers]);

  function download() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={download}
      disabled={rows.length === 0}
      leftIcon={<Download className="h-3.5 w-3.5" aria-hidden />}
    >
      Export CSV
    </Button>
  );
}
