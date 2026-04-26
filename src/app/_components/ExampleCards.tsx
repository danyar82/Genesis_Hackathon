"use client";

import { motion } from "framer-motion";
import {
  Activity,
  Atom,
  BrainCircuit,
  Infinity as InfinityIcon,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  CURATED_EXAMPLES,
  type CuratedExample,
  type ExampleDomain,
} from "../_data/examples";

type DomainStyle = {
  Icon: LucideIcon;
  accent: string;
};

const DOMAIN_STYLES: Record<ExampleDomain, DomainStyle> = {
  physics: {
    Icon: Atom,
    accent: "from-violet-400/60 to-fuchsia-400/60",
  },
  ml: {
    Icon: BrainCircuit,
    accent: "from-indigo-400/60 to-cyan-400/60",
  },
  economics: {
    Icon: TrendingUp,
    accent: "from-amber-400/60 to-orange-400/60",
  },
  biology: {
    Icon: Activity,
    accent: "from-cyan-400/60 to-emerald-400/60",
  },
  math: {
    Icon: InfinityIcon,
    accent: "from-fuchsia-400/60 to-pink-400/60",
  },
};

type Props = {
  onSelect?: (example: CuratedExample) => void;
  disabled?: boolean;
};

export default function ExampleCards({ onSelect, disabled = false }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.75, ease: "easeOut" }}
      className="w-full"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Try a curated demo
        </span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent via-white/10 to-transparent" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {CURATED_EXAMPLES.map((example, i) => {
          const style = DOMAIN_STYLES[example.domain];
          const { Icon, accent } = style;
          return (
            <motion.button
              key={example.slug}
              type="button"
              onClick={() => onSelect?.(example)}
              disabled={disabled}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.85 + i * 0.06,
                ease: "easeOut",
              }}
              whileHover={disabled ? undefined : { y: -4 }}
              whileTap={disabled ? undefined : { y: -1 }}
              className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-3.5 text-left backdrop-blur-md transition-colors hover:border-white/20 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r ${accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
              />
              <div
                aria-hidden
                className={`pointer-events-none absolute -inset-10 bg-gradient-to-br ${accent} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-[0.1]`}
              />

              <div className="relative flex flex-col gap-2.5">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br ${accent} bg-opacity-20`}
                >
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="line-clamp-2 text-[12.5px] font-medium leading-tight text-zinc-100">
                    {example.cardTitle}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-zinc-500">
                    {example.cardTag}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
