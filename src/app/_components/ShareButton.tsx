"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Link2, Share2 } from "lucide-react";
import { useCallback, useState } from "react";
import {
  buildShareUrl,
  copyToClipboard,
  type ShareTarget,
} from "../_lib/share";

type Props = {
  target: ShareTarget;
  className?: string;
};

export function ShareButton({ target, className = "" }: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const handleClick = useCallback(async () => {
    const path = buildShareUrl(target);
    const url =
      typeof window !== "undefined" ? window.location.origin + path : path;

    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setError(false);
      setTimeout(() => setCopied(false), 1800);
    } else {
      setError(true);
      setTimeout(() => setError(false), 1800);
    }
  }, [target]);

  const label = copied ? "Copied!" : error ? "Copy failed" : "Share";

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`group relative inline-flex items-center gap-1.5 overflow-hidden rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-zinc-100 ${className}`}
      aria-label="Copy shareable link to this visualization"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-violet-400/15 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.2 }}
            className="relative flex items-center gap-1.5 text-emerald-200"
          >
            <Check className="h-3 w-3" strokeWidth={3} />
            {label}
          </motion.span>
        ) : error ? (
          <motion.span
            key="err"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className="relative flex items-center gap-1.5 text-red-200"
          >
            <Link2 className="h-3 w-3" />
            {label}
          </motion.span>
        ) : (
          <motion.span
            key="share"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex items-center gap-1.5"
          >
            <Share2 className="h-3 w-3" />
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export default ShareButton;
