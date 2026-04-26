"use client";

import { Sigma } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Equation } from "../Equation";
import { ShellFrame } from "./_internals/ShellFrame";
import { initialValues, type ParameterSpec, type ParamValues } from "./_internals/types";

type Props = {
  equations: string[];
  parameters: ParameterSpec[];
  computeFn?: (params: ParamValues) => Record<string, number | string>;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  className?: string;
};

export function MathExplorerShell({
  equations,
  parameters,
  computeFn,
  title = "Equation Explorer",
  subtitle,
  loading = false,
  className,
}: Props) {
  const [values, setValues] = useState<ParamValues>(() =>
    initialValues(parameters),
  );

  const results = useMemo<Record<string, number | string> | null>(() => {
    if (!computeFn) return null;
    try {
      return computeFn(values) ?? null;
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[MathExplorerShell] computeFn threw:", err);
      }
      return { error: (err as Error).message };
    }
  }, [computeFn, values]);

  const handleChange = useCallback(
    (v: ParamValues) => setValues(v),
    [],
  );

  return (
    <ShellFrame
      title={title}
      subtitle={subtitle ?? `${equations.length} equation${equations.length === 1 ? "" : "s"}`}
      parameters={parameters}
      values={values}
      onChange={handleChange}
      results={results}
      loading={loading}
      loadingLabel="Preparing equations…"
      className={className}
    >
      <div className="flex h-full w-full flex-col gap-3 overflow-y-auto px-6 pb-6 pt-12">
        {equations.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-zinc-500">
            No equations provided
          </div>
        ) : (
          equations.map((eq, i) => (
            <div
              key={i}
              className="group relative rounded-lg border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-4 transition-colors hover:border-white/15"
            >
              <div className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-black/40">
                <Sigma className="h-3 w-3 text-violet-300" />
              </div>
              <div className="mb-1 ml-9 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                Equation {i + 1}
              </div>
              <Equation
                latex={eq}
                displayMode
                className="ml-9 overflow-x-auto text-zinc-100"
              />
              <details className="ml-9 mt-2">
                <summary className="cursor-pointer text-[10px] text-zinc-600 transition-colors hover:text-zinc-400">
                  raw LaTeX
                </summary>
                <pre className="mt-1 overflow-x-auto rounded border border-white/5 bg-black/40 p-2 font-mono text-[10px] text-zinc-500">
                  {eq}
                </pre>
              </details>
            </div>
          ))
        )}
      </div>
    </ShellFrame>
  );
}

export default MathExplorerShell;
