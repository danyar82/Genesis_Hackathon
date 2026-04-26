"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  RefreshCw,
  Shield,
  Skull,
  Sparkles,
  Square,
  Swords,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PaperDna } from "@/types/paperDna";

type Agent = "attacker" | "defender";

type Turn = {
  index: number;
  agent: Agent;
  round: number;
  text: string;
  complete: boolean;
};

type DebateStatus = "idle" | "running" | "done" | "error";

type Props = {
  paperDna: PaperDna;
  /** Source URL of the live paper. When provided, the backend re-fetches the
   * full body text so the agents argue from real methodology — null for
   * curated examples (which fall back to DNA-only context). */
  url?: string | null;
  open: boolean;
  onClose: () => void;
};

const TOTAL_ROUNDS = 3;

export default function GenesisDebate({ paperDna, url, open, onClose }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [status, setStatus] = useState<DebateStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const attackerScrollRef = useRef<HTMLDivElement | null>(null);
  const defenderScrollRef = useRef<HTMLDivElement | null>(null);

  const cancelInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    // Reset and start a fresh debate every time the modal opens or runId bumps.
    setTurns([]);
    setActiveAgent(null);
    setCurrentRound(0);
    setStatus("running");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch("/api/agent/debate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paperDna,
            rounds: TOTAL_ROUNDS,
            // null for curated examples — the backend treats absent/null url
            // as "DNA-only" and skips the full-text re-fetch entirely.
            url: url ?? null,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const msg = `Debate request failed (${res.status})`;
          setError(msg);
          setStatus("error");
          return;
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

            if (eventName === "turn_start") {
              const agent = data.agent as Agent;
              const round = (data.round as number) ?? 1;
              const turnIndex = (data.turnIndex as number) ?? 0;
              setActiveAgent(agent);
              setCurrentRound(round);
              setTurns((prev) => [
                ...prev,
                { index: turnIndex, agent, round, text: "", complete: false },
              ]);
            } else if (eventName === "delta") {
              const agent = data.agent as Agent;
              const text = (data.text as string) ?? "";
              const turnIndex = (data.turnIndex as number) ?? -1;
              if (!text) continue;
              setTurns((prev) => {
                const next = [...prev];
                const idx = next.findIndex(
                  (t) => t.index === turnIndex && t.agent === agent,
                );
                if (idx >= 0) {
                  next[idx] = { ...next[idx], text: next[idx].text + text };
                }
                return next;
              });
            } else if (eventName === "turn_end") {
              const agent = data.agent as Agent;
              const turnIndex = (data.turnIndex as number) ?? -1;
              const fullText = (data.fullText as string) ?? "";
              setTurns((prev) => {
                const next = [...prev];
                const idx = next.findIndex(
                  (t) => t.index === turnIndex && t.agent === agent,
                );
                if (idx >= 0) {
                  next[idx] = {
                    ...next[idx],
                    text: fullText || next[idx].text,
                    complete: true,
                  };
                }
                return next;
              });
            } else if (eventName === "done") {
              setActiveAgent(null);
              setStatus("done");
            } else if (eventName === "error") {
              const message = (data.message as string) ?? "Unknown error";
              setError(message);
              setStatus("error");
              setActiveAgent(null);
            }
          }
        }

        setActiveAgent(null);
        setStatus((s) => (s === "running" ? "done" : s));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message ?? "Network error");
        setStatus("error");
        setActiveAgent(null);
      }
    })();

    return () => {
      controller.abort();
      abortRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, runId]);

  // Auto-scroll each column when its turn count or active text grows.
  useEffect(() => {
    const scroll = (el: HTMLDivElement | null) => {
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    };
    scroll(attackerScrollRef.current);
    scroll(defenderScrollRef.current);
  }, [turns]);

  const handleClose = () => {
    cancelInFlight();
    setStatus("idle");
    onClose();
  };

  const handleRestart = () => {
    cancelInFlight();
    setRunId((n) => n + 1);
  };

  const handleStop = () => {
    cancelInFlight();
    setActiveAgent(null);
    setStatus((s) => (s === "running" ? "done" : s));
  };

  const attackerTurns = turns.filter((t) => t.agent === "attacker");
  const defenderTurns = turns.filter((t) => t.agent === "defender");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="debate-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 lg:p-8"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close debate"
            onClick={handleClose}
            className="absolute inset-0 bg-[#03030a]/85 backdrop-blur-2xl"
          />

          {/* Console card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative flex h-full max-h-[92vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0814]/95 via-[#070512]/95 to-[#0a0a18]/95 shadow-[0_0_120px_-10px_rgba(139,92,246,0.45)] backdrop-blur-xl"
          >
            {/* Edge glow accents */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background:
                  "radial-gradient(60% 40% at 0% 0%, rgba(244,63,94,0.12), transparent 70%), radial-gradient(60% 40% at 100% 0%, rgba(34,211,238,0.12), transparent 70%)",
              }}
            />

            {/* Header */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-5 py-4 backdrop-blur-md sm:px-7">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-rose-500/20 via-violet-500/20 to-cyan-500/20">
                  <Swords className="h-4 w-4 text-violet-200" />
                  <span className="absolute inset-0 animate-pulse rounded-lg bg-violet-500/10 blur-md" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
                    <span className="text-rose-300/80">GENESIS</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-cyan-300/80">DEBATE PROTOCOL</span>
                  </div>
                  <div className="mt-0.5 truncate text-[13px] font-medium text-zinc-100 sm:text-sm">
                    {paperDna.title}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <RoundIndicator
                  current={currentRound || (status === "done" ? TOTAL_ROUNDS : 0)}
                  total={TOTAL_ROUNDS}
                  status={status}
                />
                {status === "running" ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-100"
                  >
                    <Square className="h-3 w-3" /> Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-100"
                  >
                    <RefreshCw className="h-3 w-3" /> Restart
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-zinc-300 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-100"
                  aria-label="Close debate"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body — split console */}
            <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <DebateColumn
                side="left"
                agent="attacker"
                turns={attackerTurns}
                isActive={activeAgent === "attacker"}
                scrollRef={attackerScrollRef}
              />

              {/* Center divider — VS */}
              <div className="relative hidden lg:flex lg:w-px lg:flex-col lg:items-center lg:justify-center">
                <div className="absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
                <div className="relative rounded-full border border-white/15 bg-[#0a0814] px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.2em] text-zinc-300 shadow-[0_0_24px_-4px_rgba(139,92,246,0.5)]">
                  VS
                </div>
              </div>

              <DebateColumn
                side="right"
                agent="defender"
                turns={defenderTurns}
                isActive={activeAgent === "defender"}
                scrollRef={defenderScrollRef}
              />
            </div>

            {/* Footer */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/30 px-5 py-3 text-[11px] text-zinc-400 backdrop-blur-md sm:px-7">
              <div className="flex items-center gap-2 font-mono">
                <span className="inline-flex h-1.5 w-1.5 items-center justify-center">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      status === "running"
                        ? "animate-pulse bg-violet-400"
                        : status === "done"
                          ? "bg-emerald-400"
                          : status === "error"
                            ? "bg-rose-400"
                            : "bg-zinc-500"
                    }`}
                  />
                </span>
                <span className="uppercase tracking-[0.2em] text-zinc-500">
                  {statusLabel(status, activeAgent, currentRound)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-zinc-600">
                <Sparkles className="h-3 w-3" /> Powered by Claude Opus 4.7 · 2 ×
                streaming sessions
              </div>
            </div>

            {/* Error banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute left-1/2 top-20 z-20 flex max-w-md -translate-x-1/2 items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100 backdrop-blur-md"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                  <span className="break-words">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RoundIndicator({
  current,
  total,
  status,
}: {
  current: number;
  total: number;
  status: DebateStatus;
}) {
  return (
    <div className="hidden items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 sm:inline-flex">
      <span className="text-zinc-500">ROUND</span>
      <span className="text-zinc-100">
        {String(Math.max(current, 0)).padStart(2, "0")}
      </span>
      <span className="text-zinc-600">/</span>
      <span className="text-zinc-100">{String(total).padStart(2, "0")}</span>
      {status === "running" && (
        <span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
      )}
    </div>
  );
}

function DebateColumn({
  side,
  agent,
  turns,
  isActive,
  scrollRef,
}: {
  side: "left" | "right";
  agent: Agent;
  turns: Turn[];
  isActive: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const isAttacker = agent === "attacker";
  const accent = isAttacker
    ? {
        text: "text-rose-200",
        muted: "text-rose-300/60",
        glow: "shadow-[0_0_60px_-10px_rgba(244,63,94,0.55)]",
        bg: "from-rose-500/[0.06] via-transparent to-transparent",
        bar: "from-rose-400/0 via-rose-400/60 to-rose-400/0",
        ring: "border-rose-400/30 bg-rose-500/10",
        cursor: "bg-rose-300",
      }
    : {
        text: "text-cyan-100",
        muted: "text-cyan-300/60",
        glow: "shadow-[0_0_60px_-10px_rgba(34,211,238,0.5)]",
        bg: "from-cyan-500/[0.06] via-transparent to-transparent",
        bar: "from-cyan-400/0 via-cyan-400/60 to-cyan-400/0",
        ring: "border-cyan-400/30 bg-cyan-500/10",
        cursor: "bg-cyan-300",
      };

  const Icon = isAttacker ? Skull : Shield;
  const role = isAttacker ? "DEVIL'S ADVOCATE" : "DEFENDER · REVIEWER";
  const codename = isAttacker ? "AGENT-A" : "AGENT-B";

  return (
    <div
      className={`relative flex min-h-0 flex-col bg-gradient-to-b ${accent.bg} ${
        side === "right" ? "lg:border-l-0" : ""
      }`}
    >
      {/* Top accent bar */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accent.bar} ${
          isActive ? "opacity-100" : "opacity-40"
        } transition-opacity`}
      />

      {/* Column header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/5 bg-black/20 px-5 py-3 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-2.5">
          <div
            className={`relative flex h-7 w-7 items-center justify-center rounded-md border ${accent.ring} ${
              isActive ? accent.glow : ""
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${accent.text}`} />
            {isActive && (
              <span
                className={`absolute -inset-0.5 animate-pulse rounded-md ${
                  isAttacker ? "bg-rose-500/20" : "bg-cyan-500/20"
                } blur-md`}
              />
            )}
          </div>
          <div className="font-mono">
            <div
              className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${accent.text}`}
            >
              {codename}
            </div>
            <div className={`text-[10px] tracking-[0.18em] ${accent.muted}`}>
              {role}
            </div>
          </div>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] transition-colors ${
            isActive
              ? `${accent.ring} ${accent.text}`
              : "border-white/10 bg-white/[0.03] text-zinc-500"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isActive ? `${accent.cursor} animate-pulse` : "bg-zinc-600"
            }`}
          />
          {isActive ? "TRANSMITTING" : turns.length > 0 ? "STANDBY" : "OFFLINE"}
        </div>
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 font-mono text-[12.5px] leading-relaxed sm:px-6 sm:text-[13px]"
      >
        {turns.length === 0 && (
          <div className={`mt-4 ${accent.muted} text-[11px] italic`}>
            <span className="opacity-60">
              {isActive
                ? "// initializing transmission…"
                : "// awaiting first transmission"}
            </span>
          </div>
        )}
        {turns.map((turn, i) => (
          <div key={turn.index} className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2 text-[10px] uppercase tracking-[0.2em]">
              <span className={accent.muted}>
                R{turn.round}.{i + 1}
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-500">
                {isAttacker ? "attack" : "defense"}
              </span>
            </div>
            <p className={`whitespace-pre-wrap ${accent.text}`}>
              {turn.text}
              {!turn.complete && isActive && (
                <span
                  className={`ml-0.5 inline-block h-[1.05em] w-[6px] -translate-y-[1px] align-middle ${accent.cursor} animate-pulse`}
                />
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusLabel(
  status: DebateStatus,
  activeAgent: Agent | null,
  round: number,
): string {
  if (status === "idle") return "STANDBY";
  if (status === "error") return "TRANSMISSION FAULT";
  if (status === "done") return "DEBATE CLOSED";
  if (activeAgent === "attacker") return `ROUND ${round} · AGENT-A ATTACKING`;
  if (activeAgent === "defender") return `ROUND ${round} · AGENT-B DEFENDING`;
  return "INITIALIZING";
}
