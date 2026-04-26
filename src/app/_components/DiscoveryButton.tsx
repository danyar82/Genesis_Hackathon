"use client";

import { Telescope } from "lucide-react";

type Props = {
  active: boolean;
  onClick: () => void;
};

export function DiscoveryButton({ active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Autonomous parameter-space hunter — find phase transitions, chaos boundaries, optimal points"
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
        active
          ? "border-violet-400/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25"
          : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/25 hover:bg-white/10 hover:text-zinc-100"
      }`}
    >
      <Telescope className="h-3 w-3" />
      {active ? "Discovering" : "Discover"}
    </button>
  );
}

export default DiscoveryButton;
