"use client";

import { motion } from "framer-motion";
import { Layers3, Sparkles } from "lucide-react";
import type { MultiverseDna } from "@/types/multiverse";

const SERIES_COLORS = [
  "#a78bfa", // violet-400
  "#22d3ee", // cyan-400
  "#f472b6", // pink-400
];

type Props = {
  dna: MultiverseDna;
};

export function PaperLineageStrip({ dna }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="rounded-xl border border-violet-400/15 bg-gradient-to-r from-violet-500/[0.06] via-violet-400/[0.03] to-cyan-500/[0.05] p-3 backdrop-blur-md"
    >
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-violet-200">
          <Sparkles className="h-3 w-3" />
          Multiverse · {dna.lineage.length} papers
        </div>
        <div className="hidden items-center gap-1 text-[10px] text-zinc-500 sm:flex">
          <Layers3 className="h-3 w-3" />
          <span className="font-mono uppercase tracking-[0.15em]">
            {dna.synthesis_strategy}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="font-mono">sweep: {dna.dominant_axis}</span>
        </div>
      </div>

      {dna.synthesis_summary && (
        <p className="mt-2 text-[12px] leading-snug text-zinc-300">
          {dna.synthesis_summary}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-stretch gap-2">
        {dna.lineage.map((entry, i) => {
          const color = SERIES_COLORS[i % SERIES_COLORS.length];
          return (
            <div
              key={entry.paperIndex}
              className="flex min-w-[180px] flex-1 items-start gap-2.5 rounded-lg border border-white/8 bg-black/25 px-3 py-2 transition-colors hover:border-white/20"
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
                    {entry.series_key}
                  </span>
                  <span className="text-[9px] text-zinc-600">
                    {entry.classification}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-zinc-200" title={entry.title}>
                  {entry.title}
                </div>
                {entry.url && (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate font-mono text-[9px] text-zinc-600 transition-colors hover:text-zinc-400"
                  >
                    {entry.url}
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

export default PaperLineageStrip;
