"use client";

import { SandpackExecutor, type PaperDna } from "@/components/SandpackExecutor";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Radar, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getExampleBySlug,
  type CuratedExample,
} from "../_data/examples";
import {
  addToHistory,
  getHistory,
  subscribeToHistory,
  type HistoryEntry,
  type HistorySource,
} from "../_lib/history";
import { decodeDnaFromParam } from "../_lib/share";
import { isMultiverseDna, type MultiverseDna } from "@/types/multiverse";
import {
  AgentProgressTimeline,
  type StepEntry,
  type StepId,
} from "./AgentProgressTimeline";
import { ToolCallFeed, type ToolCall } from "./ToolCallFeed";
import ExampleCards from "./ExampleCards";
import { HolographicRing } from "./HolographicRing";
import { LiveConsole } from "./LiveConsole";
import Hero from "./Hero";
import HeroAmbientGlow from "./HeroAmbientGlow";
import { HistorySidebar } from "./HistorySidebar";
import InputBox from "./InputBox";
import { PaperDnaCard } from "./PaperDnaCard";
import { AppLogo } from "./AppLogo";
import { AuditButton } from "./AuditButton";
import { DebateButton } from "./DebateButton";
import GenesisDebate from "./GenesisDebate";
import { DiscoveriesSidebar } from "./DiscoveriesSidebar";
import { DiscoveryButton } from "./DiscoveryButton";
import { ExportButton } from "./ExportButton";
import { HistoryButton } from "./HistoryButton";
import { ReproducibilityCertificate } from "./ReproducibilityCertificate";
import { ShareButton } from "./ShareButton";
import { StreamingKernelPanel } from "./StreamingKernelPanel";
import MultiverseInput from "./MultiverseInput";
import MultiverseProgress, { type MultiverseLane } from "./MultiverseProgress";
import MultiverseSynthesisPanel from "./MultiverseSynthesisPanel";
import PaperLineageStrip from "./PaperLineageStrip";
import FrontierInput from "./FrontierInput";
import FrontierProgress, {
  type FrontierPhase,
  type FrontierPaperPreview,
  type FrontierPaperState,
} from "./FrontierProgress";
import FrontierSourcesStrip from "./FrontierSourcesStrip";
import { isFrontierDna, type FrontierDna } from "@/types/frontier";
import CanonCarousel from "./CanonCarousel";
import type { CanonEntry } from "@/data/canon";
import LandingFeaturesGrid from "./LandingFeaturesGrid";
import LandingFeedback from "./LandingFeedback";
import LandingFooter from "./LandingFooter";

type Stage =
  | "idle"
  | "extracting"
  | "streaming-kernel"
  | "multiverse-extracting"
  | "multiverse-synthesizing"
  | "frontier-running"
  | "live";

type HomeMode = "single" | "multiverse" | "frontier";

type LiveSource =
  | { kind: "live"; url: string }
  | { kind: "example"; slug: string }
  | { kind: "shared" }
  | { kind: "history" }
  | { kind: "multiverse"; urls: string[] }
  | { kind: "frontier"; query: string }
  | { kind: "canon"; slug: string };

const STEP_ORDER: StepId[] = ["fetching", "parsing", "extracting", "generating"];

const STAGE_TRANSITION = { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] as const };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const EXAMPLE_TIMELINE: Array<{
  id: StepId;
  message: string;
  duration: number;
}> = [
  { id: "fetching", message: "Loading curated paper…", duration: 420 },
  { id: "parsing", message: "Parsing content…", duration: 380 },
  { id: "extracting", message: "Extracting algorithm DNA…", duration: 520 },
  { id: "generating", message: "Staging code kernel…", duration: 460 },
];

export function GenesisPipeline() {
  const [stage, setStage] = useState<Stage>("idle");
  const [paperDna, setPaperDna] = useState<PaperDna | null>(null);
  const [liveSource, setLiveSource] = useState<LiveSource | null>(null);
  const [steps, setSteps] = useState<StepEntry[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [agentBlurb, setAgentBlurb] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urlAttempted, setUrlAttempted] = useState("");
  const [healing, setHealing] = useState(false);
  const [healCount, setHealCount] = useState(0);
  const [streamingKernel, setStreamingKernel] = useState("");
  const [streamingDone, setStreamingDone] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [debateOpen, setDebateOpen] = useState(false);

  // Discovery state
  const [discoveriesOpen, setDiscoveriesOpen] = useState(false);
  const [paramOverride, setParamOverride] =
    useState<Record<string, number> | null>(null);
  const [activeDiscoveryId, setActiveDiscoveryId] = useState<string | null>(
    null,
  );

  // History state — lifted so the live header can host an inline button while
  // the standalone fixed trigger is hidden in that stage.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  useEffect(() => {
    const refresh = () => setHistoryCount(getHistory().length);
    refresh();
    return subscribeToHistory(refresh);
  }, []);

  // Extracting-stage elapsed timer — drives HolographicRing + LiveConsole MM:SS
  const [extractingElapsed, setExtractingElapsed] = useState(0);
  const [extractingStartedAt, setExtractingStartedAt] = useState<number | null>(
    null,
  );
  useEffect(() => {
    if (stage !== "extracting") {
      setExtractingStartedAt(null);
      setExtractingElapsed(0);
      return;
    }
    const start = Date.now();
    setExtractingStartedAt(start);
    setExtractingElapsed(0);
    const id = setInterval(() => {
      setExtractingElapsed(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [stage]);

  // Home mode (single URL / multiverse / frontier) — tri-state replaces
  // the old multiverseMode boolean while keeping the same UX gestures.
  const [homeMode, setHomeMode] = useState<HomeMode>("single");
  const multiverseMode = homeMode === "multiverse";
  const frontierMode = homeMode === "frontier";

  // Multiverse state
  const [multiverseLanes, setMultiverseLanes] = useState<MultiverseLane[]>([]);
  const [synthesisText, setSynthesisText] = useState("");
  const [synthesisDone, setSynthesisDone] = useState(false);

  // Frontier state
  const [frontierQuery, setFrontierQuery] = useState("");
  const [frontierPhase, setFrontierPhase] = useState<FrontierPhase>("searching");
  const [frontierPapers, setFrontierPapers] = useState<FrontierPaperPreview[]>(
    [],
  );
  const [frontierPaperStates, setFrontierPaperStates] = useState<
    Record<number, FrontierPaperState>
  >({});
  const [frontierPaperSources, setFrontierPaperSources] = useState<
    Record<number, string>
  >({});
  const [frontierSynthText, setFrontierSynthText] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const exampleCancelRef = useRef<{ cancelled: boolean } | null>(null);
  const kernelStreamAbortRef = useRef<AbortController | null>(null);
  const multiverseAbortsRef = useRef<AbortController[]>([]);
  const synthesisAbortRef = useRef<AbortController | null>(null);
  const frontierAbortRef = useRef<AbortController | null>(null);
  const wasCachedRef = useRef(false);

  const startStep = useCallback((id: StepId, message: string) => {
    setSteps((prev) => {
      const withoutId = prev.filter((s) => s.id !== id);
      const withPriorComplete = withoutId.map((s) =>
        s.state === "active" ? { ...s, state: "complete" as const } : s,
      );
      return [...withPriorComplete, { id, state: "active", message }];
    });
  }, []);

  const completeStep = useCallback(
    (id: StepId, metadata?: Record<string, unknown>) => {
      setSteps((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                state: "complete",
                metadata: metadata ?? s.metadata,
              }
            : s,
        ),
      );
    },
    [],
  );

  const updateLane = useCallback(
    (paperIndex: number, updater: (lane: MultiverseLane) => MultiverseLane) => {
      setMultiverseLanes((prev) =>
        prev.map((l) => (l.paperIndex === paperIndex ? updater(l) : l)),
      );
    },
    [],
  );

  const resetBeforeStart = useCallback(() => {
    abortRef.current?.abort();
    kernelStreamAbortRef.current?.abort();
    multiverseAbortsRef.current.forEach((c) => c.abort());
    multiverseAbortsRef.current = [];
    synthesisAbortRef.current?.abort();
    if (exampleCancelRef.current) exampleCancelRef.current.cancelled = true;
    setError(null);
    setSteps([]);
    setToolCalls([]);
    setAgentBlurb(null);
    setPaperDna(null);
    setHealing(false);
    setHealCount(0);
    setStreamingKernel("");
    setStreamingDone(false);
    setAuditOpen(false);
    setDiscoveriesOpen(false);
    setParamOverride(null);
    setActiveDiscoveryId(null);
    setMultiverseLanes([]);
    setSynthesisText("");
    setSynthesisDone(false);
    wasCachedRef.current = false;
  }, []);

  const pushHistory = useCallback(
    (
      dna: PaperDna,
      opts: { source: HistorySource; slug?: string },
    ): HistoryEntry | null => {
      try {
        return addToHistory(dna, opts);
      } catch {
        return null;
      }
    },
    [],
  );

  const streamKernel = useCallback(async (dna: PaperDna) => {
    const controller = new AbortController();
    kernelStreamAbortRef.current = controller;
    setStreamingKernel("");
    setStreamingDone(false);

    const finishToLive = () => {
      setStreamingDone(true);
      setStage("live");
    };

    try {
      const res = await fetch("/api/agent/kernel-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kernel: dna.code_kernel,
          vizType: dna.visualization_type,
          title: dna.title,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        console.warn("[GENESIS] kernel-stream non-ok, skipping streaming");
        finishToLive();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

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

          if (eventName === "kernel_delta") {
            const text = typeof data.text === "string" ? data.text : "";
            if (text) {
              acc += text;
              setStreamingKernel(acc);
            }
          } else if (eventName === "kernel_done") {
            setStreamingDone(true);
            // Linger briefly so the user can register completion, then mount Sandpack.
            setTimeout(() => setStage("live"), 600);
            return;
          } else if (eventName === "error") {
            console.warn("[GENESIS] kernel-stream error:", data.message);
            finishToLive();
            return;
          }
        }
      }

      finishToLive();
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      console.warn("[GENESIS] kernel-stream failed:", e);
      finishToLive();
    } finally {
      if (kernelStreamAbortRef.current === controller) {
        kernelStreamAbortRef.current = null;
      }
    }
  }, []);

  const startExtraction = useCallback(
    async (url: string) => {
      resetBeforeStart();
      setUrlAttempted(url);
      setLiveSource({ kind: "live", url });
      setStage("extracting");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/agent/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Agent extract failed: HTTP ${res.status}`);
        }
        if (!res.body) throw new Error("No response body from /api/agent/extract");

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

            if (eventName === "status") {
              const msg = typeof data.message === "string" ? data.message : "";
              if (msg) setAgentBlurb(msg);
              if (data.cached === true) wasCachedRef.current = true;
            } else if (eventName === "step_start") {
              const id = data.step as StepId;
              const message =
                typeof data.message === "string" ? data.message : "";
              if (STEP_ORDER.includes(id)) startStep(id, message);
            } else if (eventName === "step_complete") {
              const id = data.step as StepId;
              const metadata = (data.metadata as Record<string, unknown>) ?? undefined;
              if (STEP_ORDER.includes(id)) completeStep(id, metadata);
            } else if (eventName === "tool_call") {
              const id = typeof data.id === "string" ? data.id : "";
              const name = typeof data.name === "string" ? data.name : "";
              const argSummary =
                typeof data.argSummary === "string" ? data.argSummary : "";
              if (id && name) {
                setToolCalls((prev) => [
                  ...prev,
                  { id, name, argSummary, state: "running" },
                ]);
              }
            } else if (eventName === "tool_result") {
              const id = typeof data.id === "string" ? data.id : "";
              const ok = data.ok !== false;
              const summary =
                typeof data.summary === "string" ? data.summary : undefined;
              setToolCalls((prev) =>
                prev.map((c) =>
                  c.id === id
                    ? {
                        ...c,
                        state: ok ? "success" : "error",
                        resultSummary: summary,
                      }
                    : c,
                ),
              );
            } else if (eventName === "agent_message") {
              const text = typeof data.text === "string" ? data.text : "";
              if (text) setAgentBlurb(text);
            } else if (eventName === "done") {
              const dna = data.paperDna as PaperDna | undefined;
              if (!dna) throw new Error("done event missing paperDna");
              setSteps((prev) =>
                prev.map((s) =>
                  s.state === "active" ? { ...s, state: "complete" } : s,
                ),
              );
              setPaperDna(dna);
              pushHistory(dna, { source: "live" });
              if (wasCachedRef.current) {
                setStage("live");
              } else {
                setStage("streaming-kernel");
                streamKernel(dna);
              }
              return;
            } else if (eventName === "error") {
              throw new Error(
                typeof data.message === "string" ? data.message : "Agent failed",
              );
            }
          }
        }

        throw new Error("Agent stream ended without a final result");
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          setStage("idle");
          return;
        }
        setError((e as Error).message);
        setStage("idle");
      } finally {
        abortRef.current = null;
      }
    },
    [startStep, completeStep, resetBeforeStart, pushHistory, streamKernel],
  );

  /**
   * Run a single agent extraction lane in the multiverse flow.
   * Multiplexes events into the per-lane state (no global step/toolCall state).
   * Returns the extracted PaperDna; throws on stream-level error.
   */
  const runExtractionLane = useCallback(
    async (
      url: string,
      paperIndex: number,
      signal: AbortSignal,
    ): Promise<PaperDna> => {
      const res = await fetch("/api/agent/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("No response body");

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

          if (eventName === "status") {
            const msg = typeof data.message === "string" ? data.message : "";
            const cached = data.cached === true;
            updateLane(paperIndex, (l) => ({
              ...l,
              blurb: msg || l.blurb,
              cached: cached || l.cached,
            }));
          } else if (eventName === "step_start") {
            const id = data.step as StepId;
            const message =
              typeof data.message === "string" ? data.message : "";
            if (STEP_ORDER.includes(id)) {
              updateLane(paperIndex, (l) => {
                const withoutId = l.steps.filter((s) => s.id !== id);
                const withPriorComplete = withoutId.map((s) =>
                  s.state === "active"
                    ? { ...s, state: "complete" as const }
                    : s,
                );
                return {
                  ...l,
                  steps: [
                    ...withPriorComplete,
                    { id, state: "active", message },
                  ],
                };
              });
            }
          } else if (eventName === "step_complete") {
            const id = data.step as StepId;
            const metadata =
              (data.metadata as Record<string, unknown>) ?? undefined;
            if (STEP_ORDER.includes(id)) {
              updateLane(paperIndex, (l) => ({
                ...l,
                steps: l.steps.map((s) =>
                  s.id === id
                    ? {
                        ...s,
                        state: "complete",
                        metadata: metadata ?? s.metadata,
                      }
                    : s,
                ),
                paperTitle:
                  id === "fetching" &&
                  metadata &&
                  typeof metadata.title === "string"
                    ? metadata.title
                    : l.paperTitle,
              }));
            }
          } else if (eventName === "tool_call") {
            const id = typeof data.id === "string" ? data.id : "";
            const name = typeof data.name === "string" ? data.name : "";
            const argSummary =
              typeof data.argSummary === "string" ? data.argSummary : "";
            if (id && name) {
              updateLane(paperIndex, (l) => ({
                ...l,
                toolCalls: [
                  ...l.toolCalls,
                  { id, name, argSummary, state: "running" },
                ],
              }));
            }
          } else if (eventName === "tool_result") {
            const id = typeof data.id === "string" ? data.id : "";
            const ok = data.ok !== false;
            const summary =
              typeof data.summary === "string" ? data.summary : undefined;
            updateLane(paperIndex, (l) => ({
              ...l,
              toolCalls: l.toolCalls.map((c) =>
                c.id === id
                  ? {
                      ...c,
                      state: ok ? "success" : "error",
                      resultSummary: summary,
                    }
                  : c,
              ),
            }));
          } else if (eventName === "agent_message") {
            const text = typeof data.text === "string" ? data.text : "";
            if (text) updateLane(paperIndex, (l) => ({ ...l, blurb: text }));
          } else if (eventName === "done") {
            const dna = data.paperDna as PaperDna | undefined;
            if (!dna) throw new Error("done event missing paperDna");
            updateLane(paperIndex, (l) => ({
              ...l,
              steps: l.steps.map((s) =>
                s.state === "active" ? { ...s, state: "complete" } : s,
              ),
              paperTitle: dna.title,
              state: "complete",
              blurb: null,
            }));
            return dna;
          } else if (eventName === "error") {
            throw new Error(
              typeof data.message === "string" ? data.message : "Agent failed",
            );
          }
        }
      }

      throw new Error("Agent stream ended without a final result");
    },
    [updateLane],
  );

  const startMultiverse = useCallback(
    async (urls: string[]) => {
      resetBeforeStart();
      setUrlAttempted(`multiverse · ${urls.length} papers`);
      setLiveSource({ kind: "multiverse", urls });
      setStage("multiverse-extracting");

      const initialLanes: MultiverseLane[] = urls.map((url, i) => ({
        paperIndex: i,
        url,
        paperTitle: null,
        state: "running",
        steps: [],
        toolCalls: [],
        blurb: null,
        errorMessage: null,
        cached: false,
      }));
      setMultiverseLanes(initialLanes);

      const controllers: AbortController[] = urls.map(
        () => new AbortController(),
      );
      multiverseAbortsRef.current = controllers;

      const settled = await Promise.allSettled(
        urls.map((url, i) =>
          runExtractionLane(url, i, controllers[i].signal).catch((err) => {
            if ((err as Error).name === "AbortError") throw err;
            updateLane(i, (l) => ({
              ...l,
              state: "error",
              errorMessage: (err as Error).message,
            }));
            throw err;
          }),
        ),
      );

      // If user cancelled any lane, the Promise.allSettled may include
      // AbortError rejections — that means the run was cancelled, not failed.
      const cancelled = controllers.some((c) => c.signal.aborted);
      if (cancelled) {
        setStage("idle");
        return;
      }

      const successfulPapers: Array<{
        dna: PaperDna;
        url: string;
        paperIndex: number;
      }> = [];
      settled.forEach((r, i) => {
        if (r.status === "fulfilled") {
          successfulPapers.push({
            dna: r.value,
            url: urls[i],
            paperIndex: i,
          });
        }
      });

      if (successfulPapers.length < 2) {
        setError(
          "Need at least 2 papers to synthesize. Check the URLs and try again.",
        );
        setStage("idle");
        return;
      }

      // Move to synthesis
      setStage("multiverse-synthesizing");
      setSynthesisText("");
      setSynthesisDone(false);

      const synthCtrl = new AbortController();
      synthesisAbortRef.current = synthCtrl;

      try {
        const res = await fetch("/api/agent/multiverse/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            papers: successfulPapers.map((p) => ({ ...p.dna, url: p.url })),
          }),
          signal: synthCtrl.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error ?? `Synthesis failed: HTTP ${res.status}`,
          );
        }
        if (!res.body) throw new Error("No response body from synthesizer");

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
              else if (line.startsWith("data: "))
                dataParts.push(line.slice(6));
            }
            const dataText = dataParts.join("\n");
            if (!dataText) continue;

            let data: Record<string, unknown>;
            try {
              data = JSON.parse(dataText);
            } catch {
              continue;
            }

            if (eventName === "synthesis_delta") {
              const text = typeof data.text === "string" ? data.text : "";
              if (text) setSynthesisText((prev) => prev + text);
            } else if (eventName === "done") {
              const mvDna = data.multiverseDna as MultiverseDna | undefined;
              if (!mvDna)
                throw new Error("Synthesis done event missing multiverseDna");
              setSynthesisDone(true);
              setPaperDna(mvDna);
              pushHistory(mvDna, { source: "live" });
              setTimeout(() => setStage("live"), 600);
              return;
            } else if (eventName === "error") {
              throw new Error(
                typeof data.message === "string"
                  ? data.message
                  : "Synthesis failed",
              );
            }
          }
        }

        throw new Error("Synthesis stream ended without a final result");
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          setStage("idle");
          return;
        }
        setError((e as Error).message);
        setStage("idle");
      } finally {
        synthesisAbortRef.current = null;
      }
    },
    [resetBeforeStart, runExtractionLane, updateLane, pushHistory],
  );

  // Frontier — natural-language research-problem search → auto-fetch top
  // papers → Opus synthesizes a hybrid kernel. Single SSE stream from
  // /api/agent/frontier; this callback parses phase events and lands at
  // `live` with a FrontierDna.
  const startFrontier = useCallback(
    async (query: string, maxPapers: number) => {
      resetBeforeStart();
      setUrlAttempted(`frontier · ${query}`);
      setLiveSource({ kind: "frontier", query });
      setFrontierQuery(query);
      setFrontierPhase("searching");
      setFrontierPapers([]);
      setFrontierPaperStates({});
      setFrontierPaperSources({});
      setFrontierSynthText("");
      setStage("frontier-running");

      const controller = new AbortController();
      frontierAbortRef.current = controller;

      try {
        const res = await fetch("/api/agent/frontier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, maxPapers }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ??
              `Frontier failed: HTTP ${res.status}`,
          );
        }
        if (!res.body) throw new Error("No response body from frontier");

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
              if (line.startsWith("event: "))
                eventName = line.slice(7).trim();
              else if (line.startsWith("data: "))
                dataParts.push(line.slice(6));
            }
            const dataText = dataParts.join("\n");
            if (!dataText) continue;
            let data: Record<string, unknown>;
            try {
              data = JSON.parse(dataText);
            } catch {
              continue;
            }

            if (eventName === "status") {
              const phase = data.phase as FrontierPhase | undefined;
              if (
                phase === "searching" ||
                phase === "reading" ||
                phase === "synthesizing"
              ) {
                setFrontierPhase(phase);
              }
            } else if (eventName === "papers_found") {
              const list = (data.papers as FrontierPaperPreview[]) ?? [];
              setFrontierPapers(list);
              const initStates: Record<number, FrontierPaperState> = {};
              for (let i = 0; i < list.length; i++) initStates[i] = "pending";
              setFrontierPaperStates(initStates);
            } else if (eventName === "paper_fetching") {
              const i = data.paperIndex as number;
              setFrontierPaperStates((prev) => ({ ...prev, [i]: "fetching" }));
            } else if (eventName === "paper_fetched") {
              const i = data.paperIndex as number;
              const hasBody = Boolean(data.hasBody);
              const provenance = (data.source as string) ?? "";
              setFrontierPaperStates((prev) => ({
                ...prev,
                [i]: hasBody ? "fetched" : "warned",
              }));
              setFrontierPaperSources((prev) => ({
                ...prev,
                [i]: provenance,
              }));
            } else if (eventName === "synthesis_delta") {
              const text =
                typeof data.text === "string" ? data.text : "";
              if (text) setFrontierSynthText((prev) => prev + text);
            } else if (eventName === "done") {
              const dna = data.frontierDna as FrontierDna | undefined;
              if (!dna) throw new Error("Frontier done event missing DNA");
              setFrontierPhase("done");
              setPaperDna(dna);
              pushHistory(dna, { source: "live" });
              // Brief pause so the user sees the "done" check before the
              // stage transition swallows the progress UI.
              setTimeout(() => setStage("live"), 700);
              return;
            } else if (eventName === "error") {
              throw new Error(
                typeof data.message === "string"
                  ? data.message
                  : "Frontier failed",
              );
            }
          }
        }

        throw new Error("Frontier stream ended without a final result");
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          setStage("idle");
          return;
        }
        setError((e as Error).message);
        setHomeMode("frontier");
        setStage("idle");
      } finally {
        frontierAbortRef.current = null;
      }
    },
    [resetBeforeStart, pushHistory],
  );

  // Canon — pre-computed legendary papers. The DNA is shipped with the app
  // so we skip the entire extracting/streaming pipeline and land directly
  // at `live`. Zero-second time-to-visualization for first-time visitors.
  const startFromCanon = useCallback(
    (entry: CanonEntry) => {
      resetBeforeStart();
      setUrlAttempted(`canon · ${entry.shortTitle}`);
      setLiveSource({ kind: "canon", slug: entry.slug });
      setPaperDna(entry.dna);
      pushHistory(entry.dna, { source: "live" });
      setStage("live");
    },
    [resetBeforeStart, pushHistory],
  );

  const startFromExample = useCallback(
    async (example: CuratedExample) => {
      resetBeforeStart();
      setUrlAttempted(`curated · ${example.cardTitle}`);
      setLiveSource({ kind: "example", slug: example.slug });
      setAgentBlurb(`Preparing “${example.cardTitle}”…`);
      setStage("extracting");

      const ticket = { cancelled: false };
      exampleCancelRef.current = ticket;

      try {
        for (const phase of EXAMPLE_TIMELINE) {
          if (ticket.cancelled) return;
          startStep(phase.id, phase.message);
          await sleep(phase.duration);
          if (ticket.cancelled) return;
          const metadata =
            phase.id === "fetching"
              ? {
                  title: example.paperDna.title,
                  authors: ["Curated demo"],
                  categories: [example.domain],
                }
              : phase.id === "generating"
                ? {
                    code_kernel_chars: example.paperDna.code_kernel.length,
                    parameter_count: example.paperDna.parameters.length,
                  }
                : undefined;
          completeStep(phase.id, metadata);
        }
        if (ticket.cancelled) return;
        setPaperDna(example.paperDna);
        setStage("live");
        pushHistory(example.paperDna, {
          source: "example",
          slug: example.slug,
        });
      } finally {
        if (exampleCancelRef.current === ticket) {
          exampleCancelRef.current = null;
        }
      }
    },
    [resetBeforeStart, startStep, completeStep, pushHistory],
  );

  const restoreDirect = useCallback(
    (
      dna: PaperDna,
      source: LiveSource,
      recordHistory: { source: HistorySource; slug?: string } | null,
    ) => {
      resetBeforeStart();
      setLiveSource(source);
      setPaperDna(dna);
      setUrlAttempted(
        source.kind === "example"
          ? `curated · ${dna.title}`
          : source.kind === "shared"
            ? "shared link"
            : dna.title,
      );
      setStage("live");
      if (recordHistory) pushHistory(dna, recordHistory);
    },
    [resetBeforeStart, pushHistory],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    kernelStreamAbortRef.current?.abort();
    multiverseAbortsRef.current.forEach((c) => c.abort());
    multiverseAbortsRef.current = [];
    synthesisAbortRef.current?.abort();
    if (exampleCancelRef.current) exampleCancelRef.current.cancelled = true;
    setStage("idle");
  }, []);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    kernelStreamAbortRef.current?.abort();
    multiverseAbortsRef.current.forEach((c) => c.abort());
    multiverseAbortsRef.current = [];
    synthesisAbortRef.current?.abort();
    frontierAbortRef.current?.abort();
    frontierAbortRef.current = null;
    if (exampleCancelRef.current) exampleCancelRef.current.cancelled = true;
    setStage("idle");
    setHomeMode("single");
    setPaperDna(null);
    setLiveSource(null);
    setSteps([]);
    setToolCalls([]);
    setAgentBlurb(null);
    setError(null);
    setUrlAttempted("");
    setHealing(false);
    setHealCount(0);
    setStreamingKernel("");
    setStreamingDone(false);
    setAuditOpen(false);
    setDiscoveriesOpen(false);
    setParamOverride(null);
    setActiveDiscoveryId(null);
    setMultiverseLanes([]);
    setSynthesisText("");
    setSynthesisDone(false);
  }, []);

  const handleHistorySelect = useCallback(
    (entry: HistoryEntry) => {
      const source: LiveSource = entry.slug
        ? { kind: "example", slug: entry.slug }
        : { kind: "history" };
      restoreDirect(entry.paperDna, source, null);
    },
    [restoreDirect],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const exampleSlug = params.get("example");
    const dnaParam = params.get("dna");

    if (exampleSlug) {
      const example = getExampleBySlug(exampleSlug);
      if (example) {
        restoreDirect(
          example.paperDna,
          { kind: "example", slug: example.slug },
          { source: "example", slug: example.slug },
        );
        const clean = window.location.pathname;
        window.history.replaceState({}, "", clean);
        return;
      }
    }
    if (dnaParam) {
      const decoded = decodeDnaFromParam(dnaParam);
      if (decoded) {
        restoreDirect(
          decoded,
          { kind: "shared" },
          { source: "live" },
        );
        const clean = window.location.pathname;
        window.history.replaceState({}, "", clean);
      }
    }
  }, [restoreDirect]);

  const handleExecutorStatus = useCallback(
    (status: "compiling" | "installing" | "running" | "live" | "healing" | "error") => {
      setHealing(status === "healing");
    },
    [],
  );

  const handleHealed = useCallback(() => {
    setHealCount((c) => c + 1);
  }, []);

  const synthesisPaperTitles = multiverseLanes
    .filter((l) => l.state === "complete" && l.paperTitle)
    .map((l) => l.paperTitle!) as string[];

  return (
    <>
      {stage !== "idle" && <AppLogo onReset={handleReset} />}
      <HistorySidebar
        onSelect={handleHistorySelect}
        controlled={{ open: historyOpen, onOpenChange: setHistoryOpen }}
        hideTrigger={stage === "live"}
      />
      <AnimatePresence mode="wait">
        {stage === "idle" && (
        <motion.div
          key="idle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -16 }}
          transition={STAGE_TRANSITION}
          className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-7 px-4 sm:gap-8 sm:px-8"
        >
          <HeroAmbientGlow />
          <Hero />
          {homeMode === "single" ? (
            <>
              <InputBox
                onSubmit={startExtraction}
                initialUrl={
                  urlAttempted.startsWith("curated") ||
                  urlAttempted.startsWith("multiverse") ||
                  urlAttempted.startsWith("frontier")
                    ? ""
                    : urlAttempted
                }
                error={error}
              />
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setHomeMode("multiverse");
                  }}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-500/[0.04] px-3 py-1.5 text-[11px] font-medium text-violet-200/80 transition-colors hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-violet-100"
                >
                  <Sparkles className="h-3 w-3" />
                  Compare 2–3 papers in a multiverse
                  <span className="text-violet-300 transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setHomeMode("frontier");
                  }}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/[0.05] px-3 py-1.5 text-[11px] font-medium text-cyan-100/90 transition-colors hover:border-cyan-400/45 hover:bg-cyan-500/10 hover:text-cyan-100"
                >
                  <Radar className="h-3 w-3" />
                  Search the research frontier
                  <span className="text-cyan-300 transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </button>
              </div>
              <ExampleCards onSelect={startFromExample} />
              <CanonCarousel onSelect={startFromCanon} />
              {/* Below-the-fold landing stack — its own internal cadence so
               * the hero block above keeps its tighter gap-7 rhythm. */}
              <div className="mt-12 flex w-full flex-col gap-20 sm:mt-20 sm:gap-28">
                <LandingFeaturesGrid />
                <LandingFeedback />
                <LandingFooter />
              </div>
            </>
          ) : homeMode === "multiverse" ? (
            <MultiverseInput
              onSubmit={startMultiverse}
              onBack={() => {
                setError(null);
                setHomeMode("single");
              }}
              error={error}
            />
          ) : (
            <FrontierInput
              onSubmit={startFrontier}
              onBack={() => {
                setError(null);
                setHomeMode("single");
              }}
              error={error}
            />
          )}
        </motion.div>
      )}

      {stage === "extracting" && (
        <motion.div
          key="extracting"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={STAGE_TRANSITION}
          className="relative z-10 flex w-full max-w-lg flex-col items-center gap-4 sm:max-w-xl sm:gap-6 lg:max-w-5xl lg:gap-8"
        >
          <div className="grid w-full gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-stretch sm:gap-5">
            <div className="flex flex-col items-center justify-center sm:items-start">
              <HolographicRing elapsedSeconds={extractingElapsed} size={160} />
            </div>
            <LiveConsole
              steps={steps}
              toolCalls={toolCalls}
              agentBlurb={agentBlurb}
              startedAt={extractingStartedAt}
            />
          </div>

          <div className="relative w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md sm:p-5">
            {/* Glow rim at top — visually connects the helix's aura to the panel */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-16 -top-px h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent"
            />
            <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
                </span>
                Managed Agent · Live
              </div>
              <div className="min-w-0 max-w-full truncate text-[10px] font-mono text-zinc-600 sm:max-w-[40ch]">
                {urlAttempted}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
              <div>
                <div className="mb-2.5 inline-flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.22em] text-zinc-500 lg:hidden">
                  Pipeline
                </div>
                <AgentProgressTimeline steps={steps} />
              </div>
              <div className="border-t border-white/5 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <ToolCallFeed calls={toolCalls} />
                {toolCalls.length === 0 && (
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                    Tool calls
                    <div className="mt-2 rounded-md border border-white/5 bg-black/20 px-3 py-3 text-[11px] normal-case tracking-normal text-zinc-500">
                      Awaiting first tool invocation…
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 min-h-[14px] border-t border-white/5 pt-3">
              <AnimatePresence mode="wait">
                {agentBlurb && (
                  <motion.div
                    key={agentBlurb}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.25 }}
                    className="truncate text-[11px] text-zinc-500"
                  >
                    {agentBlurb}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-200"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
        </motion.div>
      )}

      {stage === "multiverse-extracting" && (
        <MultiverseProgress lanes={multiverseLanes} onCancel={handleCancel} />
      )}

      {stage === "multiverse-synthesizing" && (
        <motion.div
          key="multiverse-synthesizing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={STAGE_TRANSITION}
          className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-5"
        >
          <MultiverseSynthesisPanel
            text={synthesisText}
            done={synthesisDone}
            paperTitles={synthesisPaperTitles}
          />
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-200"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
        </motion.div>
      )}

      {stage === "frontier-running" && (
        <motion.div
          key="frontier-running"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={STAGE_TRANSITION}
          className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-5 px-3 sm:px-6"
        >
          <FrontierProgress
            query={frontierQuery}
            phase={frontierPhase}
            papers={frontierPapers}
            paperStates={frontierPaperStates}
            paperSources={frontierPaperSources}
            synthesisText={frontierSynthText}
            onCancel={handleCancel}
          />
        </motion.div>
      )}

      {stage === "streaming-kernel" && paperDna && (
        <motion.div
          key="streaming-kernel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative z-10 flex min-h-0 w-full max-w-[1700px] flex-1 flex-col gap-5 px-1 sm:px-3 lg:px-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pl-1">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="truncate text-[13px] font-medium text-zinc-200 sm:text-[14px]">
                {paperDna.title.length > 80
                  ? paperDna.title.slice(0, 80) + "…"
                  : paperDna.title}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-200"
            >
              <X className="h-3 w-3" />
              Skip
            </button>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)] xl:gap-6">
            <PaperDnaCard
              paperDna={paperDna}
              className="min-h-0 lg:overflow-y-auto"
            />
            <StreamingKernelPanel
              code={streamingKernel}
              done={streamingDone}
              vizType={paperDna.visualization_type}
              className="min-h-[520px] lg:min-h-0"
            />
          </div>
        </motion.div>
      )}

      {stage === "live" && paperDna && (
        <motion.div
          key="live"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
          className="relative z-10 flex min-h-0 w-full max-w-[1700px] flex-1 flex-col gap-5 px-1 sm:px-3 lg:px-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pl-1">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="truncate text-[13px] font-medium text-zinc-200 sm:text-[14px]">
                {paperDna.title.length > 80 ? paperDna.title.slice(0, 80) + "…" : paperDna.title}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              {healCount > 0 && !healing && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex h-[28px] items-center gap-1 rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 text-[10px] font-medium text-violet-200"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  self-healed ×{healCount}
                </motion.span>
              )}
              <DiscoveryButton
                active={discoveriesOpen}
                onClick={() => setDiscoveriesOpen((v) => !v)}
              />
              <AuditButton
                active={auditOpen}
                onClick={() => setAuditOpen((v) => !v)}
              />
              <DebateButton
                active={debateOpen}
                onClick={() => setDebateOpen((v) => !v)}
              />
              <ExportButton paperDna={paperDna} />
              <ShareButton
                target={
                  liveSource?.kind === "example"
                    ? { kind: "example", slug: liveSource.slug }
                    : { kind: "dna", dna: paperDna }
                }
              />
              {historyCount > 0 && (
                <HistoryButton
                  onClick={() => setHistoryOpen(true)}
                  count={historyCount}
                />
              )}
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-100"
              >
                <ArrowLeft className="h-3 w-3" />
                Try Another Paper
              </button>
            </div>
          </div>

          {isMultiverseDna(paperDna) && <PaperLineageStrip dna={paperDna} />}
          {isFrontierDna(paperDna) && <FrontierSourcesStrip dna={paperDna} />}

          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)] xl:gap-6">
            <PaperDnaCard
              paperDna={paperDna}
              healing={healing}
              className="min-h-0 lg:overflow-y-auto"
            />
            <SandpackExecutor
              paperDna={paperDna}
              className="min-h-[520px] lg:min-h-0"
              onStatusChange={handleExecutorStatus}
              onHealed={handleHealed}
              paramOverride={paramOverride}
            />
          </div>

          <AnimatePresence>
            {discoveriesOpen && (
              <DiscoveriesSidebar
                key="discoveries"
                paperDna={paperDna}
                onClose={() => setDiscoveriesOpen(false)}
                onApply={(params, discoveryId) => {
                  // Spread on every apply so a new object identity always
                  // triggers SandpackExecutor's postMessage effect — even
                  // if the user clicks the SAME discovery twice (e.g. after
                  // manually scrubbing a slider).
                  setParamOverride({ ...params });
                  setActiveDiscoveryId(discoveryId);
                }}
                activeDiscoveryId={activeDiscoveryId}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {auditOpen && (
              <ReproducibilityCertificate
                key="audit"
                paperDna={paperDna}
                url={
                  liveSource?.kind === "live" ? liveSource.url : null
                }
                onClose={() => setAuditOpen(false)}
              />
            )}
          </AnimatePresence>

          <GenesisDebate
            paperDna={paperDna}
            url={liveSource?.kind === "live" ? liveSource.url : null}
            open={debateOpen}
            onClose={() => setDebateOpen(false)}
          />
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}

export default GenesisPipeline;
