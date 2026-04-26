"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ChevronDown,
  Code2,
  HelpCircle,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PaperDna } from "@/components/SandpackExecutor";
import {
  AuditWorker,
  type AuditWorkerOutcome,
} from "@/components/AuditWorker";
import {
  type AuditClaim,
  type AuditResult,
  type AuditVerdict,
  verdictForResult,
} from "@/types/audit";

type Phase =
  | "idle"
  | "extracting"
  | "harness"
  | "executing"
  | "complete"
  | "empty"
  | "error";

type Props = {
  paperDna: PaperDna;
  url: string | null;
  onClose: () => void;
};

function formatNumber(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (Number.isInteger(v)) return String(v);
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 1) return v.toFixed(3);
  if (abs >= 0.001) return v.toFixed(4);
  return v.toExponential(2);
}

const VERDICT_STYLES: Record<
  AuditVerdict,
  { Icon: typeof ShieldCheck; ring: string; chip: string; label: string }
> = {
  verified: {
    Icon: ShieldCheck,
    ring: "border-emerald-400/30 bg-emerald-500/[0.04]",
    chip: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    label: "Verified",
  },
  discrepancy: {
    Icon: ShieldAlert,
    ring: "border-amber-400/30 bg-amber-500/[0.04]",
    chip: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    label: "Discrepancy",
  },
  inconclusive: {
    Icon: ShieldQuestion,
    ring: "border-zinc-500/30 bg-zinc-500/[0.04]",
    chip: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
    label: "Inconclusive",
  },
};

export function ReproducibilityCertificate({ paperDna, url, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [claims, setClaims] = useState<AuditClaim[]>([]);
  const [harness, setHarness] = useState<string>("");
  const [harnessDone, setHarnessDone] = useState(false);
  const [results, setResults] = useState<AuditResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emptyNote, setEmptyNote] = useState<string | null>(null);
  const [showHarness, setShowHarness] = useState(false);
  const [outcomeKind, setOutcomeKind] = useState<
    AuditWorkerOutcome["kind"] | null
  >(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const harnessPaneRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    const el = harnessPaneRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [harness]);

  const startAudit = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("extracting");
    setClaims([]);
    setHarness("");
    setHarnessDone(false);
    setResults([]);
    setErrorMessage(null);
    setEmptyNote(null);
    setOutcomeKind(null);
    setDurationMs(null);
    setStartedAt(Date.now());

    try {
      const res = await fetch("/api/agent/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperDna, url }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Audit failed: HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIdx: number;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);

          let eventName = "message";
          const dataParts: string[] = [];
          for (const line of raw.split("\n")) {
            if (line.startsWith("event: ")) eventName = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataParts.push(line.slice(6));
          }
          const dataText = dataParts.join("\n");
          if (!dataText) continue;

          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataText);
          } catch {
            continue;
          }

          if (eventName === "claims_extracted") {
            const arr = Array.isArray(data.claims) ? data.claims : [];
            setClaims(arr as AuditClaim[]);
            if (arr.length === 0) {
              setEmptyNote(
                "No verifiable numerical claims found in the abstract.",
              );
              setPhase("empty");
              return;
            }
            setPhase("harness");
          } else if (eventName === "harness_delta") {
            const text = typeof data.text === "string" ? data.text : "";
            if (text) setHarness((prev) => prev + text);
          } else if (eventName === "harness_done") {
            const code = typeof data.harness === "string" ? data.harness : "";
            if (code) setHarness(code);
            setHarnessDone(true);
          } else if (eventName === "done") {
            const code =
              typeof data.harness === "string" ? data.harness : null;
            const note = typeof data.note === "string" ? data.note : null;
            if (!code) {
              if (note) setEmptyNote(note);
              setPhase("empty");
              return;
            }
            setHarness(code);
            setHarnessDone(true);
            setPhase("executing");
            return;
          } else if (eventName === "error") {
            throw new Error(
              typeof data.message === "string" ? data.message : "Audit failed",
            );
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setPhase("idle");
        return;
      }
      setErrorMessage((e as Error).message);
      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  }, [paperDna, url]);

  // Auto-start when mounted.
  useEffect(() => {
    startAudit();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWorkerComplete = useCallback(
    (outcome: AuditWorkerOutcome) => {
      setOutcomeKind(outcome.kind);
      const claimIds = new Set(claims.map((c) => c.id));
      if (outcome.kind === "results") {
        // Validate: only accept results whose claim_id matches an extracted claim.
        const filtered = outcome.results.filter((r) => claimIds.has(r.claim_id));
        setResults(filtered);
      } else {
        // timeout or error → empty results, every claim becomes inconclusive
        setResults([]);
      }
      setPhase("complete");
      if (startedAt) setDurationMs(Date.now() - startedAt);
    },
    [claims, startedAt],
  );

  const resultByClaim = (id: string) => results.find((r) => r.claim_id === id);

  const summary = (() => {
    if (phase !== "complete") return null;
    let v = 0;
    let d = 0;
    let i = 0;
    for (const c of claims) {
      const verdict = verdictForResult(c, resultByClaim(c.id));
      if (verdict === "verified") v++;
      else if (verdict === "discrepancy") d++;
      else i++;
    }
    return { v, d, i };
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-white/[0.025] shadow-[0_0_60px_-30px_rgba(139,92,246,0.4)] backdrop-blur-md"
    >
      {/* Render the off-screen worker only once we have both kernel + harness. */}
      {phase === "executing" &&
        harness &&
        paperDna.code_kernel && (
          <AuditWorker
            kernel={paperDna.code_kernel}
            harness={harness}
            onComplete={handleWorkerComplete}
          />
        )}

      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-violet-200">
            <Sparkles className="h-3 w-3" />
            Reproducibility Certificate
          </div>
          {summary && (
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span className="rounded border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-200">
                {summary.v} verified
              </span>
              {summary.d > 0 && (
                <span className="rounded border border-amber-400/20 bg-amber-500/10 px-1.5 py-0.5 text-amber-200">
                  {summary.d} discrepancy
                </span>
              )}
              {summary.i > 0 && (
                <span className="rounded border border-zinc-500/20 bg-zinc-500/10 px-1.5 py-0.5 text-zinc-300">
                  {summary.i} inconclusive
                </span>
              )}
              {durationMs !== null && (
                <span className="ml-1 text-[10px] text-zinc-500">
                  · {(durationMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close audit panel"
          className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.02] p-1.5 text-zinc-400 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-100"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        {/* LEFT: claims & verdicts */}
        <div className="flex flex-col gap-3">
          <PhaseStrip phase={phase} />

          {phase === "error" && errorMessage && (
            <div className="rounded-lg border border-red-400/30 bg-red-500/[0.04] p-4 text-[12px] text-red-200">
              <div className="mb-1 flex items-center gap-1.5 font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                Audit failed
              </div>
              <div className="text-red-300/80">{errorMessage}</div>
              <button
                type="button"
                onClick={startAudit}
                className="mt-3 inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-200 transition-colors hover:border-white/25 hover:bg-white/10"
              >
                Retry
              </button>
            </div>
          )}

          {phase === "empty" && (
            <div className="rounded-lg border border-zinc-500/30 bg-zinc-500/[0.04] p-4 text-[12px] text-zinc-300">
              <div className="mb-1 flex items-center gap-1.5 font-medium">
                <HelpCircle className="h-3.5 w-3.5" />
                Nothing to audit
              </div>
              <div className="text-zinc-400">
                {emptyNote ??
                  "The abstract didn't include any numerical claims that can be verified by running the kernel."}
              </div>
            </div>
          )}

          {claims.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              <AnimatePresence initial={false}>
                {claims.map((claim, i) => {
                  const result = resultByClaim(claim.id);
                  const verdict =
                    phase === "complete"
                      ? verdictForResult(claim, result)
                      : "inconclusive";
                  return (
                    <ClaimCard
                      key={claim.id}
                      index={i}
                      claim={claim}
                      result={result}
                      verdict={verdict}
                      pending={phase !== "complete"}
                      outcomeKind={outcomeKind}
                    />
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {/* RIGHT: harness pane */}
        <div className="flex min-h-[200px] flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowHarness((v) => !v)}
            className="flex w-full items-center justify-between rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-white/25 hover:text-zinc-200"
          >
            <span className="inline-flex items-center gap-1.5">
              <Code2 className="h-3 w-3" />
              Harness
              {harness.length > 0 && (
                <span className="text-[10px] text-zinc-600">
                  · {harness.length.toLocaleString()} chars
                </span>
              )}
              {!harnessDone && phase !== "idle" && phase !== "extracting" && (
                <Loader2 className="ml-1 h-3 w-3 animate-spin text-violet-300" />
              )}
            </span>
            <ChevronDown
              className={`h-3 w-3 transition-transform ${showHarness ? "rotate-180" : ""}`}
            />
          </button>
          {showHarness && (
            <pre
              ref={harnessPaneRef}
              className="max-h-[420px] flex-1 overflow-y-auto rounded-md border border-white/5 bg-[#050509] p-3 font-mono text-[11px] leading-relaxed text-zinc-300"
            >
              <code className="whitespace-pre-wrap">
                {harness || (
                  <span className="text-zinc-600">
                    Harness will stream here once claims are extracted.
                  </span>
                )}
                {!harnessDone &&
                  harness.length > 0 &&
                  phase === "harness" && (
                    <span
                      aria-hidden
                      className="ml-0.5 inline-block h-[1em] w-[0.5ch] animate-pulse bg-violet-300 align-middle"
                    />
                  )}
              </code>
            </pre>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ClaimCard({
  index,
  claim,
  result,
  verdict,
  pending,
  outcomeKind,
}: {
  index: number;
  claim: AuditClaim;
  result: AuditResult | undefined;
  verdict: AuditVerdict;
  pending: boolean;
  outcomeKind: AuditWorkerOutcome["kind"] | null;
}) {
  const style = VERDICT_STYLES[verdict];
  const { Icon } = style;

  let pendingLabel = "Pending";
  if (!pending) {
    pendingLabel = style.label;
  } else if (outcomeKind === null) {
    pendingLabel = "Verifying…";
  }

  const resultNote = (() => {
    if (!pending && !result) {
      if (outcomeKind === "timeout") return "Harness exceeded 30s wall clock.";
      if (outcomeKind === "error") return "Harness reported an execution error.";
      return "No result reported for this claim.";
    }
    return result?.notes ?? null;
  })();

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, delay: pending ? 0 : index * 0.04 }}
      className={`rounded-lg border ${style.ring} p-3.5`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/40">
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" />
          ) : (
            <Icon className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12.5px] leading-snug text-zinc-100">
              {claim.statement}
            </p>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${
                pending
                  ? "border-violet-400/30 bg-violet-500/10 text-violet-200"
                  : style.chip
              }`}
            >
              {pendingLabel}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 font-mono text-[11px]">
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">
                Expected
              </div>
              <div className="mt-0.5 text-zinc-300">
                {formatNumber(claim.expected_value)}{" "}
                <span className="text-zinc-600">{claim.expected_unit}</span>
              </div>
              <div className="mt-0.5 text-[9px] text-zinc-600">
                ± {formatNumber(claim.tolerance)}
                {claim.tolerance_kind === "relative" ? " (rel)" : " (abs)"}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">
                Measured
              </div>
              <div className="mt-0.5 text-zinc-300">
                {pending ? (
                  <span className="text-zinc-600">…</span>
                ) : (
                  <>
                    {formatNumber(result?.actual_value ?? null)}{" "}
                    <span className="text-zinc-600">
                      {result?.unit ?? claim.expected_unit}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          {resultNote && (
            <div className="mt-2 rounded border border-white/5 bg-black/20 px-2 py-1 text-[11px] leading-snug text-zinc-400">
              {resultNote}
            </div>
          )}
          {pending && (
            <div className="mt-2 text-[10px] italic text-zinc-600">
              Method: {claim.test_method}
            </div>
          )}
        </div>
      </div>
    </motion.li>
  );
}

function PhaseStrip({ phase }: { phase: Phase }) {
  if (phase === "idle" || phase === "complete" || phase === "empty" || phase === "error") {
    return null;
  }
  const labels: Record<Exclude<Phase, "idle" | "complete" | "empty" | "error">, string> = {
    extracting: "Extracting numerical claims from abstract…",
    harness: "Generating audit harness…",
    executing: "Running harness in off-screen sandbox…",
  };
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-violet-400/20 bg-violet-500/[0.04] px-3 py-1.5 text-[11px] text-violet-100">
      <Loader2 className="h-3 w-3 animate-spin text-violet-300" />
      <span>{labels[phase]}</span>
    </div>
  );
}

