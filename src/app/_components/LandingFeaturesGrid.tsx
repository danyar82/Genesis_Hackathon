"use client";

import { motion } from "framer-motion";
import {
  BrainCircuit,
  Compass,
  Layers3,
  ShieldCheck,
  Wand2,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  title: string;
  oneLiner: string;
  description: string;
  icon: LucideIcon;
  /** CSS color used for the icon glow + chip dot. */
  color: string;
  /** Tailwind classes applied on hover for the colored shadow lift. */
  glow: string;
  /** Tailwind border tint used as the resting card outline. */
  border: string;
  /** Tailwind classes for the radial-gradient surface tint. */
  surface: string;
  /** Tailwind classes for the icon-tile background ring. */
  iconRing: string;
};

const FEATURES: Feature[] = [
  {
    title: "Core Extraction",
    oneLiner: "Paper to working simulation in 60 seconds.",
    description:
      "Opus 4.7 reads the paper end-to-end, extracts the canonical algorithm, and emits a runnable kernel you can scrub in real time.",
    icon: Wand2,
    color: "#a78bfa",
    border: "border-violet-400/20",
    glow: "hover:shadow-[0_0_60px_-12px_rgba(167,139,250,0.55)]",
    surface: "from-violet-500/[0.10] via-violet-500/[0.02] to-transparent",
    iconRing: "border-violet-400/30 bg-violet-500/15 text-violet-200",
  },
  {
    title: "GENESIS Multiverse",
    oneLiner: "Side-by-side algorithm comparison.",
    description:
      "Drop in 2–3 papers and Genesis fuses them into a single chart so competing methods can be swept against the same parameter axis.",
    icon: Layers3,
    color: "#22d3ee",
    border: "border-cyan-400/20",
    glow: "hover:shadow-[0_0_60px_-12px_rgba(34,211,238,0.55)]",
    surface: "from-cyan-500/[0.10] via-cyan-500/[0.02] to-transparent",
    iconRing: "border-cyan-400/30 bg-cyan-500/15 text-cyan-200",
  },
  {
    title: "Agentic Audit",
    oneLiner: "Peer-review protocol & reproducibility check.",
    description:
      "An autonomous reviewer extracts the paper's numerical claims and runs them against the live kernel — pass / fail with provenance.",
    icon: ShieldCheck,
    color: "#34d399",
    border: "border-emerald-400/20",
    glow: "hover:shadow-[0_0_60px_-12px_rgba(52,211,153,0.55)]",
    surface: "from-emerald-500/[0.10] via-emerald-500/[0.02] to-transparent",
    iconRing: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
  },
  {
    title: "Autonomous Discovery",
    oneLiner: "Parameter hunting & edge-case testing.",
    description:
      "Genesis sweeps the parameter space, surfaces phase transitions, instabilities, and regimes the original authors never reported.",
    icon: Compass,
    color: "#fbbf24",
    border: "border-amber-400/20",
    glow: "hover:shadow-[0_0_60px_-12px_rgba(251,191,36,0.55)]",
    surface: "from-amber-500/[0.10] via-amber-500/[0.02] to-transparent",
    iconRing: "border-amber-400/30 bg-amber-500/15 text-amber-200",
  },
  {
    title: "GENESIS Memory",
    oneLiner: "Cross-session self-improvement.",
    description:
      "Every kernel, audit, and debate writes to a long-term memory the agents read on the next run — Genesis genuinely gets better with use.",
    icon: BrainCircuit,
    color: "#f472b6",
    border: "border-pink-400/20",
    glow: "hover:shadow-[0_0_60px_-12px_rgba(244,114,182,0.55)]",
    surface: "from-pink-500/[0.10] via-pink-500/[0.02] to-transparent",
    iconRing: "border-pink-400/30 bg-pink-500/15 text-pink-200",
  },
];

export default function LandingFeaturesGrid() {
  return (
    <section className="relative w-full">
      <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400 backdrop-blur-md">
          What Genesis does
        </span>
        <h2 className="mt-4 max-w-2xl bg-gradient-to-br from-white via-zinc-100 to-zinc-400 bg-clip-text text-3xl font-semibold leading-tight tracking-tight text-transparent sm:text-4xl md:text-[44px]">
          A research lab that runs at the speed of thought.
        </h2>
        <p className="mt-4 max-w-xl text-balance text-[14px] leading-relaxed text-zinc-400 sm:text-[15px]">
          Five autonomous capabilities, one continuous pipeline. Each can be
          composed with the others — extract, then audit, then debate, then
          discover.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-5 xl:grid-cols-5">
        {FEATURES.map((feat, i) => (
          <FeatureCard key={feat.title} feat={feat} index={i} />
        ))}
      </div>
    </section>
  );
}

function FeatureCard({ feat, index }: { feat: Feature; index: number }) {
  const Icon = feat.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: 0.55,
        delay: 0.05 * index,
        ease: [0.2, 0.8, 0.2, 1],
      }}
      className={`group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-[#070712]/85 p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 ${feat.border} ${feat.glow}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${feat.surface} opacity-80 transition-opacity duration-500 group-hover:opacity-100`}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${feat.color}aa, transparent)`,
        }}
      />

      <div className="relative flex items-center justify-between gap-3">
        <div
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${feat.iconRing}`}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-xl opacity-30 blur-lg transition-opacity duration-500 group-hover:opacity-60"
            style={{ background: feat.color }}
          />
          <Icon className="relative h-5 w-5" />
        </div>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500"
          aria-hidden
        >
          /0{index + 1}
        </span>
      </div>

      <div className="relative">
        <h3 className="text-[15px] font-semibold tracking-tight text-zinc-100 sm:text-base">
          {feat.title}
        </h3>
        <p
          className="mt-1 text-[12.5px] font-medium leading-snug"
          style={{ color: feat.color }}
        >
          {feat.oneLiner}
        </p>
      </div>

      <p className="relative text-[12.5px] leading-relaxed text-zinc-400">
        {feat.description}
      </p>
    </motion.div>
  );
}
