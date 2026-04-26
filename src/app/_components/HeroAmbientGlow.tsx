"use client";

export default function HeroAmbientGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Layer A — directional core beam, hugging the right edge */}
      <div
        className="absolute -right-[10%] top-1/2 h-[140vmin] w-[120vmin] -translate-y-1/2 rounded-full blur-2xl mix-blend-screen"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(167,139,250,0.55) 0%, rgba(139,92,246,0.42) 22%, rgba(56,189,248,0.28) 45%, rgba(6,182,212,0.12) 60%, transparent 72%)",
          animation: "var(--animate-hero-pulse)",
        }}
      />

      {/* Layer B — soft counter-glow on the left */}
      <div
        className="absolute -left-[15%] top-[55%] h-[90vmin] w-[80vmin] -translate-y-1/2 rounded-full blur-3xl mix-blend-screen opacity-80"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(139,92,246,0.32) 0%, rgba(109,40,217,0.18) 35%, transparent 70%)",
        }}
      />

      {/* Layer C — animated horizontal sweep across the whole viewport */}
      <div
        className="absolute inset-y-0 -left-1/2 -right-1/2 mix-blend-screen"
        style={{
          background:
            "linear-gradient(100deg, transparent 0%, rgba(167,139,250,0.10) 30%, rgba(34,211,238,0.16) 50%, rgba(167,139,250,0.10) 70%, transparent 100%)",
          animation: "var(--animate-hero-sweep)",
        }}
      />

      {/* Layer D — faded cosmic hex-molecule glyph, set deep in the background.
       * Same atomic-structure motif as the AppLogo (hex frame + orbit ring +
       * center dot), scaled up to a galactic watermark and softly blurred. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="opacity-[0.10] mix-blend-screen blur-sm"
          style={{
            width: "clamp(28rem, 70vmin, 64rem)",
            height: "clamp(28rem, 70vmin, 64rem)",
            filter: "drop-shadow(0 0 60px rgba(139,92,246,0.35))",
          }}
        >
          <defs>
            <linearGradient
              id="genesis-hero-glyph-grad"
              x1="2"
              y1="2"
              x2="22"
              y2="22"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="55%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <path
            d="M12 2.5L20.5 7.25V16.75L12 21.5L3.5 16.75V7.25L12 2.5Z"
            stroke="url(#genesis-hero-glyph-grad)"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          <circle
            cx="12"
            cy="12"
            r="3.75"
            stroke="url(#genesis-hero-glyph-grad)"
            strokeWidth="0.5"
            opacity="0.75"
          />
          <circle
            cx="12"
            cy="12"
            r="1.5"
            fill="url(#genesis-hero-glyph-grad)"
          />
        </svg>
      </div>

      {/* Subtle vignette to keep edges feeling deep on bright displays */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 50%, transparent 55%, rgba(5,5,9,0.55) 100%)",
        }}
      />
    </div>
  );
}
