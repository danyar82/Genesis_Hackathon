"use client";

import { motion } from "framer-motion";
import {
  Binary,
  FunctionSquare,
  Layers,
  Sigma,
  Sliders,
  type LucideIcon,
} from "lucide-react";
import { Equation } from "@/components/Equation";
import type { PaperDna } from "@/components/SandpackExecutor";

const CLASSIFICATION_STYLES: Record<
  string,
  { label: string; accent: string; border: string; text: string }
> = {
  simulation: {
    label: "Simulation",
    accent: "from-violet-500/20 to-fuchsia-500/20",
    border: "border-violet-400/30",
    text: "text-violet-200",
  },
  optimization: {
    label: "Optimization",
    accent: "from-amber-500/20 to-orange-500/20",
    border: "border-amber-400/30",
    text: "text-amber-200",
  },
  statistical_model: {
    label: "Statistical Model",
    accent: "from-emerald-500/20 to-teal-500/20",
    border: "border-emerald-400/30",
    text: "text-emerald-200",
  },
  neural_network: {
    label: "Neural Network",
    accent: "from-indigo-500/20 to-cyan-500/20",
    border: "border-indigo-400/30",
    text: "text-indigo-200",
  },
  physics_engine: {
    label: "Physics Engine",
    accent: "from-blue-500/20 to-cyan-500/20",
    border: "border-blue-400/30",
    text: "text-blue-200",
  },
  economic_model: {
    label: "Economic Model",
    accent: "from-lime-500/20 to-emerald-500/20",
    border: "border-lime-400/30",
    text: "text-lime-200",
  },
  mathematical_proof: {
    label: "Mathematical Proof",
    accent: "from-fuchsia-500/20 to-pink-500/20",
    border: "border-fuchsia-400/30",
    text: "text-fuchsia-200",
  },
  data_visualization: {
    label: "Data Visualization",
    accent: "from-cyan-500/20 to-sky-500/20",
    border: "border-cyan-400/30",
    text: "text-cyan-200",
  },
};

function classificationStyle(classification: string) {
  return (
    CLASSIFICATION_STYLES[classification] ?? {
      label: classification || "Unknown",
      accent: "from-white/10 to-white/5",
      border: "border-white/20",
      text: "text-zinc-200",
    }
  );
}

type Props = {
  paperDna: PaperDna;
  healing?: boolean;
  className?: string;
};

function Section({
  icon: Icon,
  label,
  count,
  children,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
        <Icon className="h-3 w-3" />
        {label}
        {typeof count === "number" && (
          <span className="ml-0.5 rounded-full bg-white/5 px-1.5 py-px text-[9px] text-zinc-400">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export function PaperDnaCard({ paperDna, healing = false, className = "" }: Props) {
  const klass = classificationStyle(paperDna.classification);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`relative flex flex-col gap-5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_60px_-30px_rgba(139,92,246,0.35)] backdrop-blur-md ${className}`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r ${klass.accent} opacity-80`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
            </span>
            Paper DNA
          </div>
        </div>
        {healing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-200"
          >
            <span className="relative flex h-1 w-1">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-300 opacity-75" />
              <span className="relative inline-flex h-1 w-1 rounded-full bg-violet-300" />
            </span>
            Optimizing…
          </motion.div>
        )}
      </div>

      <div>
        <div
          className={`mb-2 inline-flex items-center gap-1.5 rounded-md border ${klass.border} bg-gradient-to-br ${klass.accent} px-2 py-0.5 text-[10px] font-medium ${klass.text}`}
        >
          <Layers className="h-2.5 w-2.5" />
          {klass.label}
        </div>
        <h2 className="text-lg font-semibold leading-snug text-zinc-100 sm:text-[17px]">
          {paperDna.title}
        </h2>
      </div>

      <Section icon={Binary} label="Core Algorithm">
        <p className="text-[12.5px] leading-relaxed text-zinc-400">
          {paperDna.core_algorithm}
        </p>
      </Section>

      <Section
        icon={Sliders}
        label="Parameters"
        count={paperDna.parameters.length}
      >
        {paperDna.parameters.length === 0 ? (
          <p className="text-[11px] italic text-zinc-600">No tunable parameters.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {paperDna.parameters.slice(0, 8).map((p) => (
              <li
                key={p.name}
                className="group flex items-baseline justify-between gap-3 rounded-md px-2 py-1 transition-colors hover:bg-white/[0.02]"
              >
                <span className="truncate font-mono text-[11px] text-zinc-300">
                  {p.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-500">
                  [{formatNum(p.min)} … {formatNum(p.max)}]
                </span>
              </li>
            ))}
            {paperDna.parameters.length > 8 && (
              <li className="px-2 text-[10px] text-zinc-600">
                + {paperDna.parameters.length - 8} more
              </li>
            )}
          </ul>
        )}
      </Section>

      {paperDna.equations.length > 0 && (
        <Section
          icon={Sigma}
          label="Equations"
          count={paperDna.equations.length}
        >
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300">
              <span className="transition-transform group-open:rotate-90">▸</span>
              View {paperDna.equations.length} equation
              {paperDna.equations.length === 1 ? "" : "s"}
            </summary>
            <div className="mt-2 flex flex-col gap-1.5">
              {paperDna.equations.slice(0, 6).map((eq, i) => (
                <Equation
                  key={i}
                  latex={eq}
                  displayMode={false}
                  className="block overflow-x-auto rounded-md border border-white/5 bg-black/30 px-2 py-1.5 text-[11px] leading-snug text-zinc-200"
                />
              ))}
              {paperDna.equations.length > 6 && (
                <span className="text-[10px] text-zinc-600">
                  + {paperDna.equations.length - 6} more
                </span>
              )}
            </div>
          </details>
        </Section>
      )}

      <Section icon={FunctionSquare} label="Visualization">
        <div className="inline-flex items-center gap-1.5 rounded-md border border-white/5 bg-white/[0.02] px-2 py-1 font-mono text-[10.5px] text-zinc-300">
          {paperDna.visualization_type}
        </div>
      </Section>
    </motion.div>
  );
}

function formatNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  const abs = Math.abs(v);
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 1) return v.toFixed(2);
  if (abs >= 0.01) return v.toFixed(3);
  return v.toExponential(1);
}
