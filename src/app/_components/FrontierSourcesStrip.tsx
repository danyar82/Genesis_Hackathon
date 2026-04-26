"use client";

import { motion } from "framer-motion";
import { ExternalLink, Radar } from "lucide-react";
import type { FrontierDna } from "@/types/frontier";

const ORIGIN_COLOR: Record<string, string> = {
  arxiv: "#a78bfa",
  openalex: "#22d3ee",
};

type Props = {
  dna: FrontierDna;
};

export function FrontierSourcesStrip({ dna }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="rounded-xl border border-cyan-400/15 bg-gradient-to-r from-cyan-500/[0.06] via-violet-400/[0.04] to-cyan-500/[0.05] p-3 backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-200">
          <Radar className="h-3 w-3" />
          Frontier · {dna.frontier_sources.length} sources
        </div>
        <div className="hidden text-[10px] text-zinc-500 sm:block">
          Research problem:
        </div>
        <div
          className="hidden truncate text-[11px] text-zinc-300 sm:block sm:max-w-[60ch]"
          title={dna.research_problem}
        >
          “{dna.research_problem}”
        </div>
      </div>

      {dna.synthesis_summary && (
        <p className="mt-2 text-[12px] leading-snug text-zinc-300">
          {dna.synthesis_summary}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-stretch gap-2">
        {dna.frontier_sources.map((src) => {
          const color = ORIGIN_COLOR[src.search_origin] ?? "#a78bfa";
          return (
            <div
              key={src.paperIndex}
              className="flex min-w-[220px] flex-1 items-start gap-2.5 rounded-lg border border-white/8 bg-black/25 px-3 py-2 transition-colors hover:border-white/20"
            >
              <span
                className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full"
                style={{
                  background: color,
                  boxShadow: `0 0 8px ${color}`,
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.18em]"
                    style={{ color }}
                  >
                    {src.search_origin}
                    {src.arxiv_id && ` · ${src.arxiv_id}`}
                  </span>
                  <span className="font-mono text-[9px] text-zinc-600">
                    #{src.paperIndex + 1}
                  </span>
                </div>
                <div
                  className="mt-0.5 truncate text-[11px] text-zinc-200"
                  title={src.title}
                >
                  {src.title}
                </div>
                {src.authors.length > 0 && (
                  <div
                    className="mt-0.5 truncate text-[10px] text-zinc-500"
                    title={src.authors.join(", ")}
                  >
                    {src.authors.slice(0, 3).join(", ")}
                    {src.authors.length > 3 && " …"}
                  </div>
                )}
                {src.relevance_note && (
                  <div className="mt-1 text-[10.5px] italic leading-snug text-zinc-400">
                    {src.relevance_note}
                  </div>
                )}
                {src.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 truncate font-mono text-[9px] text-zinc-600 transition-colors hover:text-zinc-300"
                  >
                    <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{src.url}</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default FrontierSourcesStrip;
