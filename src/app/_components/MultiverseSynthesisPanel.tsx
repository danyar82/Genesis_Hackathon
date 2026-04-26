"use client";

import { motion } from "framer-motion";
import { Code2, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

type Props = {
  text: string;
  done: boolean;
  paperTitles: string[];
  className?: string;
};

/**
 * Streaming pane shown during the multiverse synthesis stage.
 * The synthesizer emits a JSON stream (the unified MultiverseDna),
 * which we render verbatim — judges see Claude live-fusing the papers.
 */
export function MultiverseSynthesisPanel({
  text,
  done,
  paperTitles,
  className = "",
}: Props) {
  const preRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    const el = preRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [text]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`flex h-full min-h-[520px] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] shadow-[0_0_60px_-30px_rgba(139,92,246,0.4)] backdrop-blur-sm ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/40 px-3 py-2 text-[11px] backdrop-blur-md">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-violet-200">
          <Sparkles className="h-3 w-3 animate-pulse" />
          <span className="font-medium tracking-tight">
            {done ? "Synthesis complete" : `Fusing ${paperTitles.length} papers…`}
          </span>
        </span>
        <span className="hidden items-center gap-1 text-[10px] text-zinc-500 sm:inline-flex">
          {paperTitles.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <span className="text-zinc-700">·</span>}
              <span className="max-w-[14ch] truncate font-mono text-zinc-400">
                {t}
              </span>
            </span>
          ))}
        </span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] text-zinc-500">
          <Code2 className="h-3 w-3" />
          {text.length.toLocaleString()} chars
        </span>
      </div>

      <pre
        ref={preRef}
        className="relative flex-1 overflow-y-auto bg-[#050509] p-4 font-mono text-[12px] leading-relaxed text-zinc-200"
      >
        <code className="whitespace-pre-wrap">
          {text || (
            <span className="text-zinc-600">
              Waiting for synthesizer…
            </span>
          )}
          {!done && text.length > 0 && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-[1em] w-[0.5ch] animate-pulse bg-violet-300 align-middle"
            />
          )}
        </code>
      </pre>
    </motion.div>
  );
}

export default MultiverseSynthesisPanel;
