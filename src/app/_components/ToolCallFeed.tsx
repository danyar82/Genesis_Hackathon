"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, Loader2 } from "lucide-react";

export type ToolCallState = "running" | "success" | "error";

export type ToolCall = {
  id: string;
  name: string;
  argSummary: string;
  state: ToolCallState;
  resultSummary?: string;
};

type Props = {
  calls: ToolCall[];
};

const STATE_STYLES: Record<
  ToolCallState,
  { dot: string; ring: string; text: string }
> = {
  running: {
    dot: "bg-violet-300",
    ring: "border-violet-400/40 bg-violet-500/10",
    text: "text-violet-100",
  },
  success: {
    dot: "bg-emerald-300",
    ring: "border-emerald-400/40 bg-emerald-500/10",
    text: "text-emerald-100",
  },
  error: {
    dot: "bg-red-300",
    ring: "border-red-400/40 bg-red-500/10",
    text: "text-red-100",
  },
};

export function ToolCallFeed({ calls }: Props) {
  if (calls.length === 0) return null;

  return (
    <div className="mt-4 border-t border-white/5 pt-3">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        Tool calls
        <span className="rounded-full bg-white/5 px-1.5 py-px text-[9px] text-zinc-400">
          {calls.length}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {calls.map((call) => {
            const style = STATE_STYLES[call.state];
            return (
              <motion.li
                key={call.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={`relative rounded-md border ${style.ring} px-2.5 py-1.5`}
              >
                <div className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    {call.state === "running" && (
                      <span
                        className={`absolute inline-flex h-full w-full animate-ping rounded-full ${style.dot} opacity-75`}
                      />
                    )}
                    <span
                      className={`relative inline-flex h-1.5 w-1.5 rounded-full ${style.dot}`}
                    />
                  </span>
                  <span
                    className={`truncate font-mono text-[11px] font-medium ${style.text}`}
                  >
                    {call.name}
                  </span>
                  <span className="ml-auto inline-flex shrink-0 items-center">
                    {call.state === "running" ? (
                      <Loader2 className="h-3 w-3 animate-spin text-violet-300" />
                    ) : call.state === "success" ? (
                      <Check className="h-3 w-3 text-emerald-300" strokeWidth={3} />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-300" />
                    )}
                  </span>
                </div>
                <div className="ml-3.5 mt-0.5 truncate font-mono text-[10px] text-zinc-500">
                  {call.argSummary}
                </div>
                {call.resultSummary && (
                  <div className="ml-3.5 mt-0.5 truncate text-[10px] text-zinc-400">
                    → {call.resultSummary}
                  </div>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

export default ToolCallFeed;
