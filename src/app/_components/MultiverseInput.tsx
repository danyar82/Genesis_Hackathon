"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Link2,
  Loader2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";

const MIN_URLS = 2;
const MAX_URLS = 3;

type Props = {
  onSubmit: (urls: string[]) => void;
  onBack: () => void;
  loading?: boolean;
  error?: string | null;
};

function isLikelyUrl(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^arxiv\.org\//i.test(t)) return true;
  if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(t)) return true; // bare arXiv ID
  return false;
}

function splitPasted(text: string): string[] {
  return text
    .split(/[\n,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function MultiverseInput({
  onSubmit,
  onBack,
  loading = false,
  error = null,
}: Props) {
  const [urls, setUrls] = useState<string[]>(["", ""]);

  const updateAt = useCallback((index: number, value: string) => {
    setUrls((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handlePaste = useCallback(
    (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData("text");
      const parts = splitPasted(pasted);
      if (parts.length <= 1) return; // single URL, let default paste happen
      e.preventDefault();
      setUrls((prev) => {
        const next = [...prev];
        // Fill from `index` onward, growing to MAX_URLS if needed
        let cursor = index;
        for (const part of parts) {
          if (cursor >= MAX_URLS) break;
          if (cursor >= next.length) next.push("");
          next[cursor] = part;
          cursor++;
        }
        return next;
      });
    },
    [],
  );

  const addRow = useCallback(() => {
    setUrls((prev) => (prev.length < MAX_URLS ? [...prev, ""] : prev));
  }, []);

  const removeRow = useCallback((index: number) => {
    setUrls((prev) => {
      if (prev.length <= MIN_URLS) {
        // Don't drop below MIN — just clear the field instead
        const next = [...prev];
        next[index] = "";
        return next;
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const trimmed = urls.map((u) => u.trim()).filter(Boolean);
  const validCount = trimmed.filter(isLikelyUrl).length;
  const canSubmit = !loading && validCount >= MIN_URLS && trimmed.length === validCount;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      onSubmit(trimmed);
    },
    [canSubmit, trimmed, onSubmit],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative w-full"
    >
      <div
        aria-hidden
        className="absolute -inset-px rounded-2xl bg-gradient-to-r from-violet-500/30 via-fuchsia-400/20 to-cyan-400/30 opacity-70 blur-xl"
      />

      <form
        onSubmit={handleSubmit}
        className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[0_0_80px_-20px_rgba(139,92,246,0.45)] backdrop-blur-xl"
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <ArrowLeft className="h-3 w-3" />
            Single paper
          </button>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-violet-200">
            <Sparkles className="h-3 w-3" />
            Multiverse · {urls.length}/{MAX_URLS} papers
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {urls.map((url, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/30 px-3 py-2.5 transition-colors focus-within:border-violet-400/40"
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-mono text-zinc-400">
                {i + 1}
              </span>
              <Link2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <input
                type="url"
                value={url}
                onChange={(e) => updateAt(i, e.target.value)}
                onPaste={(e) => handlePaste(i, e)}
                placeholder={
                  i === 0
                    ? "First paper URL (e.g., https://arxiv.org/abs/1412.6980)"
                    : i === 1
                      ? "Second paper URL"
                      : "Third paper URL"
                }
                spellCheck={false}
                autoComplete="off"
                disabled={loading}
                className="peer flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={loading}
                aria-label={`Remove paper ${i + 1}`}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-300 disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {urls.length < MAX_URLS && (
            <button
              type="button"
              onClick={addRow}
              disabled={loading}
              className="inline-flex items-center gap-1.5 self-start rounded-md border border-dashed border-white/10 px-3 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-violet-400/40 hover:text-violet-200 disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              Add a third paper
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 px-1">
          <span className="text-[11px] text-zinc-500">
            {validCount < MIN_URLS
              ? `Need ${MIN_URLS - validCount} more paper${MIN_URLS - validCount === 1 ? "" : "s"} to synthesize`
              : "Tip: paste comma- or newline-separated URLs to fill all rows at once."}
          </span>

          <motion.button
            type="submit"
            disabled={!canSubmit}
            whileHover={canSubmit ? { scale: 1.04 } : undefined}
            whileTap={canSubmit ? { scale: 0.97 } : undefined}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="group relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-lg bg-gradient-to-br from-violet-500 via-violet-600 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-[0_0_24px_-4px_rgba(139,92,246,0.8)] transition-shadow hover:shadow-[0_0_40px_-4px_rgba(139,92,246,1)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
          >
            <span
              aria-hidden
              className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
            {loading ? (
              <Loader2 className="relative h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="relative h-4 w-4" />
            )}
            <span className="relative hidden sm:inline">
              {loading ? "Synthesizing…" : "Synthesize"}
            </span>
            {!loading && <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
          </motion.button>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[11px] text-red-200"
          >
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-300" />
            <span className="break-words">{error}</span>
          </motion.div>
        )}
      </form>
    </motion.div>
  );
}

export default MultiverseInput;
