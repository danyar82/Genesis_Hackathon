"use client";

import { motion } from "framer-motion";

type Orb = {
  className: string;
  initial: { x: string; y: string; scale: number };
  animate: { x: string[]; y: string[]; scale: number[] };
  duration: number;
};

const orbs: Orb[] = [
  {
    className:
      "bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.55),transparent_65%)] top-[-10%] left-[-10%] h-[55vmax] w-[55vmax]",
    initial: { x: "0%", y: "0%", scale: 1 },
    animate: {
      x: ["0%", "8%", "-4%", "0%"],
      y: ["0%", "6%", "-8%", "0%"],
      scale: [1, 1.1, 0.95, 1],
    },
    duration: 22,
  },
  {
    className:
      "bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.4),transparent_65%)] top-[30%] right-[-15%] h-[50vmax] w-[50vmax]",
    initial: { x: "0%", y: "0%", scale: 1 },
    animate: {
      x: ["0%", "-6%", "4%", "0%"],
      y: ["0%", "-10%", "6%", "0%"],
      scale: [1, 0.92, 1.08, 1],
    },
    duration: 26,
  },
  {
    className:
      "bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.35),transparent_65%)] bottom-[-20%] left-[20%] h-[45vmax] w-[45vmax]",
    initial: { x: "0%", y: "0%", scale: 1 },
    animate: {
      x: ["0%", "10%", "-6%", "0%"],
      y: ["0%", "-4%", "8%", "0%"],
      scale: [1, 1.06, 0.96, 1],
    },
    duration: 30,
  },
  {
    className:
      "bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.28),transparent_70%)] top-[45%] left-[35%] h-[35vmax] w-[35vmax]",
    initial: { x: "0%", y: "0%", scale: 1 },
    animate: {
      x: ["0%", "-8%", "6%", "0%"],
      y: ["0%", "8%", "-6%", "0%"],
      scale: [1, 1.12, 0.9, 1],
    },
    duration: 34,
  },
];

export default function BackgroundOrbs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-3xl opacity-70 mix-blend-screen ${orb.className}`}
          initial={orb.initial}
          animate={orb.animate}
          transition={{
            duration: orb.duration,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      ))}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />
      <div className="absolute inset-0 bg-[#050509]/40" />
    </div>
  );
}
