"use client";

import { motion } from "framer-motion";
import { Code2, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

type Props = {
  code: string;
  done: boolean;
  vizType: string;
  className?: string;
};

export function StreamingKernelPanel({
  code,
  done,
  vizType,
  className = "",
}: Props) {
  const preRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    const el = preRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [code]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`flex h-full min-h-[520px] w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] shadow-[0_0_60px_-30px_rgba(139,92,246,0.35)] backdrop-blur-sm ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-white/10 bg-black/40 px-3 py-2 text-[11px] backdrop-blur-md">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-violet-200">
          <Sparkles className="h-3 w-3 animate-pulse" />
          <span className="font-medium tracking-tight">
            {done ? "Annotation complete" : "Claude is annotating the kernel…"}
          </span>
        </span>
        <span className="hidden shrink-0 text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-600 sm:inline">
          {vizType}
        </span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] text-zinc-500">
          <Code2 className="h-3 w-3" />
          {code.length.toLocaleString()} chars
        </span>
      </div>

      <pre
        ref={preRef}
        className="relative flex-1 overflow-y-auto bg-[#050509] p-4 font-mono text-[12px] leading-relaxed text-zinc-200"
      >
        <code className="whitespace-pre-wrap">
          {code}
          {!done && (
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

export default StreamingKernelPanel;
