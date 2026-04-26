"use client";

import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import {
  AgentProgressTimeline,
  type StepEntry,
} from "./AgentProgressTimeline";
import { ToolCallFeed, type ToolCall } from "./ToolCallFeed";

export type MultiverseLaneState =
  | "pending"
  | "running"
  | "complete"
  | "error"
  | "cancelled";

export type MultiverseLane = {
  paperIndex: number;
  url: string;
  paperTitle: string | null; // populated once `step_complete: fetching` arrives
  state: MultiverseLaneState;
  steps: StepEntry[];
  toolCalls: ToolCall[];
  blurb: string | null;
  errorMessage: string | null;
  cached: boolean;
};

type Props = {
  lanes: MultiverseLane[];
  onCancel: () => void;
};

const STATE_TONE: Record<
  MultiverseLaneState,
  { ring: string; chip: string; label: string }
> = {
  pending: {
    ring: "border-white/8",
    chip: "border-white/10 bg-white/5 text-zinc-400",
    label: "Queued",
  },
  running: {
    ring: "border-violet-400/30",
    chip: "border-violet-400/40 bg-violet-500/10 text-violet-100",
    label: "Live",
  },
  complete: {
    ring: "border-emerald-400/25",
    chip: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
    label: "Done",
  },
  error: {
    ring: "border-red-400/30",
    chip: "border-red-400/40 bg-red-500/10 text-red-100",
    label: "Failed",
  },
  cancelled: {
    ring: "border-zinc-500/30",
    chip: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
    label: "Cancelled",
  },
};

export function MultiverseProgress({ lanes, onCancel }: Props) {
  const completedCount = lanes.filter((l) => l.state === "complete").length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-5"
    >
      <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
        </span>
        Multiverse · {completedCount}/{lanes.length} papers extracted
      </div>

      <div className="flex w-full flex-col gap-3">
        {lanes.map((lane) => (
          <Lane key={lane.paperIndex} lane={lane} />
        ))}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-200"
      >
        <X className="h-3 w-3" />
        Cancel
      </button>
    </motion.div>
  );
}

function Lane({ lane }: { lane: MultiverseLane }) {
  const tone = STATE_TONE[lane.state];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${tone.ring} bg-white/[0.025] p-4 backdrop-blur-md transition-colors`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[11px] font-mono text-zinc-300">
            {lane.paperIndex + 1}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium text-zinc-100">
              {lane.paperTitle ?? lane.url}
            </div>
            {lane.paperTitle && (
              <div className="truncate font-mono text-[10px] text-zinc-600">
                {lane.url}
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {lane.cached && (
            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-cyan-200">
              cached
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] ${tone.chip}`}
          >
            {lane.state === "running" ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : lane.state === "complete" ? (
              <CheckCircle2 className="h-2.5 w-2.5" />
            ) : lane.state === "error" ? (
              <AlertCircle className="h-2.5 w-2.5" />
            ) : null}
            {tone.label}
          </span>
        </div>
      </div>

      {lane.state === "error" && lane.errorMessage && (
        <div className="mt-3 rounded-md border border-red-400/20 bg-red-500/[0.04] px-3 py-2 text-[11px] text-red-200">
          {lane.errorMessage}
        </div>
      )}

      {(lane.steps.length > 0 || lane.state === "running") &&
        lane.state !== "error" && (
          <div className="mt-3">
            <AgentProgressTimeline steps={lane.steps} />
          </div>
        )}

      {lane.toolCalls.length > 0 && lane.state !== "error" && (
        <ToolCallFeed calls={lane.toolCalls} />
      )}

      {lane.blurb && lane.state === "running" && (
        <div className="mt-2 truncate text-[11px] text-zinc-500">
          {lane.blurb}
        </div>
      )}
    </motion.div>
  );
}

export default MultiverseProgress;
