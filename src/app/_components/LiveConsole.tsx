"use client";

import { useEffect, useRef } from "react";
import type { StepEntry, StepId } from "./AgentProgressTimeline";
import type { ToolCall } from "./ToolCallFeed";

type EventKind = "step" | "tool" | "blurb";

type ConsoleEvent = {
  key: string;
  kind: EventKind;
  text: string;
  ts: number;
};

type Props = {
  steps: StepEntry[];
  toolCalls: ToolCall[];
  agentBlurb: string | null;
  startedAt: number | null;
};

const STEP_LABEL: Record<StepId, string> = {
  fetching: "Fetching paper",
  parsing: "Parsing content",
  extracting: "Extracting algorithm DNA",
  generating: "Generating code kernel",
};

const MAX_EVENTS = 40;

function formatStamp(startedAt: number | null, ts: number): string {
  if (startedAt == null) return "00:00";
  const seconds = Math.max(0, Math.floor((ts - startedAt) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function LiveConsole({ steps, toolCalls, agentBlurb, startedAt }: Props) {
  const bufferRef = useRef<ConsoleEvent[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  // Reset buffer when a new run begins (startedAt changes).
  const lastStartRef = useRef<number | null>(null);
  if (lastStartRef.current !== startedAt) {
    lastStartRef.current = startedAt;
    bufferRef.current = [];
    seenRef.current = new Set();
  }

  // Derive events from props on every render; only append unseen keys.
  const newEvents: ConsoleEvent[] = [];
  const now = Date.now();

  for (const step of steps) {
    if (step.state === "active") {
      const key = `step:${step.id}:active`;
      if (!seenRef.current.has(key)) {
        seenRef.current.add(key);
        newEvents.push({
          key,
          kind: "step",
          text: `starting ${STEP_LABEL[step.id]}`,
          ts: now,
        });
      }
    } else if (step.state === "complete") {
      const key = `step:${step.id}:complete`;
      if (!seenRef.current.has(key)) {
        seenRef.current.add(key);
        newEvents.push({
          key,
          kind: "step",
          text: `${STEP_LABEL[step.id]} complete`,
          ts: now,
        });
      }
    }
  }

  for (const call of toolCalls) {
    const key = `tool:${call.id}:${call.state}`;
    if (!seenRef.current.has(key)) {
      seenRef.current.add(key);
      const verb =
        call.state === "running"
          ? "running"
          : call.state === "success"
            ? "done"
            : "failed";
      const summary = call.argSummary ? ` — ${call.argSummary}` : "";
      newEvents.push({
        key,
        kind: "tool",
        text: `tool ${call.name} ${verb}${summary}`,
        ts: now,
      });
    }
  }

  if (agentBlurb) {
    const key = `blurb:${agentBlurb}`;
    if (!seenRef.current.has(key)) {
      seenRef.current.add(key);
      newEvents.push({ key, kind: "blurb", text: agentBlurb, ts: now });
    }
  }

  if (newEvents.length > 0) {
    const merged = [...bufferRef.current, ...newEvents];
    bufferRef.current = merged.slice(-MAX_EVENTS);
  }

  const events = bufferRef.current;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <div className="relative flex h-full min-h-[200px] flex-col overflow-hidden rounded-xl border border-violet-400/15 bg-black/40 backdrop-blur-md">
      {/* Header strip */}
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
          </span>
          Agent Stream
        </div>
        <div className="font-mono text-[10px] text-zinc-600">
          {events.length}/{MAX_EVENTS}
        </div>
      </div>

      {/* Body */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
      >
        {/* Top fade-out overlay */}
        <div
          aria-hidden
          className="pointer-events-none sticky top-0 -mx-3 -mt-2 h-6 bg-gradient-to-b from-black/60 to-transparent"
        />

        {events.length === 0 ? (
          <div className="text-zinc-600 italic">Awaiting agent activity…</div>
        ) : (
          events.map((ev, i) => {
            const isLast = i === events.length - 1;
            const colorCls =
              ev.kind === "step"
                ? "text-cyan-200/85"
                : ev.kind === "tool"
                  ? "text-fuchsia-200/85"
                  : "text-violet-200/75 italic";
            return (
              <div
                key={ev.key}
                className="flex items-start gap-2 whitespace-pre-wrap break-words"
              >
                <span className="shrink-0 text-zinc-600">
                  ‹{formatStamp(startedAt, ev.ts)}›
                </span>
                <span className={`shrink-0 ${ev.kind === "tool" ? "text-fuchsia-400/70" : "text-violet-400/70"}`}>
                  ›
                </span>
                <span className={colorCls}>
                  {ev.text}
                  {isLast && (
                    <span
                      aria-hidden
                      className="ml-0.5 inline-block w-[7px] animate-pulse text-violet-200"
                    >
                      ▌
                    </span>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default LiveConsole;
