"use client";

type Props = {
  label?: string;
  className?: string;
};

export function ShellSkeleton({ label = "Loading visualization…", className = "" }: Props) {
  return (
    <div
      className={`relative flex h-full min-h-[320px] w-full items-center justify-center overflow-hidden ${className}`}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent bg-[length:200%_100%] animate-[shimmer_2.2s_linear_infinite]"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-3 text-zinc-400">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-violet-300/70"
              style={{
                animation: "pulse-glow 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.18}s`,
              }}
            />
          ))}
        </div>
        <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
          {label}
        </span>
      </div>
    </div>
  );
}
