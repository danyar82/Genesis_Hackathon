"use client";

import { motion } from "framer-motion";

const BASE_COUNT = 16;

type Props = {
  size?: number;
  count?: number;
};

/**
 * Premium AI-processing-core visual.
 *
 * Composition (back-to-front):
 *   1. Outer violet aura  — slow scale-breath, ~4.8 s
 *   2. Cyan counter-aura  — slightly slower, phase-offset, ~5.6 s
 *   3. Inner white core    — bright pulse, ~3.2 s
 *   4. Rotating helix      — 3D dot strands, slowed to 5 s/turn for a contemplative pace
 *   5. Floating motes      — 5 violet/cyan particles drifting upward, polyrhythmic
 *
 * The whole assembly gently floats vertically (~6.5 s ease-in-out) and breathes in scale.
 * Polyrhythmic timings (3.2 / 4.8 / 5 / 5.6 / 6.5) prevent visual lock-step → feels organic.
 */
export function DnaHelix({ size = 220, count = BASE_COUNT }: Props) {
  const height = size * 1.6;
  const radius = size * 0.22;

  return (
    <motion.div
      className="relative select-none"
      style={{ width: size, height, perspective: size * 3 }}
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: [0, -6, 0],
      }}
      transition={{
        opacity: { duration: 0.8, ease: "easeOut" },
        scale: { duration: 1.2, ease: [0.16, 1, 0.3, 1] },
        y: {
          duration: 6.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.6,
        },
      }}
      aria-label="Loading"
      role="status"
    >
      {/* Outer violet aura — slow breath */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-x-16 -inset-y-12"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.38), transparent 65%)",
          filter: "blur(42px)",
        }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Cyan counter-aura — phase-offset, slightly larger envelope */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 -inset-y-8"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(34, 211, 238, 0.30), transparent 60%)",
          filter: "blur(36px)",
        }}
        animate={{ scale: [1.05, 0.9, 1.05], opacity: [0.45, 0.75, 0.45] }}
        transition={{
          duration: 5.6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.2,
        }}
      />

      {/* Inner core — bright pulsing center, simulates "compute heat" */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: size * 0.45,
          height: size * 0.45,
          marginLeft: -(size * 0.225),
          marginTop: -(size * 0.225),
          background:
            "radial-gradient(circle at center, rgba(255, 255, 255, 0.22), rgba(167, 139, 250, 0.20) 35%, transparent 70%)",
          filter: "blur(20px)",
        }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Rotating helix — slowed to 5s for a contemplative pace */}
      <div
        className="absolute inset-0 animate-[helix-spin_5s_linear_infinite]"
        style={{ transformStyle: "preserve-3d" }}
      >
        {Array.from({ length: count }, (_, i) => {
          const t = i / (count - 1);
          const y = (t - 0.5) * height;
          const angle = t * 720;
          const aColor = "#a78bfa";
          const bColor = "#22d3ee";
          // Stagger per-node opacity pulse so brightness flows DOWN the strand
          const delay = (i / count) * 1.6;
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2"
              style={{ transform: "translate(-50%, -50%)" }}
            >
              <span
                className="absolute block h-2.5 w-2.5 rounded-full animate-[helix-node_2.6s_ease-in-out_infinite]"
                style={{
                  background: aColor,
                  boxShadow: `0 0 16px ${aColor}, 0 0 4px #fff inset`,
                  transform: `translateY(${y}px) rotateY(${angle}deg) translateZ(${radius}px)`,
                  animationDelay: `${delay}s`,
                }}
              />
              <span
                className="absolute block h-2.5 w-2.5 rounded-full animate-[helix-node_2.6s_ease-in-out_infinite]"
                style={{
                  background: bColor,
                  boxShadow: `0 0 16px ${bColor}, 0 0 4px #fff inset`,
                  transform: `translateY(${y}px) rotateY(${angle + 180}deg) translateZ(${radius}px)`,
                  animationDelay: `${delay + 1.3}s`,
                }}
              />
              <span
                className="absolute block"
                style={{
                  width: radius * 2,
                  height: 1,
                  left: -radius,
                  background:
                    "linear-gradient(90deg, rgba(167,139,250,0.5), rgba(34,211,238,0.5))",
                  transform: `translateY(${y}px) rotateY(${angle}deg)`,
                  opacity: 0.7,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Floating motes — drift up + opacity pulse, polyrhythmic */}
      {[
        { x: 18, y: 78, color: "rgba(167, 139, 250, 0.7)", duration: 5.6, delay: 0 },
        { x: 82, y: 62, color: "rgba(34, 211, 238, 0.7)", duration: 6.4, delay: 0.8 },
        { x: 30, y: 38, color: "rgba(167, 139, 250, 0.6)", duration: 7.0, delay: 1.4 },
        { x: 70, y: 22, color: "rgba(34, 211, 238, 0.6)", duration: 5.2, delay: 2.0 },
        { x: 50, y: 90, color: "rgba(232, 190, 255, 0.55)", duration: 6.8, delay: 2.6 },
      ].map((mote, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute h-1 w-1 rounded-full"
          style={{
            left: `${mote.x}%`,
            top: `${mote.y}%`,
            background: mote.color,
            boxShadow: `0 0 6px ${mote.color}`,
          }}
          animate={{
            y: [0, -28, -56],
            opacity: [0, 0.9, 0],
          }}
          transition={{
            duration: mote.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: mote.delay,
            times: [0, 0.5, 1],
          }}
        />
      ))}
    </motion.div>
  );
}

export default DnaHelix;
