"use client";

import { Swords } from "lucide-react";

type Props = {
  active: boolean;
  onClick: () => void;
};

export function DebateButton({ active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Spawn two Opus 4.7 agents to debate the paper's methodology"
      className={`group relative inline-flex items-center gap-1.5 overflow-hidden rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
        active
          ? "border-rose-400/40 bg-gradient-to-r from-rose-500/15 via-violet-500/15 to-cyan-500/15 text-rose-100 hover:from-rose-500/25 hover:via-violet-500/25 hover:to-cyan-500/25"
          : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/25 hover:bg-white/10 hover:text-zinc-100"
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 ${
          active ? "group-hover:translate-x-full" : ""
        }`}
      />
      <Swords className="relative h-3 w-3" />
      <span className="relative">{active ? "Debate live" : "Start AI Debate"}</span>
    </button>
  );
}

export default DebateButton;
