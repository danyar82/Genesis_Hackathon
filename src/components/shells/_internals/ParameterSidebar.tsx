"use client";

import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Sliders, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  formatValue,
  initialValues,
  resolveStep,
  type ParameterSpec,
  type ParamValues,
} from "./types";

type Props = {
  parameters: ParameterSpec[];
  values: ParamValues;
  onChange: (values: ParamValues) => void;
  results?: Record<string, number | string> | null;
  defaultOpen?: boolean;
};

export function ParameterSidebar({
  parameters,
  values,
  onChange,
  results,
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setOpen(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const set = (name: string, v: number) => onChange({ ...values, [name]: v });
  const reset = () => onChange(initialValues(parameters));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Hide parameters" : "Show parameters"}
        aria-expanded={open}
        className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/40 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 backdrop-blur-md transition-colors hover:border-white/25 hover:bg-black/60"
      >
        <Sliders className="h-3 w-3" />
        {open ? "Hide" : "Parameters"}
        {!open && parameters.length > 0 && (
          <span className="ml-0.5 rounded-full bg-violet-500/30 px-1.5 text-[10px] text-violet-100">
            {parameters.length}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.aside
            key="sidebar"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="absolute right-0 top-0 z-10 flex h-full w-full max-w-[280px] flex-col border-l border-white/10 bg-black/55 backdrop-blur-xl sm:max-w-[300px]"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 pr-14">
              <div className="flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                  Parameters
                </span>
              </div>
              <button
                type="button"
                onClick={reset}
                disabled={parameters.length === 0}
                className="inline-flex items-center gap-1 rounded-md border border-white/5 bg-white/[0.02] px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-zinc-200 disabled:opacity-40"
                title="Reset to defaults"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {parameters.length === 0 ? (
                <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
                  <X className="h-4 w-4 text-zinc-600" />
                  <span className="text-xs text-zinc-500">
                    No parameters for this visualization.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {parameters.map((p) => {
                    const v = values[p.name] ?? p.default;
                    const step = resolveStep(p);
                    const frac =
                      (v - p.min) / Math.max(1e-9, p.max - p.min);
                    return (
                      <div key={p.name} className="group">
                        <div className="flex items-baseline justify-between gap-2">
                          <label
                            htmlFor={`param-${p.name}`}
                            className="truncate text-[13px] font-medium text-zinc-200"
                          >
                            {p.name}
                          </label>
                          <span className="font-mono text-[11px] tabular-nums text-violet-200">
                            {formatValue(v, p)}
                          </span>
                        </div>
                        {p.description ? (
                          <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                            {p.description}
                          </p>
                        ) : null}
                        <input
                          id={`param-${p.name}`}
                          type="range"
                          min={p.min}
                          max={p.max}
                          step={step}
                          value={v}
                          onChange={(e) => set(p.name, Number(e.target.value))}
                          className="mt-2 w-full accent-violet-400"
                          style={{
                            background: `linear-gradient(90deg, rgba(139,92,246,0.55) 0%, rgba(6,182,212,0.45) ${frac * 100}%, rgba(255,255,255,0.06) ${frac * 100}%)`,
                            borderRadius: 999,
                            height: 4,
                            appearance: "none",
                            WebkitAppearance: "none",
                          }}
                        />
                        <div className="mt-1 flex justify-between font-mono text-[9px] text-zinc-600">
                          <span>{formatValue(p.min, p)}</span>
                          <span>{formatValue(p.max, p)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {results && Object.keys(results).length > 0 && (
                <div className="mt-6 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                    Results
                  </div>
                  <dl className="flex flex-col gap-1.5">
                    {Object.entries(results).map(([k, val]) => (
                      <div key={k} className="flex items-baseline justify-between gap-3">
                        <dt className="truncate text-[11px] text-zinc-400">{k}</dt>
                        <dd className="font-mono text-[11px] tabular-nums text-cyan-200">
                          {typeof val === "number"
                            ? Number.isInteger(val)
                              ? val
                              : val.toFixed(3)
                            : val}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
