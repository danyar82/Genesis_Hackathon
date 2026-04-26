"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Rocket,
  Sparkles,
  Telescope,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Discovery,
  DiscoveryProbe,
  KernelObservation,
} from "@/types/discovery";

const MAX_TOOL_CALLS = 12;

const CATEGORY_STYLES: Record<
  Discovery["category"],
  { Icon: typeof Sparkles; chip: string; label: string }
> = {
  phase_transition: {
    Icon: Zap,
    chip: "border-violet-400/40 bg-violet-500/10 text-violet-200",
    label: "Phase transition",
  },
  chaos_boundary: {
    Icon: Telescope,
    chip: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200",
    label: "Chaos boundary",
  },
  optimal_point: {
    Icon: Rocket,
    chip: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    label: "Optimal point",
  },
  edge_of_stability: {
    Icon: AlertCircle,
    chip: "border-amber-400/40 bg-amber-500/10 text-amber-200",
    label: "Edge of stability",
  },
  surprising_stability: {
    Icon: CheckCircle2,
    chip: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200",
    label: "Surprising stability",
  },
  resonance: {
    Icon: Sparkles,
    chip: "border-pink-400/40 bg-pink-500/10 text-pink-200",
    label: "Resonance",
  },
  other: {
    Icon: Sparkles,
    chip: "border-zinc-400/30 bg-zinc-500/10 text-zinc-200",
    label: "Discovery",
  },
};

type Props = {
  paperDna: {
    code_kernel: string;
    parameters: Array<Record<string, unknown>>;
    title: string;
    classification: string;
    visualization_type: string;
  };
  onClose: () => void;
  onApply: (parameters: Record<string, number>, discoveryId: string) => void;
  activeDiscoveryId: string | null;
};

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (Number.isInteger(v)) return String(v);
  const abs = Math.abs(v);
  if (abs === 0) return "0";
  if (abs >= 1000 || abs < 0.001) return v.toExponential(2);
  if (abs >= 1) return v.toFixed(3);
  return v.toFixed(4);
}

/** MM:SS for the discovery countdown. Clamps negatives to 00:00. */
function formatClock(secondsRemaining: number): string {
  const safe = Math.max(0, Math.ceil(secondsRemaining));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ProbeMiniSummary({ obs }: { obs: KernelObservation | null }) {
  if (obs === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-violet-300">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        running…
      </span>
    );
  }
  if (!obs.ok) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-red-300">
        <AlertCircle className="h-2.5 w-2.5" />
        {(obs.errors?.[0] ?? "error").slice(0, 60)}
      </span>
    );
  }
  if (obs.shape === "rows" || obs.shape === "snapshots") {
    const series = obs.series ?? {};
    const firstKey = Object.keys(series)[0];
    if (!firstKey) {
      return (
        <span className="text-[10px] text-zinc-400">
          {obs.rowCount ?? 0} rows · no numeric series
        </span>
      );
    }
    const s = series[firstKey];
    const status = s.diverged
      ? { tone: "text-red-300", word: "DIVERGED" }
      : s.monotonic !== "neither"
        ? { tone: "text-cyan-300", word: s.monotonic }
        : { tone: "text-emerald-300", word: "stable" };
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400">
        <span className="font-mono text-zinc-500">{firstKey}</span>
        <span className="text-zinc-600">·</span>
        <span className={status.tone}>{status.word}</span>
        <span className="text-zinc-600">·</span>
        <span className="font-mono">final {formatNumber(s.final)}</span>
        {s.oscillation_count > 2 && (
          <>
            <span className="text-zinc-600">·</span>
            <span className="text-amber-300">~{s.oscillation_count} oscillations</span>
          </>
        )}
      </span>
    );
  }
  if (obs.shape === "record") {
    const scalars = obs.scalars ?? {};
    const entries = Object.entries(scalars).slice(0, 2);
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-[10px] text-zinc-400">
        {entries.map(([k, v]) => (
          <span key={k} className="font-mono">
            <span className="text-zinc-500">{k}=</span>
            {typeof v === "number" ? formatNumber(v) : String(v)}
          </span>
        ))}
      </span>
    );
  }
  if (obs.shape === "particles") {
    const s = obs.scalars ?? {};
    return (
      <span className="text-[10px] text-zinc-400">
        {String(s.count ?? 0)} particles ·{" "}
        spread {formatNumber(Number(s.spread ?? 0))}
        {Number(s.diverged ?? 0) > 0 && (
          <span className="ml-1 text-red-300">DIVERGED</span>
        )}
      </span>
    );
  }
  return null;
}

export function DiscoveriesSidebar({
  paperDna,
  onClose,
  onApply,
  activeDiscoveryId,
}: Props) {
  const [phase, setPhase] = useState<
    "running" | "complete" | "error" | "empty"
  >("running");
  const [probes, setProbes] = useState<DiscoveryProbe[]>([]);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const probesScrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);

  // 60s soft target — surfaces a countdown even though the route's hard
  // deadline is 80s. Most runs finish well before this; the bar/label cap
  // gracefully if a run goes past 60s.
  const BUDGET_SECONDS = 60;

  // Tick the elapsed-time counter while running; stops automatically when
  // phase changes (effect re-runs and the !running branch returns).
  useEffect(() => {
    if (phase !== "running") {
      startedAtRef.current = null;
      return;
    }
    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now();
      setElapsedSec(0);
    }
    const interval = window.setInterval(() => {
      if (startedAtRef.current === null) return;
      setElapsedSec((Date.now() - startedAtRef.current) / 1000);
    }, 250);
    return () => window.clearInterval(interval);
  }, [phase]);

  const startDiscovery = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("running");
    setProbes([]);
    setDiscoveries([]);
    setErrorMessage(null);
    setThinking(null);
    setElapsedSec(0);
    startedAtRef.current = Date.now();

    try {
      const res = await fetch("/api/agent/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kernel: paperDna.code_kernel,
          params: paperDna.parameters,
          paperTitle: paperDna.title,
          classification: paperDna.classification,
          vizType: paperDna.visualization_type,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIdx: number;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);

          let eventName = "message";
          const dataParts: string[] = [];
          for (const line of raw.split("\n")) {
            if (line.startsWith("event: ")) eventName = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataParts.push(line.slice(6));
          }
          const dataText = dataParts.join("\n");
          if (!dataText) continue;

          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataText);
          } catch {
            continue;
          }

          if (eventName === "discovery_probe") {
            const id = typeof data.id === "string" ? data.id : "";
            const params =
              data.params && typeof data.params === "object"
                ? (data.params as Record<string, number>)
                : {};
            const rationale =
              typeof data.rationale === "string" ? data.rationale : "";
            const observation =
              data.observation === null
                ? null
                : (data.observation as KernelObservation);

            setProbes((prev) => {
              const idx = prev.findIndex((p) => p.id === id);
              if (idx === -1) {
                return [...prev, { id, parameters: params, rationale, observation }];
              }
              const next = [...prev];
              next[idx] = { id, parameters: params, rationale, observation };
              return next;
            });
          } else if (eventName === "discovery_thinking") {
            const text = typeof data.text === "string" ? data.text : "";
            if (text) setThinking(text.slice(0, 240));
          } else if (eventName === "discoveries_done") {
            const arr = Array.isArray(data.discoveries)
              ? (data.discoveries as Discovery[])
              : [];
            setDiscoveries(arr);
            setPhase(arr.length > 0 ? "complete" : "empty");
            return;
          } else if (eventName === "error") {
            throw new Error(
              typeof data.message === "string"
                ? data.message
                : "Discovery failed",
            );
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setErrorMessage((e as Error).message);
      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  }, [paperDna]);

  // Auto-start once on mount
  useEffect(() => {
    startDiscovery();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll probes pane
  useEffect(() => {
    const el = probesScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [probes.length]);

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="fixed inset-x-2 top-20 z-30 flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-xl border border-violet-400/20 bg-black/80 shadow-[0_0_60px_-15px_rgba(139,92,246,0.45)] backdrop-blur-xl sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-[380px]"
    >
      <div className="shrink-0 border-b border-white/10 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-violet-200">
              <Telescope className="h-3 w-3" />
              Discoveries
              <span className="text-zinc-600">·</span>
              <span className="font-mono text-zinc-400">
                {probes.length}/{MAX_TOOL_CALLS} probes
              </span>
            </div>
            {phase === "running" && (
              <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] text-violet-300">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {elapsedSec >= BUDGET_SECONDS ? "Finalizing…" : "Hunting…"}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close discoveries panel"
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] p-1.5 text-zinc-400 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {phase === "running" && (
          <div className="mt-3">
            {/* Big MM:SS countdown — the visual punctuation the demo needs */}
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span
                  className={`font-mono text-2xl font-semibold tabular-nums tracking-tight transition-colors ${
                    elapsedSec >= BUDGET_SECONDS
                      ? "text-amber-300"
                      : elapsedSec >= BUDGET_SECONDS - 10
                        ? "text-violet-200"
                        : "text-violet-100"
                  }`}
                  style={{
                    textShadow:
                      elapsedSec >= BUDGET_SECONDS - 10
                        ? "0 0 12px rgba(167, 139, 250, 0.55)"
                        : "0 0 8px rgba(167, 139, 250, 0.25)",
                  }}
                >
                  {formatClock(BUDGET_SECONDS - elapsedSec)}
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  {elapsedSec >= BUDGET_SECONDS ? "wrapping up" : "remaining"}
                </span>
              </div>
              <span className="font-mono text-[10px] tabular-nums text-zinc-500">
                {Math.min(BUDGET_SECONDS, Math.floor(elapsedSec))}/{BUDGET_SECONDS}s
              </span>
            </div>

            {/* Thicker, glowing progress bar */}
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={BUDGET_SECONDS}
              aria-valuenow={Math.min(BUDGET_SECONDS, elapsedSec)}
            >
              <div
                className="relative h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400"
                style={{
                  width: `${Math.min(100, (elapsedSec / BUDGET_SECONDS) * 100)}%`,
                  transition: "width 250ms linear",
                  boxShadow:
                    "0 0 14px rgba(167, 139, 250, 0.55), 0 0 6px rgba(34, 211, 238, 0.4)",
                }}
              >
                <span
                  aria-hidden
                  className="absolute right-0 top-0 h-full w-3 rounded-full bg-white/30 blur-[2px]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {/* DISCOVERIES (top of panel once available) */}
        {discoveries.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {discoveries.map((d) => {
              const style = CATEGORY_STYLES[d.category];
              const { Icon } = style;
              const isActive = activeDiscoveryId === d.id;
              return (
                <li
                  key={d.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isActive
                      ? "border-violet-400/60 bg-violet-500/[0.08]"
                      : "border-white/10 bg-white/[0.02] hover:border-violet-400/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${style.chip}`}
                    >
                      <Icon className="h-2.5 w-2.5" />
                      {style.label}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      novelty {Math.round(d.novelty_score * 100)}%
                    </span>
                  </div>
                  <h3 className="mt-2 text-[12.5px] font-semibold leading-snug text-zinc-100">
                    {d.title}
                  </h3>
                  <p className="mt-1 text-[11.5px] leading-snug text-zinc-400">
                    {d.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(d.parameters)
                      .slice(0, 6)
                      .map(([k, v]) => (
                        <span
                          key={k}
                          className="rounded border border-white/5 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
                        >
                          {k}={formatNumber(v)}
                        </span>
                      ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onApply(d.parameters, d.id)}
                    className={`mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      isActive
                        ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
                        : "border-white/10 bg-white/[0.04] text-zinc-200 hover:border-violet-400/40 hover:bg-violet-500/15 hover:text-violet-100"
                    }`}
                  >
                    {isActive ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Applied
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" />
                        Apply →
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* DIVIDER between discoveries and probes */}
        {discoveries.length > 0 && probes.length > 0 && (
          <div className="my-1 flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-zinc-600">
            <div className="h-px flex-1 bg-white/5" />
            <span>Probe history</span>
            <div className="h-px flex-1 bg-white/5" />
          </div>
        )}

        {/* PROBES (live during run, history after) */}
        {probes.length > 0 && (
          <div ref={probesScrollRef} className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {probes.map((p, i) => {
                const isPending = p.observation === null;
                return (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-md border px-2.5 py-2 ${
                      isPending
                        ? "border-violet-400/30 bg-violet-500/[0.04]"
                        : !p.observation?.ok
                          ? "border-red-400/20 bg-red-500/[0.03]"
                          : "border-white/8 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/5 font-mono text-[9px] text-zinc-400">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-[11px] text-zinc-300">
                          <FlaskConical className="h-2.5 w-2.5 shrink-0 text-violet-300" />
                          <span className="truncate">{p.rationale}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(p.parameters)
                            .slice(0, 4)
                            .map(([k, v]) => (
                              <span
                                key={k}
                                className="rounded border border-white/5 bg-black/40 px-1 py-px font-mono text-[9px] text-zinc-500"
                              >
                                {k}={formatNumber(v)}
                              </span>
                            ))}
                        </div>
                        <div className="mt-1">
                          <ProbeMiniSummary obs={p.observation} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* THINKING (live, between probes) */}
        {phase === "running" && thinking && (
          <div className="rounded-md border border-white/5 bg-white/[0.015] px-2.5 py-2 text-[10.5px] leading-snug text-zinc-400">
            <span className="text-zinc-600">thinking · </span>
            {thinking}
          </div>
        )}

        {/* EMPTY STATES */}
        {phase === "running" && probes.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-[11px] text-zinc-500">
            Warming up the autonomous explorer…
          </div>
        )}

        {phase === "error" && errorMessage && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/[0.05] p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-red-200">
              <AlertCircle className="h-3 w-3" />
              Discovery failed
            </div>
            <div className="text-[10.5px] leading-snug text-red-300/80">
              {errorMessage}
            </div>
            <button
              type="button"
              onClick={startDiscovery}
              className="mt-2 inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-zinc-200 transition-colors hover:border-white/25 hover:bg-white/10"
            >
              Retry
            </button>
          </div>
        )}

        {phase === "empty" && (
          <div className="rounded-lg border border-zinc-500/30 bg-zinc-500/[0.04] p-3 text-[11px] text-zinc-300">
            The agent didn&apos;t find any standout regimes. Try tweaking
            parameter ranges manually.
          </div>
        )}
      </div>
    </motion.aside>
  );
}

export default DiscoveriesSidebar;
