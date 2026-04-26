"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Radar,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

type Props = {
  onSubmit: (query: string, maxPapers: number) => void;
  onBack: () => void;
  loading?: boolean;
  error?: string | null;
};

const EXAMPLES = [
  "State-of-the-art algorithms for Alzheimer's early detection",
  "Fastest collision detection algorithms for robotics",
  "Best-in-class methods for protein structure prediction",
  "Modern approaches to gradient-free optimization",
];

export default function FrontierInput({
  onSubmit,
  onBack,
  loading = false,
  error = null,
}: Props) {
  const [query, setQuery] = useState("");
  const [maxPapers, setMaxPapers] = useState<3 | 4 | 5>(5);
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 4 || loading) return;
    onSubmit(trimmed, maxPapers);
  };

  const usable = query.trim().length >= 4;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative w-full"
    >
      {/* Mode header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-cyan-500/10 px-3 py-1 text-[11px] font-medium text-cyan-100 backdrop-blur-md">
          <Radar className="h-3 w-3" />
          Frontier · auto-search the research front
        </div>
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-50"
        >
          <ArrowLeft className="h-3 w-3" />
          Single paper
        </button>
      </div>

      {/* Halo */}
      <div
        aria-hidden
        className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-cyan-500/30 via-violet-400/20 to-cyan-500/30 opacity-70 blur-2xl"
      />

      <form onSubmit={handleSubmit} className="relative">
        <div
          className={`flex flex-col gap-3 rounded-3xl border bg-black/55 p-4 backdrop-blur-2xl transition-colors sm:p-5 ${
            focused
              ? "border-cyan-400/40 shadow-[0_0_120px_-20px_rgba(34,211,238,0.6)]"
              : "border-white/10 shadow-[0_0_80px_-20px_rgba(34,211,238,0.35)]"
          }`}
        >
          <div className="flex items-start gap-3">
            <Radar
              className={`mt-1 h-5 w-5 shrink-0 transition-colors ${
                focused ? "text-cyan-300" : "text-zinc-500"
              }`}
            />
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Describe a research problem in plain English…"
              rows={2}
              spellCheck
              autoComplete="off"
              disabled={loading}
              className="peer flex-1 resize-none bg-transparent text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-60 sm:text-lg"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="uppercase tracking-[0.2em] text-zinc-600">
                Sources
              </span>
              <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] p-0.5">
                {([3, 4, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMaxPapers(n)}
                    disabled={loading}
                    className={`rounded px-2 py-0.5 font-mono text-[11px] transition-colors ${
                      maxPapers === n
                        ? "bg-cyan-500/20 text-cyan-100"
                        : "text-zinc-400 hover:text-zinc-100"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="hidden sm:inline">papers</span>
            </div>

            <motion.button
              type="submit"
              disabled={loading || !usable}
              whileHover={loading || !usable ? undefined : { scale: 1.04 }}
              whileTap={loading || !usable ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="group relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-full bg-gradient-to-br from-cyan-500 via-violet-500 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_28px_-4px_rgba(34,211,238,0.85)] transition-shadow hover:shadow-[0_0_48px_-4px_rgba(34,211,238,1)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none sm:px-6 sm:py-3 sm:text-base"
            >
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
              {loading ? (
                <Loader2 className="relative h-4 w-4 animate-spin sm:h-5 sm:w-5" />
              ) : (
                <Sparkles className="relative h-4 w-4 sm:h-5 sm:w-5" />
              )}
              <span className="relative">
                {loading ? "Searching…" : "Run Frontier"}
              </span>
              {!loading && (
                <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5 sm:h-5 sm:w-5" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Example prompts */}
        <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">
            Try
          </span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuery(ex)}
              disabled={loading}
              className="rounded-full border border-white/8 bg-white/[0.02] px-2.5 py-1 text-[11px] text-zinc-400 transition-colors hover:border-cyan-400/30 hover:bg-cyan-500/[0.06] hover:text-cyan-100 disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-xs text-red-200"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300" />
            <span className="break-words">{error}</span>
          </motion.div>
        )}
      </form>
    </motion.div>
  );
}
