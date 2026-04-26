"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Library, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CANON_CATEGORY_TOKENS,
  CANON_ENTRIES,
  type CanonEntry,
} from "@/data/canon";

type Props = {
  onSelect: (entry: CanonEntry) => void;
};

/**
 * Netflix-style horizontal scroll strip of pre-computed canonical papers.
 * Each card glows in its category color on hover; clicking instant-loads
 * the entry into the live dashboard with no extraction delay.
 */
export default function CanonCarousel({ onSelect }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(
      el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    );
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.max(280, el.clientWidth - 80);
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative w-full"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3 px-1 sm:px-2">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-violet-500/20 via-cyan-500/15 to-amber-500/15">
            <Library className="h-4 w-4 text-violet-200" />
            <span className="absolute inset-0 animate-pulse rounded-lg bg-violet-500/10 blur-md" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-[15px] font-semibold tracking-tight text-zinc-100 sm:text-base">
                The Canon
              </h3>
              <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                pre-computed legends
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-zinc-400">
              <Zap className="mr-1 inline h-3 w-3 text-amber-300" />
              Click any card for instant 0-second load — no extraction delay.
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-1.5 sm:flex">
          <CarouselArrow
            disabled={!canScrollLeft}
            onClick={() => scrollByPage(-1)}
            direction="left"
          />
          <CarouselArrow
            disabled={!canScrollRight}
            onClick={() => scrollByPage(1)}
            direction="right"
          />
        </div>
      </div>

      {/* Edge fade overlays */}
      <div className="relative">
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#050509] via-[#050509]/80 to-transparent transition-opacity ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#050509] via-[#050509]/80 to-transparent transition-opacity ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          ref={scrollerRef}
          className="canon-scroller flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3 pt-1 sm:gap-4 sm:px-2"
          style={{ scrollbarWidth: "none" }}
        >
          {CANON_ENTRIES.map((entry, i) => (
            <CanonCard
              key={entry.slug}
              entry={entry}
              index={i}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        .canon-scroller::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </motion.section>
  );
}

function CarouselArrow({
  disabled,
  onClick,
  direction,
}: {
  disabled: boolean;
  onClick: () => void;
  direction: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Scroll left" : "Scroll right"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-zinc-300 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:bg-white/[0.03]"
    >
      {direction === "left" ? (
        <ChevronLeft className="h-4 w-4" />
      ) : (
        <ChevronRight className="h-4 w-4" />
      )}
    </button>
  );
}

function CanonCard({
  entry,
  index,
  onSelect,
}: {
  entry: CanonEntry;
  index: number;
  onSelect: (entry: CanonEntry) => void;
}) {
  const tokens = CANON_CATEGORY_TOKENS[entry.category];
  const authorLine =
    entry.authors.length === 1
      ? entry.authors[0]
      : entry.authors.length === 2
        ? entry.authors.join(" & ")
        : `${entry.authors[0]} et al.`;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(entry)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: 0.04 * index,
        ease: [0.2, 0.8, 0.2, 1],
      }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      className={`group relative flex h-[200px] w-[260px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border bg-[#070712] p-4 text-left backdrop-blur-md transition-all duration-300 sm:h-[210px] sm:w-[280px] sm:p-5 ${tokens.border} ${tokens.glow}`}
    >
      {/* Top accent bar */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${tokens.color}, transparent)`,
        }}
      />

      {/* Category-tinted gradient surface */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tokens.gradient} opacity-80 transition-opacity duration-500 group-hover:opacity-100`}
      />

      {/* Content */}
      <div className="relative flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] ${tokens.chip}`}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: tokens.color,
              boxShadow: `0 0 6px ${tokens.color}`,
            }}
          />
          {tokens.label}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-zinc-500">
          {entry.year}
        </span>
      </div>

      <div className="relative">
        <h4
          className="text-[14.5px] font-semibold leading-tight text-zinc-100 sm:text-[15px]"
          title={entry.title}
        >
          {entry.shortTitle}
        </h4>
        <p
          className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-zinc-400"
          title={entry.tagline}
        >
          {entry.tagline}
        </p>
      </div>

      <div className="relative flex items-center justify-between gap-2 text-[10px]">
        <span
          className="truncate text-zinc-500"
          title={entry.authors.join(", ")}
        >
          {authorLine}
        </span>
        <span
          className="inline-flex items-center gap-1 font-mono uppercase tracking-[0.18em] transition-colors group-hover:text-zinc-200"
          style={{ color: tokens.color }}
        >
          <Zap className="h-2.5 w-2.5" />
          instant
        </span>
      </div>
    </motion.button>
  );
}
