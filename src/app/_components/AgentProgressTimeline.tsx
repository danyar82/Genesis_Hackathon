"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Code2,
  Download,
  FlaskConical,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type StepId = "fetching" | "parsing" | "extracting" | "generating";

export type StepState = "pending" | "active" | "complete";

export type StepEntry = {
  id: StepId;
  state: StepState;
  message?: string;
  metadata?: Record<string, unknown>;
};

const STEP_DEFS: Array<{ id: StepId; label: string; hint: string; Icon: LucideIcon }> = [
  {
    id: "fetching",
    label: "Fetching paper",
    hint: "Pulling metadata from publisher",
    Icon: Download,
  },
  {
    id: "parsing",
    label: "Parsing content",
    hint: "Reading title, abstract, and categories",
    Icon: FlaskConical,
  },
  {
    id: "extracting",
    label: "Extracting algorithm DNA",
    hint: "Identifying parameters, equations, and classification",
    Icon: Sparkles,
  },
  {
    id: "generating",
    label: "Generating code kernel",
    hint: "Writing executable JavaScript implementation",
    Icon: Code2,
  },
];

type Props = {
  steps: StepEntry[];
};

function stepFor(steps: StepEntry[], id: StepId): StepEntry | undefined {
  return steps.find((s) => s.id === id);
}

function metadataSummary(step: StepEntry): string | null {
  const md = step.metadata;
  if (!md) return null;
  if (step.id === "fetching" && typeof md.title === "string") {
    const authors = Array.isArray(md.authors) ? md.authors : [];
    const authorLabel =
      authors.length === 0
        ? ""
        : authors.length === 1
          ? ` · ${authors[0]}`
          : ` · ${authors[0]} et al.`;
    return `${md.title}${authorLabel}`;
  }
  if (step.id === "generating") {
    const chars = md.code_kernel_chars;
    const paramCount = md.parameter_count;
    const parts: string[] = [];
    if (typeof chars === "number") parts.push(`${chars.toLocaleString()} chars`);
    if (typeof paramCount === "number") parts.push(`${paramCount} params`);
    return parts.join(" · ") || null;
  }
  return null;
}

export function AgentProgressTimeline({ steps }: Props) {
  return (
    <div className="w-full">
      <ul className="flex flex-col gap-0">
        {STEP_DEFS.map((def, i) => {
          const entry = stepFor(steps, def.id);
          const state: StepState = entry?.state ?? "pending";
          const isLast = i === STEP_DEFS.length - 1;
          const message = entry?.message;
          const summary = entry ? metadataSummary(entry) : null;
          const { Icon } = def;

          return (
            <li key={def.id} className="relative flex items-start gap-3 pb-4">
              {!isLast && (
                <span
                  aria-hidden
                  className={`absolute left-[11px] top-6 h-[calc(100%-12px)] w-px ${
                    state === "complete"
                      ? "bg-gradient-to-b from-emerald-400/40 to-violet-400/20"
                      : "bg-white/10"
                  }`}
                />
              )}

              <motion.div
                initial={false}
                animate={{
                  scale:
                    state === "active" ? [1, 1.06, 1] : 1,
                }}
                transition={{
                  duration: state === "active" ? 1.6 : 0.3,
                  repeat: state === "active" ? Infinity : 0,
                  ease: "easeInOut",
                }}
                className={`relative z-10 mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                  state === "pending"
                    ? "border-white/10 bg-white/[0.02]"
                    : state === "active"
                      ? "border-violet-400/50 bg-violet-500/20 shadow-[0_0_16px_-2px_rgba(139,92,246,0.6)]"
                      : "border-emerald-400/40 bg-emerald-500/15"
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {state === "complete" ? (
                    <motion.span
                      key="check"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Check className="h-3 w-3 text-emerald-300" strokeWidth={3} />
                    </motion.span>
                  ) : state === "active" ? (
                    <motion.span
                      key="dot"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="relative flex h-2 w-2"
                    >
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-300 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-300" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="icon"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <Icon className="h-3 w-3 text-zinc-600" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div
                  className={`flex items-baseline justify-between gap-2 text-[12.5px] font-medium transition-colors ${
                    state === "pending"
                      ? "text-zinc-500"
                      : state === "active"
                        ? "text-zinc-100"
                        : "text-zinc-400"
                  }`}
                >
                  <span className="truncate">{def.label}</span>
                  <AnimatePresence>
                    {state === "active" && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-violet-300"
                      >
                        in progress
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-0.5 min-h-[14px]">
                  <AnimatePresence mode="wait">
                    {state === "active" && message ? (
                      <motion.p
                        key={`msg-${message}`}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -3 }}
                        transition={{ duration: 0.2 }}
                        className="truncate text-[11px] text-zinc-400"
                      >
                        {message}
                      </motion.p>
                    ) : state === "complete" && summary ? (
                      <motion.p
                        key="summary"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="truncate text-[11px] text-zinc-500"
                      >
                        {summary}
                      </motion.p>
                    ) : state === "pending" ? (
                      <p className="truncate text-[11px] text-zinc-600">
                        {def.hint}
                      </p>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default AgentProgressTimeline;
