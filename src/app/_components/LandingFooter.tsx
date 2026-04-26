"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

const LINKS: Array<{ label: string; href: string; external?: boolean }> = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Documentation", href: "#" },
  { label: "GitHub", href: "#", external: true },
];

export default function LandingFooter() {
  return (
    <footer className="relative w-full">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />
      <div className="flex flex-col items-center justify-between gap-4 px-2 py-7 text-[11.5px] text-zinc-500 sm:flex-row sm:px-4 sm:py-8 sm:text-[12px]">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/40">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <defs>
                <linearGradient
                  id="genesis-footer-grad"
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
                stroke="url(#genesis-footer-grad)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="1.5" fill="url(#genesis-footer-grad)" />
            </svg>
          </div>
          <span className="text-zinc-400">
            &copy; 2026 Danyar Group.
            <span className="ml-1 text-zinc-600">All rights reserved.</span>
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {LINKS.map((link) => {
            const className =
              "inline-flex items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-200";
            const isInternal = link.href.startsWith("/");
            if (isInternal) {
              return (
                <Link key={link.label} href={link.href} className={className}>
                  {link.label}
                </Link>
              );
            }
            return (
              <a
                key={link.label}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className={className}
              >
                {link.label}
                {link.external && <ExternalLink className="h-3 w-3" />}
              </a>
            );
          })}
        </nav>
      </div>
    </footer>
  );
}
