"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ShellFrame } from "./_internals/ShellFrame";
import { initialValues, type ParameterSpec, type ParamValues } from "./_internals/types";

type DataPoint = Record<string, number | string>;

type Props = {
  data?: DataPoint[];
  parameters: ParameterSpec[];
  computeFn?: (params: ParamValues) => DataPoint[];
  xKey?: string;
  yKeys?: string[];
  title?: string;
  subtitle?: string;
  loading?: boolean;
  className?: string;
};

const LINE_COLORS = [
  "#a78bfa",
  "#22d3ee",
  "#60a5fa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
];

function inferYKeys(row: DataPoint | undefined, xKey: string): string[] {
  if (!row) return [];
  return Object.keys(row).filter(
    (k) => k !== xKey && typeof row[k] === "number",
  );
}

function inferXKey(row: DataPoint | undefined): string {
  if (!row) return "x";
  const keys = Object.keys(row);
  const preferred = keys.find((k) => /^(x|t|time|step|i|n)$/i.test(k));
  return preferred ?? keys[0] ?? "x";
}

export function RechartsSimulationShell({
  data: initialData,
  parameters,
  computeFn,
  xKey,
  yKeys,
  title = "Simulation",
  subtitle,
  loading = false,
  className,
}: Props) {
  const [values, setValues] = useState<ParamValues>(() =>
    initialValues(parameters),
  );

  const data: DataPoint[] = useMemo(() => {
    if (computeFn) {
      try {
        return computeFn(values) ?? [];
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[RechartsSimulationShell] computeFn threw:", err);
        }
        return [];
      }
    }
    return initialData ?? [];
  }, [computeFn, values, initialData]);

  const resolvedXKey = xKey ?? inferXKey(data[0]);
  const resolvedYKeys = useMemo(
    () => yKeys ?? inferYKeys(data[0], resolvedXKey),
    [yKeys, data, resolvedXKey],
  );

  const handleChange = useCallback(
    (v: ParamValues) => setValues(v),
    [],
  );

  const defaultSubtitle =
    subtitle ??
    `${data.length} pts · ${resolvedYKeys.length} series`;

  return (
    <ShellFrame
      title={title}
      subtitle={defaultSubtitle}
      parameters={parameters}
      values={values}
      onChange={handleChange}
      loading={loading}
      loadingLabel="Computing simulation…"
      className={className}
    >
      <div className="h-full w-full px-4 pb-4 pt-10">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-zinc-500">
            No data to display
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis
                dataKey={resolvedXKey}
                stroke="rgba(255,255,255,0.45)"
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.55)" }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.45)"
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.55)" }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(10,10,20,0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "#e5e7eb",
                  backdropFilter: "blur(8px)",
                }}
                labelStyle={{ color: "#a1a1aa", fontSize: 10 }}
                cursor={{ stroke: "rgba(139,92,246,0.35)", strokeWidth: 1 }}
              />
              {resolvedYKeys.length > 1 && (
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="line"
                />
              )}
              {resolvedYKeys.map((k, i) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={1.75}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </ShellFrame>
  );
}

export default RechartsSimulationShell;
