"use client";

import { History } from "lucide-react";

type Props = {
  onClick: () => void;
  count: number;
};

export function HistoryButton({ onClick, count }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Open history (${count} ${count === 1 ? "entry" : "entries"})`}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-100"
    >
      <History className="h-3 w-3" />
      History
      <span className="ml-0.5 rounded-full bg-violet-500/30 px-1.5 text-[10px] text-violet-100">
        {count}
      </span>
    </button>
  );
}

export default HistoryButton;
