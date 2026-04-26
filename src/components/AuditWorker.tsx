"use client";

import {
  SandpackProvider,
  SandpackPreview,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { useEffect, useRef } from "react";
import {
  AUDIT_CUSTOM_SETUP,
  AUDIT_MAGIC_PREFIX,
  getAuditFiles,
} from "./sandpack/auditTemplate";

type RawResult = {
  claim_id: string;
  actual_value: number | null;
  unit: string;
  passed: boolean;
  notes: string;
};

export type AuditWorkerOutcome =
  | { kind: "results"; results: RawResult[] }
  | { kind: "error"; message: string }
  | { kind: "timeout" };

type Props = {
  kernel: string;
  harness: string;
  /** Hard wall-clock cap. Should exceed the runner's internal timeout. */
  timeoutMs?: number;
  onComplete: (outcome: AuditWorkerOutcome) => void;
};

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Off-screen Sandpack worker. Renders the iframe at left:-9999px (NOT
 * display:none — Chrome throttles JS in display:none iframes).
 * Captures the harness's console output via Sandpack's listen() API,
 * filters for the AUDIT_MAGIC_PREFIX, and resolves once a `results`
 * or `error` payload arrives — or on hard timeout.
 */
export function AuditWorker({
  kernel,
  harness,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onComplete,
}: Props) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: -9999,
        top: 0,
        width: 1,
        height: 1,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <SandpackProvider
        template="react-ts"
        theme="dark"
        files={getAuditFiles(kernel, harness)}
        customSetup={AUDIT_CUSTOM_SETUP}
        options={{
          autorun: true,
          autoReload: false,
          recompileMode: "immediate",
        }}
      >
        <AuditCapture timeoutMs={timeoutMs} onComplete={onComplete} />
        <SandpackPreview
          showOpenInCodeSandbox={false}
          showNavigator={false}
          showRefreshButton={false}
          showOpenNewtab={false}
          showRestartButton={false}
          showSandpackErrorOverlay={false}
          style={{ width: 1, height: 1, border: 0 }}
        />
      </SandpackProvider>
    </div>
  );
}

function AuditCapture({
  timeoutMs,
  onComplete,
}: {
  timeoutMs: number;
  onComplete: (outcome: AuditWorkerOutcome) => void;
}) {
  const { listen } = useSandpack();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const settledRef = useRef(false);

  useEffect(() => {
    const settle = (outcome: AuditWorkerOutcome) => {
      if (settledRef.current) return;
      settledRef.current = true;
      onCompleteRef.current(outcome);
    };

    const timer = setTimeout(() => settle({ kind: "timeout" }), timeoutMs);

    const unsubscribe = listen((msg: unknown) => {
      // Sandpack emits typed messages; we look for console-log payloads.
      // The messaging shape is documented but loosely typed.
      if (!msg || typeof msg !== "object") return;
      const m = msg as {
        type?: string;
        log?: Array<{ method?: string; data?: unknown }>;
        message?: string;
      };

      if (m.type === "console" && Array.isArray(m.log)) {
        for (const entry of m.log) {
          if (entry?.method !== "log") continue;
          const data = entry.data;
          if (!Array.isArray(data)) continue;
          for (const part of data) {
            if (typeof part !== "string") continue;
            if (!part.startsWith(AUDIT_MAGIC_PREFIX)) continue;
            const jsonText = part.slice(AUDIT_MAGIC_PREFIX.length);
            // Cap parse input at 100 KB.
            const truncated = jsonText.slice(0, 100_000);
            try {
              const parsed = JSON.parse(truncated) as {
                type?: string;
                results?: unknown;
                error?: unknown;
              };
              if (parsed.type === "results" && Array.isArray(parsed.results)) {
                settle({
                  kind: "results",
                  results: parsed.results as RawResult[],
                });
                return;
              }
              if (parsed.type === "error") {
                settle({
                  kind: "error",
                  message:
                    typeof parsed.error === "string"
                      ? parsed.error
                      : "harness reported an error",
                });
                return;
              }
              // type: "ready" — do nothing, just signals runner started
            } catch {
              // Malformed payload — keep listening.
            }
          }
        }
      }

      // Detect compile / runtime errors in the iframe.
      if (m.type === "action" && m.message) {
        // Don't settle on Sandpack's own action messages unless it's a
        // hard error after a long delay; the runner's catch usually handles
        // this and emits via console first.
      }
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [listen, timeoutMs]);

  return null;
}

export default AuditWorker;
