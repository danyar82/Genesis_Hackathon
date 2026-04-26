"use client";

import { motion, useReducedMotion } from "framer-motion";

type Props = {
  elapsedSeconds: number;
  size?: number;
};

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.min(99 * 60 + 59, Math.floor(seconds)));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function HolographicRing({ elapsedSeconds, size = 160 }: Props) {
  const reduce = useReducedMotion();

  const linear = (duration: number, direction: 1 | -1 = 1) =>
    reduce
      ? undefined
      : { duration, repeat: Infinity, ease: "linear" as const };

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ width: size }}
      role="status"
      aria-label="Agent processing"
    >
      <div
        className="relative"
        style={{ width: size, height: size }}
      >
        {/* Backdrop radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[-12%] rounded-full"
          style={{
            background:
              "radial-gradient(circle at center, rgba(139,92,246,0.32), rgba(34,211,238,0.10) 45%, transparent 70%)",
            filter: "blur(18px)",
          }}
        />

        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
            <linearGradient id="ring-grad-bright" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="100%" stopColor="#67e8f9" />
            </linearGradient>
          </defs>

          {/* Outer ring — dashed, slow rotation, with tick marks every 30° */}
          <motion.g
            animate={reduce ? undefined : { rotate: 360 }}
            transition={linear(9)}
            style={{ transformOrigin: "50px 50px" }}
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="rgba(167,139,250,0.45)"
              strokeWidth="0.6"
              strokeDasharray="1.5 3"
            />
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const x1 = 50 + Math.cos(angle) * 47.5;
              const y1 = 50 + Math.sin(angle) * 47.5;
              const x2 = 50 + Math.cos(angle) * 49.5;
              const y2 = 50 + Math.sin(angle) * 49.5;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(196,181,253,0.7)"
                  strokeWidth="0.7"
                  strokeLinecap="round"
                />
              );
            })}
          </motion.g>

          {/* Mid arc — 270° gradient stroke, counter-rotation */}
          <motion.g
            animate={reduce ? undefined : { rotate: -360 }}
            transition={linear(5.5, -1)}
            style={{ transformOrigin: "50px 50px" }}
          >
            <path
              d={describeArc(50, 50, 36, 0, 270)}
              fill="none"
              stroke="url(#ring-grad)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            {/* Leading dot at arc head */}
            <circle
              cx={50 + Math.cos((270 * Math.PI) / 180) * 36}
              cy={50 + Math.sin((270 * Math.PI) / 180) * 36}
              r="1.4"
              fill="#67e8f9"
            />
          </motion.g>

          {/* Inner arc — 180°, faster, brighter */}
          <motion.g
            animate={reduce ? undefined : { rotate: 360 }}
            transition={linear(3.2)}
            style={{ transformOrigin: "50px 50px" }}
          >
            <path
              d={describeArc(50, 50, 24, 30, 210)}
              fill="none"
              stroke="url(#ring-grad-bright)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </motion.g>

          {/* Faint inner static ring */}
          <circle
            cx="50"
            cy="50"
            r="14"
            fill="none"
            stroke="rgba(167,139,250,0.25)"
            strokeWidth="0.4"
          />
        </svg>

        {/* Pulsing core dot */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: size * 0.085,
            height: size * 0.085,
            marginLeft: -(size * 0.0425),
            marginTop: -(size * 0.0425),
            background:
              "radial-gradient(circle, #ffffff 0%, #c4b5fd 45%, rgba(139,92,246,0.5) 80%, transparent 100%)",
            boxShadow: "0 0 14px rgba(167,139,250,0.85)",
          }}
          animate={
            reduce
              ? undefined
              : { scale: [1, 1.25, 1], opacity: [0.85, 1, 0.85] }
          }
          transition={
            reduce
              ? undefined
              : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </div>

      {/* MM:SS elapsed */}
      <div
        className="mt-3 font-mono text-2xl tabular-nums tracking-[0.18em] text-violet-100"
        style={{
          textShadow: "0 0 12px rgba(167,139,250,0.45)",
        }}
      >
        {formatClock(elapsedSeconds)}
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-[0.28em] text-zinc-500">
        Elapsed
      </div>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    "M",
    start.x,
    start.y,
    "A",
    r,
    r,
    0,
    largeArc,
    0,
    end.x,
    end.y,
  ].join(" ");
}

export default HolographicRing;
