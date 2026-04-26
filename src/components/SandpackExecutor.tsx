"use client";

import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PaperDna } from "@/types/paperDna";
import { getTemplate } from "./sandpack/templates";

export type { PaperDna };

type Status = "compiling" | "installing" | "running" | "live" | "healing" | "error";

type ErrorInfo = {
  message: string;
  path?: string;
  line?: number;
  stack?: string;
};

const MAX_RETRIES = 3;

type Props = {
  paperDna: PaperDna;
  className?: string;
  onHealed?: (info: { attempt: number; explanation: string; code: string }) => void;
  onError?: (error: ErrorInfo) => void;
  onStatusChange?: (status: Status) => void;
  /**
   * Discovery feature: when this object's identity changes, the values are
   * posted into the Sandpack iframe via postMessage; the shell inside animates
   * its sliders to the new values.
   */
  paramOverride?: Record<string, number> | null;
};

export function SandpackExecutor({
  paperDna,
  className = "",
  onHealed,
  onError,
  onStatusChange,
  paramOverride,
}: Props) {
  const [currentCode, setCurrentCode] = useState(paperDna.code_kernel);
  const [status, setStatus] = useState<Status>("compiling");
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [healExplanation, setHealExplanation] = useState<string | null>(null);

  const healingRef = useRef(false);
  const lastErrorMsgRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const codeRef = useRef(currentCode);
  codeRef.current = currentCode;
  retryCountRef.current = retryCount;

  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const lastSentOverrideRef = useRef<Record<string, number> | null>(null);

  // When a discovery is applied, post the new param values into the Sandpack
  // iframe. Cross-origin → use targetOrigin "*"; the iframe-side listener does
  // shape validation. The iframe may not be mounted yet (mid-compile) — poll
  // briefly for it, then give up.
  useEffect(() => {
    if (!paramOverride) return;
    if (lastSentOverrideRef.current === paramOverride) return;
    if (status !== "live" && status !== "running") return;

    const tryPost = () => {
      const root = previewContainerRef.current;
      if (!root) return false;
      const iframe = root.querySelector("iframe");
      if (!iframe || !iframe.contentWindow) return false;
      iframe.contentWindow.postMessage(
        { type: "genesis:set-params", values: paramOverride },
        "*",
      );
      return true;
    };

    if (tryPost()) {
      lastSentOverrideRef.current = paramOverride;
      return;
    }
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (tryPost() || attempts >= 20) {
        lastSentOverrideRef.current = paramOverride;
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [paramOverride, status]);

  useEffect(() => {
    setCurrentCode(paperDna.code_kernel);
    setStatus("compiling");
    setRetryCount(0);
    setLastError(null);
    setHealExplanation(null);
    healingRef.current = false;
    lastErrorMsgRef.current = null;
  }, [paperDna.code_kernel, paperDna.visualization_type]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const handleError = useCallback(
    async (error: ErrorInfo) => {
      if (healingRef.current) return;
      onError?.(error);

      if (retryCountRef.current >= MAX_RETRIES) {
        setStatus("error");
        setLastError(error.message);
        return;
      }
      if (error.message === lastErrorMsgRef.current) {
        setStatus("error");
        setLastError(`${error.message} (heal didn't converge)`);
        return;
      }

      healingRef.current = true;
      setStatus("healing");
      setLastError(error.message);
      lastErrorMsgRef.current = error.message;
      const nextAttempt = retryCountRef.current + 1;
      setRetryCount(nextAttempt);

      try {
        const res = await fetch("/api/heal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: codeRef.current,
            error: error.message,
            stackTrace: error.stack ?? "",
            vizType: paperDna.visualization_type,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? `heal returned ${res.status}`);
        }
        if (!json.code || typeof json.code !== "string") {
          throw new Error("heal returned no code");
        }
        setCurrentCode(json.code);
        setHealExplanation(json.explanation ?? null);
        setStatus("compiling");
        onHealed?.({
          attempt: nextAttempt,
          explanation: json.explanation ?? "",
          code: json.code,
        });
      } catch (e) {
        setStatus("error");
        setLastError((e as Error).message);
      } finally {
        healingRef.current = false;
      }
    },
    [paperDna.visualization_type, onHealed, onError],
  );

  const handleStatusUpdate = useCallback((next: Status) => {
    setStatus((prev) => {
      if (prev === "healing") return prev;
      if (prev === "error") return prev;
      return next;
    });
  }, []);

  const handleManualRetry = useCallback(() => {
    setRetryCount(0);
    setStatus("compiling");
    setLastError(null);
    setHealExplanation(null);
    lastErrorMsgRef.current = null;
    setCurrentCode(paperDna.code_kernel);
  }, [paperDna.code_kernel]);

  const { files, customSetup, vizType } = getTemplate(
    paperDna.visualization_type,
    currentCode,
    paperDna.parameters,
  );

  return (
    <div
      className={`flex h-full min-h-[520px] w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] shadow-[0_0_60px_-30px_rgba(139,92,246,0.35)] backdrop-blur-sm ${className}`}
    >
      <StatusBar
        status={status}
        retryCount={retryCount}
        maxRetries={MAX_RETRIES}
        lastError={lastError}
        healExplanation={healExplanation}
        vizType={vizType}
        coreAlgorithm={paperDna.core_algorithm}
        onManualRetry={handleManualRetry}
      />

      <div
        ref={previewContainerRef}
        className="relative flex-1 overflow-hidden bg-[#050509]"
      >
        <SandpackProvider
          key={vizType}
          template="react-ts"
          theme="dark"
          files={files}
          customSetup={customSetup}
          options={{
            autorun: true,
            autoReload: true,
            recompileMode: "delayed",
            recompileDelay: 200,
          }}
        >
          <SandpackListener
            onError={handleError}
            onStatusChange={handleStatusUpdate}
          />
          <SandpackLayout
            style={{
              height: "100%",
              minHeight: "70vh",
              width: "100%",
              border: 0,
              borderRadius: 0,
              background: "#050509",
            }}
          >
            <SandpackPreview
              showOpenInCodeSandbox={false}
              showNavigator={false}
              showRefreshButton={false}
              showOpenNewtab={false}
              showRestartButton={false}
              showSandpackErrorOverlay={false}
              style={{
                height: "100%",
                minHeight: "70vh",
                width: "100%",
                background: "#050509",
              }}
            />
          </SandpackLayout>
        </SandpackProvider>

        {status === "error" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="pointer-events-auto max-w-md rounded-xl border border-red-500/20 bg-red-500/[0.04] p-5 text-center backdrop-blur-md">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10">
                <AlertCircle className="h-5 w-5 text-red-300" />
              </div>
              <div className="text-sm font-medium text-zinc-100">
                Healing failed after {retryCount}/{MAX_RETRIES} attempt
                {retryCount === 1 ? "" : "s"}
              </div>
              {lastError && (
                <pre className="mx-auto mt-2 max-h-32 max-w-sm overflow-auto whitespace-pre-wrap text-left text-[11px] leading-snug text-red-200/80">
                  {lastError}
                </pre>
              )}
              <button
                type="button"
                onClick={handleManualRetry}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-white/25 hover:bg-white/10"
              >
                <RotateCcw className="h-3 w-3" />
                Restart from original
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SandpackListener({
  onError,
  onStatusChange,
}: {
  onError: (e: ErrorInfo) => void;
  onStatusChange: (s: Status) => void;
}) {
  const { sandpack, listen } = useSandpack();
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onStatusRef = useRef(onStatusChange);
  onStatusRef.current = onStatusChange;

  useEffect(() => {
    const unsubscribe = listen((msg) => {
      if (msg.type === "action" && msg.action === "show-error") {
        const frames = msg.payload?.frames;
        onErrorRef.current({
          message: msg.message ?? msg.title ?? "Unknown runtime error",
          path: msg.path,
          line: msg.line,
          stack: frames ? JSON.stringify(frames).slice(0, 2000) : undefined,
        });
        return;
      }
      if (msg.type === "start") {
        onStatusRef.current("compiling");
        return;
      }
      if (msg.type === "status") {
        if (msg.status === "installing-dependencies") {
          onStatusRef.current("installing");
        } else if (msg.status === "transpiling") {
          onStatusRef.current("compiling");
        } else if (msg.status === "evaluating") {
          onStatusRef.current("running");
        } else if (msg.status === "idle") {
          onStatusRef.current("live");
        }
        return;
      }
      if (msg.type === "done") {
        onStatusRef.current(msg.compilatonError ? "compiling" : "live");
        return;
      }
      if (msg.type === "success") {
        onStatusRef.current("live");
      }
    });
    return () => unsubscribe();
  }, [listen]);

  useEffect(() => {
    if (sandpack.error) {
      onErrorRef.current({
        message: sandpack.error.message,
        path: sandpack.error.path,
      });
    }
  }, [sandpack.error]);

  return null;
}

type StatusConfig = {
  label: string;
  tone: string;
  bg: string;
  border: string;
  Icon: typeof Loader2;
  spin?: boolean;
  pulse?: boolean;
};

function getStatusConfig(
  status: Status,
  retryCount: number,
  maxRetries: number,
): StatusConfig {
  switch (status) {
    case "installing":
      return {
        label: "Installing dependencies…",
        tone: "text-amber-200",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        Icon: Loader2,
        spin: true,
      };
    case "compiling":
      return {
        label: "Compiling…",
        tone: "text-amber-200",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        Icon: Loader2,
        spin: true,
      };
    case "running":
      return {
        label: "Running…",
        tone: "text-cyan-200",
        bg: "bg-cyan-500/10",
        border: "border-cyan-500/20",
        Icon: Circle,
        pulse: true,
      };
    case "live":
      return {
        label: "Live",
        tone: "text-emerald-200",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        Icon: CheckCircle2,
      };
    case "healing":
      return {
        label: `Claude is healing · attempt ${retryCount}/${maxRetries}`,
        tone: "text-violet-200",
        bg: "bg-violet-500/10",
        border: "border-violet-500/20",
        Icon: Sparkles,
        pulse: true,
      };
    case "error":
      return {
        label: "Failed",
        tone: "text-red-200",
        bg: "bg-red-500/10",
        border: "border-red-500/20",
        Icon: AlertCircle,
      };
  }
}

function StatusBar({
  status,
  retryCount,
  maxRetries,
  lastError,
  healExplanation,
  vizType,
  coreAlgorithm,
  onManualRetry,
}: {
  status: Status;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  healExplanation: string | null;
  vizType: string;
  coreAlgorithm?: string;
  onManualRetry: () => void;
}) {
  const cfg = getStatusConfig(status, retryCount, maxRetries);
  const { Icon } = cfg;
  const [coreOpen, setCoreOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Portal-based positioning: when the tooltip opens, measure the trigger's
  // viewport rect and re-measure on scroll/resize. This escapes the Sandpack
  // card's overflow-hidden + iframe compositor layer that was clipping the
  // in-flow tooltip to a sliver.
  useEffect(() => {
    if (!coreOpen) {
      setTooltipPos(null);
      return;
    }
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const TOOLTIP_MAX = 360;
      const VIEW_GUTTER = 12;
      const left = Math.max(
        VIEW_GUTTER,
        Math.min(r.left, window.innerWidth - TOOLTIP_MAX - VIEW_GUTTER),
      );
      setTooltipPos({ top: r.bottom + 8, left });
    };
    place();
    // capture: catches scrolls inside any nested scrollable ancestor
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [coreOpen]);

  return (
    <div className="flex items-center gap-3 border-b border-white/10 bg-black/40 px-3 py-2 text-[11px] backdrop-blur-md">
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 ${cfg.bg} ${cfg.border} ${cfg.tone}`}
        >
          <Icon
            className={`h-3 w-3 ${cfg.spin ? "animate-spin" : ""} ${
              cfg.pulse ? "animate-pulse" : ""
            }`}
          />
          <span className="font-medium tracking-tight">{cfg.label}</span>
        </motion.div>
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="hidden shrink-0 text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-600 sm:inline">
          {vizType}
        </span>

        {coreAlgorithm && (
          <>
            <span
              ref={triggerRef}
              onMouseEnter={() => setCoreOpen(true)}
              onMouseLeave={() => setCoreOpen(false)}
              onFocus={() => setCoreOpen(true)}
              onBlur={() => setCoreOpen(false)}
              tabIndex={0}
              role="button"
              aria-label="Core algorithm summary"
              className={`inline-flex h-3.5 w-3.5 shrink-0 cursor-help select-none items-center justify-center rounded-full border text-[8px] font-bold italic leading-none transition-colors focus:outline-none ${
                coreOpen
                  ? "border-violet-400/55 bg-violet-500/15 text-violet-200"
                  : "border-white/15 bg-white/[0.04] text-zinc-400 hover:border-violet-400/40 hover:text-violet-300"
              }`}
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              i
            </span>
            {typeof document !== "undefined" &&
              createPortal(
                <AnimatePresence>
                  {coreOpen && tooltipPos && (
                    <motion.div
                      key="core-tooltip"
                      role="tooltip"
                      data-side="bottom"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.14, ease: "easeOut" }}
                      className="pointer-events-none rounded-md border border-violet-400/25 bg-black/95 px-3 py-2 text-left leading-relaxed text-zinc-200 shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur-md"
                      style={{
                        position: "fixed",
                        top: tooltipPos.top,
                        left: tooltipPos.left,
                        zIndex: 9999,
                        minWidth: 240,
                        maxWidth: 360,
                        fontSize: 11,
                        fontWeight: 400,
                        fontStyle: "normal",
                        fontFamily:
                          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
                      }}
                    >
                      <span
                        aria-hidden
                        className="absolute -top-1 left-3 h-2 w-2 rotate-45 border-l border-t border-violet-400/25 bg-black/95"
                      />
                      <span className="block font-mono text-[9px] uppercase tracking-[0.18em] text-violet-300/70">
                        Core algorithm
                      </span>
                      <span className="mt-1 block whitespace-normal text-zinc-200">
                        {coreAlgorithm}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>,
                document.body,
              )}
          </>
        )}

        <AnimatePresence>
          {healExplanation && status !== "healing" && status !== "error" && (
            <motion.span
              key={healExplanation}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="truncate text-[11px] text-zinc-400"
            >
              <Sparkles className="mr-1 inline h-3 w-3 text-violet-300" />
              Claude fixed: {healExplanation}
            </motion.span>
          )}
        </AnimatePresence>

        {status === "error" && lastError && (
          <span className="truncate text-red-300/80" title={lastError}>
            {lastError}
          </span>
        )}
      </div>

      {status === "error" && (
        <button
          type="button"
          onClick={onManualRetry}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-100"
        >
          <RotateCcw className="h-3 w-3" />
          Retry
        </button>
      )}

      {retryCount > 0 && status !== "error" && (
        <span className="shrink-0 text-[10px] text-zinc-600">
          healed ×{retryCount}
        </span>
      )}
    </div>
  );
}

export default SandpackExecutor;
