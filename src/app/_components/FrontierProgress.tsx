"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  Check,
  FileText,
  Loader2,
  Radar,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { FrontierSearchOrigin } from "@/types/frontier";

export type FrontierPhase =
  | "searching"
  | "reading"
  | "synthesizing"
  | "done";

export type FrontierPaperState =
  | "pending"
  | "fetching"
  | "fetched"
  | "warned";

export type FrontierPaperPreview = {
  title: string;
  authors: string[];
  url: string;
  search_origin: FrontierSearchOrigin;
  arxiv_id: string | null;
  doi: string | null;
};

type Props = {
  query: string;
  phase: FrontierPhase;
  papers: FrontierPaperPreview[];
  paperStates: Record<number, FrontierPaperState>;
  paperSources: Record<number, string>;
  synthesisText: string;
  onCancel: () => void;
};

export default function FrontierProgress({
  query,
  phase,
  papers,
  paperStates,
  paperSources,
  synthesisText,
  onCancel,
}: Props) {
  const synthScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = synthScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [synthesisText]);

  const phaseStatus = (target: FrontierPhase): "pending" | "active" | "done" => {
    const order: FrontierPhase[] = [
      "searching",
      "reading",
      "synthesizing",
      "done",
    ];
    const cur = order.indexOf(phase);
    const idx = order.indexOf(target);
    if (idx < cur) return "done";
    if (idx === cur) return "active";
    return "pending";
  };

  const fetchedCount = Object.values(paperStates).filter(
    (s) => s === "fetched" || s === "warned",
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative z-10 flex w-full max-w-4xl flex-col gap-5"
    >
      {/* Top echo: the query */}
      <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/[0.05] via-violet-500/[0.04] to-cyan-500/[0.05] p-4 backdrop-blur-md sm:p-5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">
          <Radar className="h-3 w-3" />
          Frontier · live search
        </div>
        <p className="mt-1.5 truncate text-[14px] text-zinc-100 sm:text-[15px]">
          {query}
        </p>
      </div>

      {/* Phase tracker */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-md sm:p-5">
        <PhaseRow
          icon={Radar}
          label="Scouring global databases…"
          sub={
            phaseStatus("searching") === "done"
              ? `Found ${papers.length} candidate papers`
              : phaseStatus("searching") === "active"
                ? "Querying arXiv + OpenAlex"
                : ""
          }
          status={phaseStatus("searching")}
        />
        <PhaseDivider />
        <PhaseRow
          icon={BookOpen}
          label={`Reading top ${papers.length || "N"} papers…`}
          sub={
            phaseStatus("reading") === "done"
              ? `${fetchedCount} of ${papers.length} read`
              : phaseStatus("reading") === "active"
                ? `${fetchedCount} of ${papers.length} read`
                : ""
          }
          status={phaseStatus("reading")}
        />
        <PhaseDivider />
        <PhaseRow
          icon={Sparkles}
          label="Synthesizing master solution…"
          sub={
            phaseStatus("synthesizing") === "done"
              ? "Hybrid kernel ready"
              : phaseStatus("synthesizing") === "active"
                ? `${synthesisText.length.toLocaleString()} chars streamed`
                : ""
          }
          status={phaseStatus("synthesizing")}
        />
      </div>

      {/* Per-paper list — appears as soon as papers_found arrives */}
      <AnimatePresence>
        {papers.length > 0 && (
          <motion.div
            key="papers"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-md sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                Sources retrieved
              </div>
              <div className="font-mono text-[10px] text-zinc-600">
                {fetchedCount}/{papers.length}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {papers.map((p, i) => {
                const state = paperStates[i] ?? "pending";
                const provenance = paperSources[i];
                return (
                  <PaperRow
                    key={`${p.title}-${i}`}
                    paper={p}
                    state={state}
                    provenance={provenance}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streaming synthesis panel */}
      <AnimatePresence>
        {(phase === "synthesizing" || phase === "done") &&
          synthesisText.length > 0 && (
            <motion.div
              key="synthesis"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-xl border border-violet-400/20 bg-black/40 backdrop-blur-md"
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-2.5 sm:px-5">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-violet-300/80">
                  <Sparkles className="h-3 w-3" />
                  Master synthesis · streaming
                </div>
                <div className="font-mono text-[10px] text-zinc-600">
                  {synthesisText.length.toLocaleString()} chars
                </div>
              </div>
              <div
                ref={synthScrollRef}
                className="max-h-56 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-violet-100/80 sm:px-5"
              >
                <pre className="whitespace-pre-wrap break-all">
                  {synthesisText}
                  {phase === "synthesizing" && (
                    <span className="ml-0.5 inline-block h-[1em] w-[6px] -translate-y-[1px] animate-pulse bg-violet-300 align-middle" />
                  )}
                </pre>
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      <button
        type="button"
        onClick={onCancel}
        className="mx-auto inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-200"
      >
        <X className="h-3 w-3" />
        Cancel
      </button>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */

function PhaseRow({
  icon: Icon,
  label,
  sub,
  status,
}: {
  icon: typeof Radar;
  label: string;
  sub: string;
  status: "pending" | "active" | "done";
}) {
  const ring =
    status === "done"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
      : status === "active"
        ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
        : "border-white/10 bg-white/[0.02] text-zinc-600";

  return (
    <div className="flex items-center gap-3">
      <div
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${ring}`}
      >
        {status === "active" ? (
          <>
            <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400/20" />
            <Loader2 className="relative h-3.5 w-3.5 animate-spin" />
          </>
        ) : status === "done" ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`text-[13px] ${
            status === "pending" ? "text-zinc-500" : "text-zinc-100"
          }`}
        >
          {label}
        </div>
        {sub && (
          <div className="mt-0.5 truncate text-[11px] text-zinc-500">{sub}</div>
        )}
      </div>
    </div>
  );
}

function PhaseDivider() {
  return <div className="ml-4 h-3 w-px bg-white/8" />;
}

function PaperRow({
  paper,
  state,
  provenance,
}: {
  paper: FrontierPaperPreview;
  state: FrontierPaperState;
  provenance?: string;
}) {
  const stateBadge =
    state === "pending"
      ? { color: "text-zinc-600", icon: <FileText className="h-3 w-3" />, label: "queued" }
      : state === "fetching"
        ? {
            color: "text-cyan-300",
            icon: <Loader2 className="h-3 w-3 animate-spin" />,
            label: "reading",
          }
        : state === "warned"
          ? {
              color: "text-amber-300",
              icon: <AlertTriangle className="h-3 w-3" />,
              label: "abstract-only",
            }
          : {
              color: "text-emerald-300",
              icon: <Check className="h-3 w-3" />,
              label: provenance ?? "read",
            };

  const originBadge =
    paper.search_origin === "arxiv"
      ? "border-violet-400/30 bg-violet-500/10 text-violet-200"
      : "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";

  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2.5 transition-colors hover:border-white/15">
      <div
        className={`mt-0.5 inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[9px] uppercase tracking-[0.15em] ${originBadge}`}
      >
        {paper.search_origin}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] text-zinc-100" title={paper.title}>
          {paper.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-zinc-500">
          {paper.authors.length > 0 && (
            <span className="truncate" title={paper.authors.join(", ")}>
              {paper.authors.slice(0, 3).join(", ")}
              {paper.authors.length > 3 && " …"}
            </span>
          )}
          {paper.arxiv_id && (
            <span className="font-mono">arXiv:{paper.arxiv_id}</span>
          )}
          {paper.doi && (
            <span className="truncate font-mono" title={paper.doi}>
              doi:{paper.doi}
            </span>
          )}
        </div>
      </div>
      <div
        className={`flex shrink-0 items-center gap-1 self-center font-mono text-[10px] ${stateBadge.color}`}
      >
        {stateBadge.icon}
        <span className="uppercase tracking-[0.15em]">{stateBadge.label}</span>
      </div>
    </div>
  );
}
