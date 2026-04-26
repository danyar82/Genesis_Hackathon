"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock, History, Layers, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  clearHistory,
  getHistory,
  removeFromHistory,
  subscribeToHistory,
  type HistoryEntry,
} from "../_lib/history";

type Props = {
  onSelect: (entry: HistoryEntry) => void;
  /**
   * Optional controlled-open mode. When provided, the parent owns the state
   * (used by the live stage to drive opening from an inline header button).
   */
  controlled?: { open: boolean; onOpenChange: (open: boolean) => void };
  /**
   * Hide the floating fixed top-right trigger button. Use when the parent
   * provides its own trigger (e.g. inside the live header cluster).
   */
  hideTrigger?: boolean;
};

const CLASS_ACCENT: Record<string, string> = {
  simulation: "from-violet-500/30 to-fuchsia-500/30",
  optimization: "from-amber-500/30 to-orange-500/30",
  statistical_model: "from-emerald-500/30 to-teal-500/30",
  neural_network: "from-indigo-500/30 to-cyan-500/30",
  physics_engine: "from-blue-500/30 to-cyan-500/30",
  economic_model: "from-lime-500/30 to-emerald-500/30",
  mathematical_proof: "from-fuchsia-500/30 to-pink-500/30",
  data_visualization: "from-cyan-500/30 to-sky-500/30",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function HistorySidebar({ onSelect, controlled, hideTrigger }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? controlled.open : internalOpen;
  const setOpen = controlled ? controlled.onOpenChange : setInternalOpen;
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const refresh = useCallback(() => {
    setEntries(getHistory());
  }, []);

  useEffect(() => {
    refresh();
    return subscribeToHistory(refresh);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <AnimatePresence>
        {!hideTrigger && entries.length > 0 && (
          <motion.button
            type="button"
            key="history-toggle"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            aria-label={`Open history (${entries.length} entries)`}
            className="fixed right-4 top-4 z-30 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[11px] font-medium text-zinc-200 shadow-[0_0_24px_-8px_rgba(139,92,246,0.5)] backdrop-blur-md transition-colors hover:border-violet-400/40 hover:text-white"
          >
            <History className="h-3 w-3" />
            History
            <span className="ml-0.5 rounded-full bg-violet-500/30 px-1.5 text-[10px] text-violet-100">
              {entries.length}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />

            <motion.aside
              key="panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[#080811]/95 shadow-[0_0_80px_-20px_rgba(139,92,246,0.4)] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                    <History className="h-3 w-3" />
                    History
                  </div>
                  <div className="mt-0.5 text-sm text-zinc-200">
                    {entries.length} recent visualization
                    {entries.length === 1 ? "" : "s"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close history"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] text-zinc-400 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3">
                {entries.length === 0 ? (
                  <div className="mt-12 flex flex-col items-center gap-2 px-4 text-center">
                    <Clock className="h-5 w-5 text-zinc-600" />
                    <div className="text-sm text-zinc-400">
                      No visualizations yet
                    </div>
                    <div className="text-[11px] text-zinc-600">
                      Generated papers will appear here.
                    </div>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    <AnimatePresence initial={false}>
                      {entries.map((entry) => {
                        const accent =
                          CLASS_ACCENT[entry.classification] ??
                          "from-white/10 to-white/5";
                        return (
                          <motion.li
                            key={entry.id}
                            layout
                            initial={{ opacity: 0, x: 16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 16 }}
                            transition={{ duration: 0.22 }}
                            className="group relative"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onSelect(entry);
                                setOpen(false);
                              }}
                              className="relative block w-full overflow-hidden rounded-lg border border-white/5 bg-white/[0.02] p-3 pr-8 text-left transition-colors hover:border-white/20 hover:bg-white/[0.04]"
                            >
                              <div
                                aria-hidden
                                className={`pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r ${accent}`}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                                  <Layers className="h-2.5 w-2.5" />
                                  {entry.classification.replace(/_/g, " ")}
                                  <span className="text-zinc-700">·</span>
                                  {entry.source === "example" ? "demo" : "live"}
                                </div>
                                <div className="mt-1 line-clamp-2 text-[12.5px] font-medium text-zinc-100">
                                  {entry.title}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                                  <span>{timeAgo(entry.timestamp)}</span>
                                  <span className="font-mono text-zinc-600">
                                    {entry.visualization_type}
                                  </span>
                                </div>
                              </div>
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove ${entry.title}`}
                              onClick={() => removeFromHistory(entry.id)}
                              className="absolute right-2 top-2 z-10 rounded p-1 text-zinc-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </div>

              {entries.length > 0 && (
                <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
                  <span className="text-[10px] text-zinc-600">
                    Stored locally in your browser
                  </span>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="inline-flex items-center gap-1 rounded-md border border-white/5 bg-white/[0.02] px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-200"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                    Clear all
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default HistorySidebar;
