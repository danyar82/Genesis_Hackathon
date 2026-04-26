"use client";

import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, Link2, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  onSubmit?: (url: string) => void;
  loading?: boolean;
  initialUrl?: string;
  error?: string | null;
};

export default function InputBox({
  onSubmit,
  loading = false,
  initialUrl = "",
  error = null,
}: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || loading) return;
    onSubmit?.(trimmed);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative w-full"
    >
      <div
        aria-hidden
        className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-500/35 via-fuchsia-400/25 to-cyan-400/35 opacity-80 blur-2xl"
      />

      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/55 px-6 py-4 shadow-[0_0_120px_-20px_rgba(139,92,246,0.55)] backdrop-blur-2xl transition-colors focus-within:border-violet-400/40 sm:px-7 sm:py-5">
          <Link2
            className={`h-5 w-5 shrink-0 transition-colors ${
              focused ? "text-violet-300" : "text-zinc-500"
            }`}
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Paste any research paper URL here..."
            spellCheck={false}
            autoComplete="off"
            disabled={loading}
            className="peer flex-1 bg-transparent text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-60 sm:text-lg"
          />
          <motion.button
            type="submit"
            disabled={loading || !url.trim()}
            whileHover={loading || !url.trim() ? undefined : { scale: 1.05 }}
            whileTap={loading || !url.trim() ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="group relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-br from-violet-500 via-violet-600 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_28px_-4px_rgba(139,92,246,0.85)] transition-shadow hover:shadow-[0_0_48px_-4px_rgba(139,92,246,1)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none sm:gap-2 sm:px-6 sm:py-3 sm:text-base"
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
            <span className="relative hidden sm:inline">
              {loading ? "Extracting…" : "Generate"}
            </span>
            {!loading && (
              <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5 sm:h-5 sm:w-5" />
            )}
          </motion.button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 px-3 text-xs text-zinc-500 sm:px-5 sm:text-[13px]">
          <span className="min-w-0 truncate">
            Example:{" "}
            <span className="font-mono text-zinc-400">
              https://arxiv.org/abs/...
            </span>
            <span className="mx-1 text-zinc-600">or</span>
            <span className="font-mono text-zinc-400">
              https://nature.com/articles/...
            </span>
          </span>
          <span className="hidden shrink-0 sm:inline">~60s · Free preview</span>
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
