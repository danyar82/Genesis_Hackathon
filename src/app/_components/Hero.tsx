"use client";

import { motion } from "framer-motion";

export default function Hero() {
  return (
    <div className="relative flex w-full flex-col items-center text-center">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur-md sm:text-[13px]"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
        </span>
        Powered by Claude Opus 4.7
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
        className="mt-6 bg-gradient-to-br from-white via-violet-200 to-cyan-300 bg-clip-text font-sans text-6xl font-bold leading-[0.9] tracking-tight text-transparent sm:text-7xl md:text-8xl"
        style={{ letterSpacing: "-0.04em" }}
      >
        GENESIS
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
        className="mt-5 max-w-2xl text-balance text-base text-zinc-300 sm:text-lg md:text-xl"
      >
        From Research Paper to Working Prototype in{" "}
        <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text font-medium text-transparent">
          60 seconds
        </span>
        .
      </motion.p>
    </div>
  );
}
