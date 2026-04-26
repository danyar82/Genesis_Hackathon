import Link from "next/link";
import { ArrowLeft, ArrowRight, type LucideIcon } from "lucide-react";

type Props = {
  /** Big H1 — e.g., "Privacy Policy". */
  title: string;
  /** Small uppercase eyebrow rendered above the title. */
  eyebrow: string;
  /** Optional icon shown next to the eyebrow chip. */
  Icon?: LucideIcon;
  /** Already-formatted "Last updated" date string, e.g. "April 26, 2026". */
  lastUpdated: string;
  /** Cross-link to the sibling legal page rendered at the bottom. */
  sibling: { label: string; href: "/privacy" | "/terms" };
  children: React.ReactNode;
};

/**
 * Shared chrome for the /privacy and /terms pages — fixed top-left back
 * link, centered narrow reading column, gradient title, last-updated meta,
 * and a bottom cross-link to the sibling legal document.
 *
 * The styled prose helpers below (Section, H2, P, Ul, Li, Strong, Code)
 * keep typography consistent across both pages without pulling in the
 * Tailwind Typography plugin.
 */
export default function LegalPageShell({
  title,
  eyebrow,
  Icon,
  lastUpdated,
  sibling,
  children,
}: Props) {
  return (
    <main className="relative min-h-dvh overflow-x-hidden">
      {/* Fixed top-left back affordance — mirrors AppLogo's spacing on the
       * homepage so the visual rhythm is consistent across routes. */}
      <Link
        href="/"
        className="group fixed left-3 top-3 z-50 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[12px] font-medium text-zinc-300 backdrop-blur-md transition-colors hover:border-violet-400/40 hover:bg-black/60 hover:text-zinc-100 sm:left-5 sm:top-5"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
        Back to home
      </Link>

      <article className="mx-auto max-w-3xl px-4 py-24 sm:px-6 sm:py-28">
        <header className="flex flex-col items-start gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400 backdrop-blur-md">
            {Icon && <Icon className="h-3 w-3" />}
            {eyebrow}
          </span>
          <h1
            className="bg-gradient-to-br from-white via-violet-200 to-cyan-300 bg-clip-text font-sans text-4xl font-bold leading-[1.05] tracking-tight text-transparent sm:text-5xl"
            style={{ letterSpacing: "-0.02em" }}
          >
            {title}
          </h1>
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Last updated · {lastUpdated}
          </p>
        </header>

        <hr className="my-10 border-t border-white/10" />

        <div className="flex flex-col gap-7">{children}</div>

        <hr className="mt-14 border-t border-white/10" />

        <footer className="mt-8 flex flex-col items-start gap-4 text-[13px] sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={sibling.href}
            className="group inline-flex items-center gap-1.5 text-zinc-400 transition-colors hover:text-zinc-100"
          >
            Looking for the {sibling.label}?
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-zinc-400 transition-colors hover:text-zinc-100"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to home
          </Link>
        </footer>
      </article>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*                       STYLED PROSE PRIMITIVES                              */
/* -------------------------------------------------------------------------- */

export function Section({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-3">
      {children}
    </section>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2 text-[20px] font-semibold tracking-tight text-zinc-100 sm:text-[22px]">
      {children}
    </h2>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14.5px] leading-relaxed text-zinc-300 sm:text-[15px]">
      {children}
    </p>
  );
}

/** Used for the bold "as is" disclaimer paragraph in the Terms. */
export function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-amber-400/20 bg-amber-500/[0.04] px-4 py-3 text-[13px] font-medium uppercase tracking-[0.04em] leading-relaxed text-amber-100/90 sm:text-[13.5px]">
      {children}
    </p>
  );
}

export function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-1 flex flex-col gap-2 text-[14.5px] leading-relaxed text-zinc-300 sm:text-[15px]">
      {children}
    </ul>
  );
}

export function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="relative pl-5 before:absolute before:left-0 before:top-[0.65em] before:h-1 before:w-1 before:rounded-full before:bg-violet-400/70">
      {children}
    </li>
  );
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-zinc-100">{children}</strong>;
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.88em] text-zinc-200">
      {children}
    </code>
  );
}
