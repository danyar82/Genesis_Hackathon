"use client";

import { motion } from "framer-motion";

type Props = {
  onReset: () => void;
};

/**
 * Persistent brand mark + global "return to home" button.
 *
 * Always visible at the top-left of the viewport (fixed positioning).
 * Click → onReset (typically GenesisPipeline.handleReset, which aborts every
 * in-flight controller, clears state, and routes back to idle).
 *
 * Glyph is an atomic-structure motif: hex frame, inner orbit ring, center dot.
 * Hex rotates 60° on hover (the natural symmetry step of a hexagon, so it
 * appears identical when settled — gives motion without breaking the form).
 */
export function AppLogo({ onReset }: Props) {
  return (
    <motion.button
      type="button"
      onClick={onReset}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      whileTap={{ scale: 0.96 }}
      aria-label="Return to home"
      title="Return to home"
      className="group fixed left-3 top-3 z-50 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 backdrop-blur-md transition-colors hover:border-violet-400/40 hover:bg-black/60 sm:left-5 sm:top-5"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-500 ease-out group-hover:rotate-[60deg]"
      >
        <defs>
          <linearGradient
            id="genesis-logo-grad"
            x1="2"
            y1="2"
            x2="22"
            y2="22"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <path
          d="M12 2.5L20.5 7.25V16.75L12 21.5L3.5 16.75V7.25L12 2.5Z"
          stroke="url(#genesis-logo-grad)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle
          cx="12"
          cy="12"
          r="3.75"
          stroke="url(#genesis-logo-grad)"
          strokeWidth="1.25"
          opacity="0.65"
        />
        <circle cx="12" cy="12" r="1.5" fill="url(#genesis-logo-grad)" />
      </svg>
      <span className="bg-gradient-to-r from-white via-violet-200 to-cyan-300 bg-clip-text text-[12px] font-semibold tracking-[0.18em] text-transparent">
        GENESIS
      </span>
    </motion.button>
  );
}

export default AppLogo;
