"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2, Mail, MessageSquare } from "lucide-react";
import { useState } from "react";

type SubmitState = "idle" | "submitting" | "submitted";

export default function LandingFeedback() {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [focused, setFocused] = useState(false);

  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || state === "submitting") return;
    // Mock submission — in production this would POST to a feedback endpoint.
    setState("submitting");
    setTimeout(() => setState("submitted"), 700);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative w-full"
    >
      <div className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/[0.06] via-white/[0.02] to-cyan-500/[0.06] p-6 backdrop-blur-md sm:p-8">
        {/* Glow rim */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-12 -top-px h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-x-1/3 -bottom-1/2 h-1/2 bg-[radial-gradient(50%_50%_at_50%_0%,rgba(139,92,246,0.15),transparent_70%)]"
        />

        <div className="relative flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-violet-200">
            <MessageSquare className="h-3 w-3" />
            Share Feedback
          </span>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-100 sm:text-[28px]">
            Help shape what Genesis builds next.
          </h3>
          <p className="mt-2 max-w-md text-balance text-[13.5px] leading-relaxed text-zinc-400">
            Drop your email if you want early access to upcoming features, or
            tell us what would make Genesis indispensable for your research.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-6 flex w-full max-w-lg flex-col gap-3"
          >
            <div
              className={`flex items-center gap-2 rounded-full border bg-black/45 px-4 py-2.5 backdrop-blur-md transition-colors sm:px-5 sm:py-3 ${
                focused
                  ? "border-violet-400/40 shadow-[0_0_60px_-10px_rgba(139,92,246,0.55)]"
                  : "border-white/10"
              }`}
            >
              <Mail
                className={`h-4 w-4 shrink-0 transition-colors ${
                  focused ? "text-violet-300" : "text-zinc-500"
                }`}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="you@lab.edu"
                spellCheck={false}
                autoComplete="email"
                disabled={state !== "idle"}
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-60 sm:text-[15px]"
              />
              <motion.button
                type="submit"
                disabled={!valid || state === "submitting"}
                whileHover={!valid || state !== "idle" ? undefined : { scale: 1.04 }}
                whileTap={!valid || state !== "idle" ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="group relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-br from-violet-500 via-violet-600 to-cyan-500 px-4 py-2 text-[12px] font-medium text-white shadow-[0_0_28px_-4px_rgba(139,92,246,0.7)] transition-shadow hover:shadow-[0_0_42px_-4px_rgba(139,92,246,1)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:px-5 sm:py-2.5 sm:text-[13px]"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                />
                {state === "submitting" ? (
                  <>
                    <Loader2 className="relative h-3.5 w-3.5 animate-spin" />
                    <span className="relative">Sending</span>
                  </>
                ) : state === "submitted" ? (
                  <>
                    <Check className="relative h-3.5 w-3.5" />
                    <span className="relative">Thanks!</span>
                  </>
                ) : (
                  <>
                    <span className="relative">Notify me</span>
                    <ArrowRight className="relative h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </motion.button>
            </div>

            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Optional: what should we build next?"
              rows={3}
              disabled={state !== "idle"}
              className="resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[13px] text-zinc-200 placeholder:text-zinc-500 backdrop-blur-md transition-colors focus:border-violet-400/30 focus:outline-none disabled:opacity-60 sm:text-[14px]"
            />

            <p className="text-[11px] text-zinc-600">
              We&apos;ll only use your email to respond — no marketing, no list
              rentals.
            </p>
          </form>
        </div>
      </div>
    </motion.section>
  );
}
