import type { PaperDna } from "@/types/paperDna";
import rawCanon from "./canonData.json";

/** Discipline buckets for the Canon. Each maps to a distinct accent color
 * applied to its card border, glow, and category chip. */
export type CanonCategory =
  | "physics"
  | "biology"
  | "ml"
  | "math"
  | "chemistry";

export type CanonEntry = {
  /** Stable slug used as the share/cache key. Format: lowercase-kebab-with-year. */
  slug: string;
  /** Formal paper title (factual reference). */
  title: string;
  /** Short display title for the carousel card. */
  shortTitle: string;
  /** Authors (factual reference). */
  authors: string[];
  /** Publication year. */
  year: number;
  category: CanonCategory;
  /** One-sentence hook shown on the card. */
  tagline: string;
  /** Optional original-source URL for "view paper" links. */
  originalUrl?: string;
  /** Pre-computed Paper DNA — kernel and parameters ready to mount. */
  dna: PaperDna;
};

type CanonFile = {
  version: number;
  entries: CanonEntry[];
};

const file = rawCanon as CanonFile;

export const CANON_ENTRIES: readonly CanonEntry[] = Object.freeze(
  [...file.entries],
);

export function getCanonEntry(slug: string): CanonEntry | undefined {
  return CANON_ENTRIES.find((e) => e.slug === slug);
}

/** Visual tokens per category. Used by both the carousel cards and any
 * downstream "Canon · physics" pills in the live stage. */
export const CANON_CATEGORY_TOKENS: Record<
  CanonCategory,
  {
    label: string;
    color: string; // primary accent (used in glows + dot)
    border: string; // tailwind border-color class
    glow: string; // tailwind shadow class for hover
    chip: string; // tailwind classes for the category chip
    gradient: string; // tailwind gradient classes for the card surface
  }
> = {
  physics: {
    label: "Physics",
    color: "#3b82f6",
    border: "border-blue-400/30",
    glow: "hover:shadow-[0_0_60px_-10px_rgba(59,130,246,0.55)]",
    chip: "border-blue-400/30 bg-blue-500/10 text-blue-200",
    gradient: "from-blue-500/[0.08] via-blue-500/[0.02] to-transparent",
  },
  biology: {
    label: "Biology",
    color: "#10b981",
    border: "border-emerald-400/30",
    glow: "hover:shadow-[0_0_60px_-10px_rgba(16,185,129,0.55)]",
    chip: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    gradient: "from-emerald-500/[0.08] via-emerald-500/[0.02] to-transparent",
  },
  ml: {
    label: "Machine Learning",
    color: "#a78bfa",
    border: "border-violet-400/30",
    glow: "hover:shadow-[0_0_60px_-10px_rgba(167,139,250,0.55)]",
    chip: "border-violet-400/30 bg-violet-500/10 text-violet-200",
    gradient: "from-violet-500/[0.08] via-violet-500/[0.02] to-transparent",
  },
  math: {
    label: "Mathematics",
    color: "#f59e0b",
    border: "border-amber-400/30",
    glow: "hover:shadow-[0_0_60px_-10px_rgba(245,158,11,0.55)]",
    chip: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    gradient: "from-amber-500/[0.08] via-amber-500/[0.02] to-transparent",
  },
  chemistry: {
    label: "Chemistry",
    color: "#ec4899",
    border: "border-pink-400/30",
    glow: "hover:shadow-[0_0_60px_-10px_rgba(236,72,153,0.55)]",
    chip: "border-pink-400/30 bg-pink-500/10 text-pink-200",
    gradient: "from-pink-500/[0.08] via-pink-500/[0.02] to-transparent",
  },
};
