<div align="center">

# GENESIS

### From Research Paper to Working Prototype in 60 Seconds.

[![Built with Next.js 16](https://img.shields.io/badge/Built%20with-Next.js%2016-000?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Powered by Claude Opus 4.7](https://img.shields.io/badge/Powered%20by-Claude%20Opus%204.7-A78BFA?style=for-the-badge)](https://www.anthropic.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-22D3EE?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Sandpack](https://img.shields.io/badge/Sandbox-Sandpack-EC4899?style=for-the-badge)](https://sandpack.codesandbox.io)

**Paste any research paper. Watch it become an interactive simulation. Stress-test the methodology with autonomous AI reviewers.**

</div>

---

## TL;DR

GENESIS is an AI-powered scientific simulation platform. You give it a paper — an arXiv link, a PMC URL, an Elsevier paywall page, even a natural-language research problem — and roughly 60 seconds later you're scrubbing parameter sliders on a runnable JavaScript implementation of that paper's core algorithm. Two Opus 4.7 agents will then debate the methodology in real time. A third will run a reproducibility audit against the paper's own numerical claims. A fourth will sweep the parameter space and report the regimes where the algorithm breaks. The system gets measurably better with use, because every successful extraction is fed forward as a few-shot anchor for the next one.

This is not a paper-summarizer. It's a research lab that runs at the speed of thought.

---

## Table of Contents

- [The Pitch](#the-pitch)
- [Feature Index](#feature-index)
- [The 60-Second Magic](#the-60-second-magic)
- [Architecture](#architecture)
- [The Extraction Pipeline (Deep Dive)](#the-extraction-pipeline-deep-dive)
- [The Sandpack Sandbox](#the-sandpack-sandbox)
- [The Self-Healing Loop](#the-self-healing-loop)
- [Native Features](#native-features)
  - [Core Extraction](#1-core-extraction)
  - [GENESIS Multiverse](#2-genesis-multiverse)
  - [GENESIS Frontier](#3-genesis-frontier)
  - [The Canon — Pre-computed Legends](#4-the-canon--pre-computed-legends)
  - [Agentic Audit](#5-agentic-audit)
  - [GENESIS Debate](#6-genesis-debate)
  - [Autonomous Discovery](#7-autonomous-discovery)
  - [GENESIS Memory (Persistent Cross-run Learning)](#8-genesis-memory-persistent-cross-run-learning)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Running Locally](#running-locally)
- [Environment Variables](#environment-variables)
- [Security Posture](#security-posture)
- [Roadmap](#roadmap)
- [License & Acknowledgments](#license--acknowledgments)

---

## The Pitch

Reading a research paper — really reading it — takes hours. Re-implementing one takes weeks. Comparing three competing approaches against the same parameter axis takes a graduate student months.

GENESIS compresses that loop into a minute.

The core trick: a research paper isn't really *prose*. It's a description of an algorithm with parameters, equations, and a regime of validity, dressed up in human language. If you can convince a sufficiently capable model to extract that algorithmic skeleton — the **Paper DNA** — and emit it as runnable JavaScript, the rest of a research workflow (parameter sweeps, methodology critique, reproducibility checks, cross-paper synthesis) becomes a UI problem.

Claude Opus 4.7 is sufficiently capable. Sandpack provides a cross-origin sandbox that runs the model's output safely in the browser. Next.js streams every phase of the extraction over Server-Sent Events so the user sees the agent reasoning live. Everything else — Multiverse, Audit, Debate, Discovery, Memory, Canon, Frontier — is a different kind of question to ask the same DNA, dressed in a different cinematic UI.

---

## Feature Index

| # | Feature | What it does | Time to first paint |
|---|---------|--------------|---------------------|
| 1 | **Core Extraction** | Paper URL → runnable simulation | ~60s |
| 2 | **Multiverse** | Fuse 2-3 papers into one comparable chart | ~90s |
| 3 | **Frontier** | Plain-English research problem → top-N papers auto-fetched and synthesized into a hybrid kernel | ~120s |
| 4 | **The Canon** | 12 pre-computed legendary papers (Lorenz, Hopfield, Hodgkin-Huxley...) | **0s** (instant) |
| 5 | **Agentic Audit** | Extract numerical claims, generate a JS harness, run it against the live kernel, report pass/fail | ~30s |
| 6 | **AI Debate** | Two Opus agents — Attacker and Defender — argue the paper's methodology in real-time monospace console | ~60s |
| 7 | **Autonomous Discovery** | Sweep the parameter space, surface phase transitions and instabilities the authors never reported | ~45s |
| 8 | **Memory Bank** | Every successful extraction becomes a few-shot exemplar for the next one, with Anthropic prompt-caching | Cumulative |

Plus: a Netflix-style carousel of the Canon, a cinematic homepage with sweeping ambient light, full-text paper fetching across arXiv HTML / PMC JATS / OpenAlex, kernel self-healing, parameter-override "what-if" overlays from Discovery, share-link DNA encoding, history sidebar, export-to-static-HTML for sharing, a five-card features grid, a feedback waitlist, and functional `/privacy` and `/terms` pages.

---

## The 60-Second Magic

```
0s        Paste arXiv URL · Generate
          ▼
2s        Cache check · paper fetched (arXiv HTML render preferred)
          ▼
4s        Memory Bank · 2 few-shot exemplars loaded for "neural_network"
          ▼
8s        Opus 4.7 streamed reasoning · agent timeline lights up:
            ─ fetching → parsing → extracting → generating
          ▼
55s       Paper DNA emitted (title, classification, 6 equations,
            8 parameters, visualization_type, code_kernel)
          ▼
58s       Kernel re-streamed with inline comments (cinematic typing)
          ▼
60s       Sandpack iframe mounts · simulation running · sliders live
          ▼
+10s      Click "Audit"     → numerical claims extracted, harness running
          Click "Debate"    → two agents arguing the methodology
          Click "Discovery" → parameter sweep finds an unreported regime
```

Every transition above is a real Server-Sent Event the UI is listening for. Nothing is faked.

---

## Architecture

GENESIS is a Next.js 16 application with a thin React UI in front of a stateless Node-runtime API. State lives in three places: the React tree, a filesystem cache under `.next/cache`, and Anthropic's prompt cache (5-minute ephemeral TTL).

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (Client)                            │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  React 19 · Framer Motion · Tailwind v4 · Geist + Geist Mono │   │
│   │  ┌────────────┐ ┌──────────────┐ ┌────────────────────────┐ │   │
│   │  │ Hero +     │ │ Live Stage   │ │ Sandpack iframe        │ │   │
│   │  │ Input box  │ │ Dashboard    │ │ (cross-origin sandbox  │ │   │
│   │  │ + Carousel │ │ + side panels│ │  for kernel execution) │ │   │
│   │  └─────┬──────┘ └───────┬──────┘ └──────────▲─────────────┘ │   │
│   │        │ POST           │ SSE              │ kernel.js     │   │
│   └────────┼────────────────┼──────────────────┼───────────────┘   │
│            │                │                  │                    │
└────────────┼────────────────┼──────────────────┼────────────────────┘
             │                │                  │
             ▼                ▼                  │
┌─────────────────────────────────────────────────────────────────────┐
│                  Next.js Server  (Node.js Runtime)                   │
│   ┌───────────────────────────────────────────────────────────┐     │
│   │  /api/extract  /api/agent/extract  /api/agent/audit       │     │
│   │  /api/agent/debate  /api/agent/discover  /api/heal        │     │
│   │  /api/agent/multiverse/synthesize  /api/agent/frontier    │     │
│   │  /api/agent/kernel-stream  /api/export/[vizType]          │     │
│   └────┬──────────┬──────────┬──────────┬──────────┬──────────┘     │
│        │          │          │          │          │                │
│        ▼          ▼          ▼          ▼          ▼                │
│   ┌────────┐ ┌────────┐ ┌──────────┐ ┌────────┐ ┌─────────────┐    │
│   │ DNA    │ │ Memory │ │ Paper    │ │ SSE    │ │ Self-heal   │    │
│   │ Cache  │ │ Bank   │ │ Fetcher  │ │ helpers│ │ retry loop  │    │
│   │ (LRU + │ │ (file  │ │ (arXiv,  │ │        │ │             │    │
│   │  fs)   │ │  + LRU)│ │  PMC,    │ │        │ │             │    │
│   │        │ │        │ │  OpenAlex│ │        │ │             │    │
│   └───┬────┘ └───┬────┘ └────┬─────┘ └────────┘ └─────────────┘    │
│       │          │           │                                       │
└───────┼──────────┼───────────┼───────────────────────────────────────┘
        │          │           │
        ▼          ▼           ▼
   ┌────────────────┐    ┌──────────────────────────────────────┐
   │  Anthropic API │    │ External Open Sources                │
   │  Claude Opus   │    │ arXiv  ·  OpenAlex  ·  NCBI/PMC      │
   │  4.7 · 1M ctx  │    │ (HTML render, JATS XML, Atom feeds)  │
   │  + prompt cache│    │                                      │
   └────────────────┘    └──────────────────────────────────────┘
```

**Key invariants:**

- **No secret ever reaches the client.** Every Anthropic, OpenAlex, or arXiv-side credential lives in `process.env` and is read only inside server route handlers. There are zero `NEXT_PUBLIC_*` API keys.
- **All AI-generated code runs cross-origin.** Sandpack hosts the user-visible preview iframe on a separate origin so a hostile kernel cannot reach the parent's storage, cookies, or DOM.
- **Every long-running operation is streamed.** No HTTP request blocks for more than ~50ms before the first byte hits the wire. Status, progress, and partial results stream as Server-Sent Events.
- **The server has no state except caches.** `.next/cache/genesis-dna/` and `.next/cache/genesis-memory/` are the only persistent stores; both are designed to be safe to delete at any time.

---

## The Extraction Pipeline (Deep Dive)

This is the system's heart. Walking through it end-to-end is the fastest way to understand how the rest works.

### Phase 1 · Paper Fetching

Implemented in [`src/app/api/agent/_helpers.ts`](src/app/api/agent/_helpers.ts). The dispatcher `fetchPaperMetadata(url)` looks at the URL and chooses one of four code paths:

```
URL → extractArxivId() ─── matches ──▶ fetchArxivMetadata()
                                            │
                                            ▼
                              try fetchArxivHtml()  ──▶ {body, source: "arxiv-html"}
                                            │ on fail
                                            ▼
                                  fetchArxivAtom()  ──▶ {abstract, source: "arxiv-abstract"}

URL → extractPubmedId() ── matches ──▶ fetchPubmedMetadata()
                                            │
                                            ▼
                              EFetch JATS XML  ──▶ parsePmcXml()
                                            │
                                            ▼
                              {body if <body> tag exists,
                               source: "pmc-fulltext" | "pmc-abstract"}

URL → no match ────────────────────▶ fetchGenericPaper()
                                            │
                                            ▼
                              HTML scrape + meta tags
                                            │
                                            ▼
                       if body thin AND DOI extractable
                                            │
                                            ▼
                              fetchOpenAlexByDoi()  ──▶ {title, abstract,
                                                          source: "openalex"}
```

Each fetcher returns a uniform `PaperMeta = { title, abstract, categories[], authors[], body?, source? }`. The optional `body` field is what unlocks methodologically-grounded downstream agents — without it, the Debate and Audit agents would be reasoning from a 200-word abstract, which their fairness contracts explicitly prohibit.

The arXiv HTML path uses the ar5iv render at `arxiv.org/html/{id}` and runs the response through `extractBodyTextFromHtml()` — a regex-only pipeline that strips `<script>`, `<style>`, `<nav>`, `<footer>`, `<aside>`, replaces `<math>` blocks with ` [math] ` placeholders (preserving prose flow without flooding the context window with MathML), prefers content inside `<article>` → `<main>` → `<body>`, and caps at 150,000 characters.

The PMC path parses the JATS XML body (`<body>` tag), strips `<fig>`/`<table-wrap>`/`<ref-list>`, flattens `<xref>`, and hits the same 150k cap.

The generic path is paywall-aware: when an HTML scrape returns less than 1500 chars of body text AND a DOI can be extracted (from the URL itself, from `<meta name="citation_doi">`, or from a bare DOI in `<head>`), the fetcher falls back to OpenAlex — which can reconstruct an abstract from `abstract_inverted_index` even for closed-publisher papers.

**SSRF guard:** Before any generic fetch, `rejectPrivateHosts()` blocks loopback (`127.x`, `localhost`, `::1`), RFC1918 ranges (`10.x`, `192.168.x`, `172.16-31.x`), link-local (`169.254.x` — covers AWS instance metadata), CGNAT, multicast, and IPv6 unique-local + link-local ranges. Plus a 15-second `AbortSignal.timeout` so a slow publisher cannot hold a route worker indefinitely.

### Phase 2 · Memory-Anchored Prompt Construction

Once metadata is in hand, [`/api/extract/route.ts`](src/app/api/extract/route.ts) (or its Managed-Agents variant at [`/api/agent/extract/route.ts`](src/app/api/agent/extract/route.ts)) consults the **Memory Bank**.

`predictClassification(meta)` runs a two-pass heuristic — arXiv category prefixes mapped to GENESIS classifications first (`cs.LG` → `neural_network`, `physics.flu-dyn` → `physics_engine`, `q-bio.*` → `simulation`, `math.OC` → `optimization`, ...), then a keyword sniff on title + abstract as fallback. The output is one of the eight GENESIS classifications, or `null`.

`findExemplars(predicted, 2)` looks up up to two past successful extractions in the same classification. If the bank is cold or no category match exists, it returns the most-recent two regardless of category — even an off-category exemplar still anchors kernel shape, parameter discipline, and coding style.

Each exemplar's kernel excerpt (capped at 2400 chars) is rendered into a clearly-delimited prompt block — verbatim "STRUCTURAL anchor only, do NOT copy the algorithm itself" framing — and prepended to the system prompt as a **second** content block tagged `cache_control: { type: "ephemeral" }`. Anthropic's prompt cache then hits on the prefix for back-to-back requests in the same category, amortizing the ~2400-char exemplar plus the base system prompt at ~10% of normal input cost.

### Phase 3 · Opus 4.7 Streamed Extraction

The simple route uses `client.messages.stream()` directly with `output_config.format.type = "json_schema"` constrained against `PAPER_DNA_SCHEMA`. The agent route uses Anthropic's **Managed Agents** API with custom tools (`fetch_arxiv_paper`, `report_progress`, `submit_paper_dna`) so the model orchestrates its own four-phase workflow. Both paths emit identical SSE events that the client multiplexes onto a single timeline UI:

| Event | Payload | Purpose |
|---|---|---|
| `status` | `{phase, message, ...}` | Drives the holographic ring + agent blurb |
| `step_start` / `step_complete` | `{step}` | Drives the progress timeline |
| `tool_call` / `tool_result` | `{name, input, output}` | Drives the live tool-call feed |
| `delta` | `{text}` | Streams partial JSON for the kernel viewer |
| `done` | `{paperDna, usage}` | Final structured output + token-cost telemetry |
| `error` | `{message}` | Always surfaced in the UI |

The whole stream is parsed with a 12-line `\n\n`-delimited SSE parser that's identical across all eight streaming routes. There is no shared parser library — the duplication is intentional, each route owns its own protocol assertions.

### Phase 4 · Kernel Re-streaming

After the structured DNA arrives, the client immediately fires [`/api/agent/kernel-stream`](src/app/api/agent/kernel-stream/route.ts) which asks Opus to re-emit the same kernel verbatim with brief inline comments explaining key constants, edge cases, and parameter mappings. This is a pure cosmetic phase — it doesn't change behavior — but it lets the user watch the working code being typed into the panel like a TV hacker scene. If this phase fails for any reason, the UI degrades gracefully: the live stage still mounts with the original (uncommented) kernel.

### Phase 5 · Sandpack Mount

The `<SandpackExecutor paperDna={...}>` component (in [`src/components/SandpackExecutor.tsx`](src/components/SandpackExecutor.tsx)) constructs an in-memory file tree that includes one of five harness templates (one per `visualization_type`) plus the kernel as a separate ES module. Sandpack's bundler — running cross-origin on its own service — compiles and serves the preview into a sandboxed iframe.

---

## The Sandpack Sandbox

Running AI-generated JavaScript safely is non-negotiable. The defense in depth:

1. **Cross-origin iframe.** Sandpack's preview iframe is served from `*.sandpack-static-server.codesandbox.io`, not from our origin. Even if a hostile kernel called `parent.postMessage`, the parent ignores any message that doesn't come from a Sandpack origin.
2. **No same-origin storage access.** The iframe cannot read the parent's `localStorage`, `sessionStorage`, `IndexedDB`, or cookies because it's not same-origin.
3. **No network egress beyond what CORS allows.** A kernel that tries to `fetch('http://attacker.com')` is blocked by CORS — the iframe origin has no CORS allowance for arbitrary external domains.
4. **Server-side has zero `eval`.** No GENESIS API route ever calls `eval`, `new Function`, `setTimeout(string, ...)`, or `import()` on a user-supplied string. Server-side code paths only ever pass kernel strings through to Sandpack-rendered iframes — they're never executed in the Node runtime.
5. **Bounded resource usage.** Every kernel template enforces hard caps (max 5000 iterations, max ~150k chars of body text in the prompt, max 360 tokens per debate turn). A kernel that tries to allocate a 1GB Float32Array crashes the iframe, not the host.
6. **Self-heal contains, not excludes, errors.** Runtime errors raised inside the iframe are caught by Sandpack's error boundary, surfaced via `onStatusChange`, and (optionally) sent to `/api/heal` for repair. They never propagate to the host page.

---

## The Self-Healing Loop

When a kernel runs but throws — or returns the wrong shape, or produces NaNs — the user shouldn't have to retry. The self-healing loop fixes it.

```
Sandpack runtime error
        │
        ▼
SandpackExecutor.onStatusChange("error", {message, stack})
        │
        ▼
POST /api/heal  { kernel, error }
        │
        ▼
Opus 4.7 receives the kernel + error message + paper context
        │
        ▼
Returns a repaired kernel (same export shape, fixed bug)
        │
        ▼
SandpackExecutor swaps the file in-place · iframe reloads
        │
        ▼
healCount++  (badge shown in toolbar: "self-healed ×3")
```

The loop is bounded at three retries. After that, the UI surfaces a graceful error state with a "Try a different paper" affordance — never a white-screen crash. Most kernels heal in one round; the most common bug class is undeclared parameters being read inside the kernel (Opus generated a kernel that uses `params.xyz` but didn't list `xyz` in the parameters spec) and Opus reliably fixes those when shown the runtime error.

---

## Native Features

### 1. Core Extraction

**What it does:** Single paper URL → runnable JavaScript simulation.

**How it works:**
- [`/api/extract/route.ts`](src/app/api/extract/route.ts) — direct path. Uses `messages.stream()` with JSON schema and the Memory Bank's prompt-cache breakpoints.
- [`/api/agent/extract/route.ts`](src/app/api/agent/extract/route.ts) — Managed-Agents path. The model orchestrates fetching → parsing → extracting → generating via four custom tools, emitting `step_start` / `tool_call` events at each phase boundary.
- Both paths cache successful DNAs by canonical URL key in [`src/app/api/_lib/dnaCache.ts`](src/app/api/_lib/dnaCache.ts) — a two-tier in-memory + filesystem store under `.next/cache/genesis-dna/`. Re-submitting the same URL hits the cache and replays the DNA instantly.

**Output shape:**

```ts
type PaperDna = {
  title: string;
  classification:
    | "simulation" | "optimization" | "statistical_model" | "neural_network"
    | "physics_engine" | "economic_model" | "mathematical_proof" | "data_visualization";
  core_algorithm: string;        // 2-4 sentence prose
  equations: string[];           // 3-8 LaTeX strings
  parameters: PaperDnaParameter[];
  visualization_type:
    | "3d_particles" | "2d_chart" | "interactive_graph"
    | "canvas_physics" | "math_explorer" | "data_dashboard";
  code_kernel: string;           // self-contained ES module
};
```

The `visualization_type` drives which Sandpack harness template gets paired with the kernel — that's how a kernel that returns `Array<{x, y}>` knows to render as a Recharts line chart, while one that mutates a `Float32Array` knows to render in a Three.js point cloud.

---

### 2. GENESIS Multiverse

**What it does:** Two or three papers → one unified comparable visualization.

**How it works:** Each paper goes through Core Extraction in parallel (`runExtractionLane` — Promise.allSettled across three abort controllers). The resulting DNAs are POSTed to [`/api/agent/multiverse/synthesize`](src/app/api/agent/multiverse/synthesize/route.ts), where Opus produces a `MultiverseDna` (`PaperDna` + `lineage[]` + `synthesis_strategy` + `dominant_axis`). The synthesis kernel runs all source algorithms simultaneously per call, returning rows like `[{ x: 0, adam: 1.0, sgd: 1.0, rmsprop: 1.0 }, ...]` so they overlay on a single chart with one slider per shared parameter.

When `isMultiverseDna(paperDna)` is true at the live stage, [`<PaperLineageStrip>`](src/app/_components/PaperLineageStrip.tsx) renders above the dashboard with one card per source paper — color-coded dot, classification, title, URL link.

---

### 3. GENESIS Frontier

**What it does:** Plain-English research problem → top-N papers auto-discovered → hybrid kernel.

**How it works:** [`/api/agent/frontier/route.ts`](src/app/api/agent/frontier/route.ts) is a three-phase SSE route:

```
Phase 1 (searching)     ─ arXiv search API + OpenAlex search API in parallel
                           score-merge, dedupe by arXiv id / DOI / fuzzy title
                           top N (3-5) ranked by combined relevance
Phase 2 (reading)       ─ for each hit: fetchPaperMetadata() → full body when available
                           per-paper events stream so the UI shows each title
                           lighting up from "queued" → "reading" → "fetched / abstract-only"
Phase 3 (synthesizing)  ─ Opus 4.7 streams a hybrid PaperDna constrained against
                           FRONTIER_SYNTHESIS_SCHEMA — same shape as PaperDna plus
                           {research_problem, synthesis_summary, frontier_sources[]}
```

The system prompt includes an explicit **honesty contract**: "if the source set is too thin to produce a credible synthesis, you may emit a kernel based on the SINGLE strongest source rather than fabricate cross-paper fusion."

When `isFrontierDna(paperDna)` is true, [`<FrontierSourcesStrip>`](src/app/_components/FrontierSourcesStrip.tsx) renders the source list with each paper's per-source `relevance_note` (1-line Opus-generated explanation of what that paper contributed to the synthesis), arXiv/OpenAlex origin badges, and direct links to the originals.

---

### 4. The Canon — Pre-computed Legends

**What it does:** Twelve seminal papers pre-extracted, instantly loadable, zero-second time-to-visualization.

**How it works:** [`src/data/canonData.json`](src/data/canonData.json) ships 12 entries spanning physics, biology, ML, mathematics, and chemistry — Lorenz Attractor (1963), Conway's Game of Life (1970), Hodgkin-Huxley Neuron (1952), Adam Optimizer (2014), Velocity-Verlet Integration (1967), Gray-Scott Reaction-Diffusion (Turing 1952), Hopfield Networks (1982), Logistic Map (May 1976), Diffusion-Limited Aggregation (Witten-Sander 1981), Genetic Algorithms (Holland 1975), Newton-Raphson, Fourier Series.

Each entry has a complete pre-computed `PaperDna` — the kernel is hand-written, deterministic, bounded (max 5000 iterations), uses pure JavaScript, and runs in any of the existing Sandpack templates. Click a card → `setPaperDna(entry.dna)` + `setStage("live")` → mounted instantly. No API call. No extracting stage. No streaming-kernel stage.

The carousel ([`<CanonCarousel>`](src/app/_components/CanonCarousel.tsx)) is a Netflix-style horizontal scroll strip with edge-fade overlays, paddle controls on desktop, snap-x scrolling, and per-category color-glow on hover (Physics → blue, Biology → emerald, ML → violet, Math → amber, Chemistry → pink).

---

### 5. Agentic Audit

**What it does:** Reproducibility check — extracts numerical claims from the abstract/body, generates a JS test harness, runs it against the live kernel, reports pass/fail with provenance.

**How it works:** [`/api/agent/audit/route.ts`](src/app/api/agent/audit/route.ts) runs in two phases:

1. **Claims extraction.** Opus reads the paper text (full body when available) and returns up to 5 `AuditClaim`s — `{statement, expected_value, expected_unit, tolerance, tolerance_kind, test_method}` — only intrinsic claims that can be verified by running the kernel deterministically. Examples of accepted claims: "Converges at rate O(1/k²)" → `expected_value: 2, unit: "negative-log-slope"`. Examples of rejected claims: "Achieves 92.3% accuracy on MNIST" (needs external data).

2. **Harness streaming.** Opus generates a JS module exporting `runAudit(kernel)` that imports the kernel, runs the test methodology for each claim, and returns `Array<{claim_id, actual_value, passed, notes}>`. Strict security rules in the system prompt: no network, no DOM, no `eval`, no dynamic code, all loops cap at 100k iterations, all numeric results are plain JS numbers.

The harness streams to the [`<ReproducibilityCertificate>`](src/app/_components/ReproducibilityCertificate.tsx) modal, which then runs it client-side in a worker against the user's currently-mounted kernel. Results are color-coded green / amber / red.

---

### 6. GENESIS Debate

**What it does:** Two Opus 4.7 agents — Attacker (devil's advocate) and Defender (evidence-citing reviewer) — argue the paper's methodology in real time across three rounds.

**How it works:** [`/api/agent/debate/route.ts`](src/app/api/agent/debate/route.ts) runs sequential turn-taking — six total turns over three rounds — with a single shared transcript. Each turn opens its own `client.messages.stream()` call (max 360 tokens, ~140 words) so the user sees each agent typing live in the [`<GenesisDebate>`](src/app/_components/GenesisDebate.tsx) cinematic split-screen console.

The system prompts include a shared **FAIRNESS_CONTRACT** that supersedes either persona:

> Truth supersedes role. If the paper is genuinely sound under the evidence available, you MUST say so plainly. If a candidate objection evaporates under scrutiny, drop it. Producing a fair, accurate turn is more valuable than producing a "brutal" or "decisive" one.

Concretely: the Attacker is forbidden from fabricating flaws. The Defender is forbidden from manufacturing defenses for flaws that genuinely exist. Both must ground every claim in a specific cited artifact — equation number, kernel line, parameter range — and the per-turn directives explicitly permit graceful concession when the evidence runs the other way.

When the route receives a `url` field in the request body, it pre-fetches `fetchPaperMetadata(url)` and injects the full paper body (capped at 50k chars per turn) into the agent context. With body, the agents argue about real methodology. Without it, they argue from the DNA + abstract alone — which the FAIRNESS_CONTRACT instructs them to acknowledge by hedging confidence to the regime tested.

The split-screen UI: Attacker on left (rose theme, Skull icon), Defender on right (cyan theme, Shield icon), VS pill on a vertical gradient rail in the center. Each column shows the agent's status as a pill (`TRANSMITTING` / `STANDBY` / `OFFLINE`) with a pulsing color-glow ring on the active speaker's avatar. A blinking cursor at the end of the currently-streaming turn. Auto-scroll. AbortController on close.

---

### 7. Autonomous Discovery

**What it does:** Sweeps the parameter space, finds regimes the original authors never reported (phase transitions, instabilities, sensitive boundaries).

**How it works:** [`/api/agent/discover/route.ts`](src/app/api/agent/discover/route.ts) runs an agentic tool-use loop where Opus has two tools: `run_kernel(params)` and `submit_discoveries(findings[])`. The model proposes candidate parameter combinations, the server-side tool harness runs the kernel against each, and Opus iteratively refines its hypothesis until it finds something genuinely surprising — then submits it.

The result is a list of discoveries each with `{title, description, params}` that the user can apply with one click via [`<DiscoveriesSidebar>`](src/app/_components/DiscoveriesSidebar.tsx). Clicking a discovery sets `paramOverride` in the GenesisPipeline state, which `<SandpackExecutor>` consumes and pushes into the iframe via `postMessage`. The visualization morphs in place to match the discovered regime.

---

### 8. GENESIS Memory (Persistent Cross-run Learning)

**What it does:** The system gets measurably better with use. Every successful extraction becomes a few-shot exemplar for the next one in the same scientific category, with Anthropic prompt-caching cutting input cost by ~90% on cache hits.

**How it works:** [`src/app/api/_lib/memoryBank.ts`](src/app/api/_lib/memoryBank.ts) is a file-backed JSON store at `.next/cache/genesis-memory/memory_bank.json`, capped at 100 entries with LRU eviction. Each entry is lightweight:

```ts
type MemoryEntry = {
  slug: string;                    // sha256 of paper identifier
  title: string;
  classification: string;          // primary lookup key
  visualization_type: string;
  parameters_count: number;
  equations_count: number;
  kernel_excerpt: string;          // first 2400 chars of the kernel
  kernel_length: number;
  core_algorithm_brief: string;
  capturedAt: number;
  source: "extract" | "agent-extract";
};
```

Concurrent writes are serialized via a Promise chain (`writeChain`) so simultaneous extractions never corrupt the file. Filesystem failures degrade gracefully — if the file is locked, missing, or malformed, the bank silently returns an empty list and extraction proceeds without anchoring.

**The retrieval loop, on each new extraction:**

```
1. fetchPaperMetadata(url)
   → paperMeta (with arXiv categories where available)
2. predictClassification(paperMeta)
   → "neural_network" | "simulation" | ... | null
3. findExemplars(predicted, 2)
   → up to 2 most-recent entries in matching classification
   → falls back to most-recent overall if no category match
4. formatExemplarBlock(entries)
   → wrapped delimited prompt block, "STRUCTURAL anchor only" framing
5. Construct system prompt as a TextBlockParam array:
     [
       { type: "text", text: BASE_SYSTEM_PROMPT,
         cache_control: { type: "ephemeral" } },
       { type: "text", text: exemplarBlock,
         cache_control: { type: "ephemeral" } },
     ]
```

Two cache breakpoints. The first is identical across every request (always cache-hit after the first call). The second varies by classification — back-to-back submissions in the same category hit the second cache too. Anthropic returns `cache_read_input_tokens` in the response usage block; the route forwards it to the UI so the user can see prompt-cache hits accumulating in real time.

**The write side, after each successful DNA:**

```
recordSuccess(buildEntryFromDna(url, dna, source))
  ├── readMemory()                    load current entries
  ├── upsert by slug                  (deduplicate by paper identifier)
  ├── sort by capturedAt desc          (newest first)
  ├── while length > 100: pop()        (LRU evict oldest)
  └── writeDisk()                     fsync to memory_bank.json
```

The agent-extract route can't update the agent's pre-baked system prompt per-request (Managed Agents API), so it injects the exemplar block into the **first user message** instead — same few-shot effect, just at the message level rather than the system level. The route still fires an SSE `status` event tagged `phase: "memory"` so the UI shows "GENESIS Memory · 2 exemplars loaded for neural_network" exactly as the simple route does.

The most-cited critique of this design is that off-category exemplars might mislead Opus. In practice they don't — even an unrelated kernel teaches export shape, parameter discipline, and coding style, which is the bulk of what early-cold-cache extractions get wrong. As the bank fills, category match rate climbs and the structural-anchor-only quality of the exemplars becomes a class-specific reference.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Streaming SSE on Node runtime, modern routing, edge-aware |
| UI | React 19 + Framer Motion 12 + Tailwind CSS v4 | Animations need a real motion library; Tailwind v4's `@theme inline` keeps tokens in CSS |
| Sandbox | Sandpack (CodeSandbox) | Cross-origin iframe execution is the only safe way to run AI-generated JS |
| AI | Anthropic Claude Opus 4.7 (1M context) | The only model that reliably produces runnable kernels under JSON schema constraints |
| SSE protocol | Hand-rolled `\n\n`-delimited parser | No dep needed; pattern is identical across all 8 streaming routes |
| Math rendering | KaTeX (strict mode, trust:false) | LaTeX equations render fast, no XSS surface |
| Icons | lucide-react | Tree-shakable, consistent stroke weight, good coverage |
| Fonts | Geist Sans + Geist Mono (Vercel) | Free, modern, monospaced variant for the cinematic terminal look |
| Cache | Filesystem under `.next/cache/` | Survives server restarts, transparent to debug |
| External APIs | arXiv, OpenAlex, NCBI E-utilities | All open, well-documented, no auth required |

---

## Project Structure

```
genesis/
├── src/
│   ├── app/
│   │   ├── _components/                 # Client components (UI only)
│   │   │   ├── Hero.tsx                 # Landing hero (badge, title, subtitle)
│   │   │   ├── HeroAmbientGlow.tsx      # Cinematic light layers (fixed full-bleed)
│   │   │   ├── InputBox.tsx             # URL input glass-pill
│   │   │   ├── BackgroundOrbs.tsx       # Drifting ambient orbs
│   │   │   ├── GenesisPipeline.tsx      # Stage state machine (idle → extracting → live)
│   │   │   ├── ExampleCards.tsx         # 5 curated demo cards
│   │   │   ├── CanonCarousel.tsx        # Netflix-style strip of 12 legends
│   │   │   ├── MultiverseInput.tsx      # 2-3 paper URL list input
│   │   │   ├── MultiverseProgress.tsx   # Parallel extraction lanes
│   │   │   ├── PaperLineageStrip.tsx    # "Multiverse · 3 papers" header
│   │   │   ├── FrontierInput.tsx        # Natural-language query textarea
│   │   │   ├── FrontierProgress.tsx     # 3-phase searching/reading/synthesizing UI
│   │   │   ├── FrontierSourcesStrip.tsx # "Frontier · 5 sources" header
│   │   │   ├── GenesisDebate.tsx        # Cinematic split-screen debate console
│   │   │   ├── ReproducibilityCertificate.tsx  # Audit modal
│   │   │   ├── DiscoveriesSidebar.tsx   # Discovery results drawer
│   │   │   ├── HistorySidebar.tsx       # Past extractions
│   │   │   ├── HolographicRing.tsx      # Animated extraction ring
│   │   │   ├── AgentProgressTimeline.tsx
│   │   │   ├── ToolCallFeed.tsx
│   │   │   ├── PaperDnaCard.tsx         # Left sidebar at live stage
│   │   │   ├── ExportButton.tsx         # Download as static HTML
│   │   │   ├── ShareButton.tsx          # Encode DNA into shareable URL
│   │   │   ├── AppLogo.tsx              # Top-left brand mark
│   │   │   ├── LandingFeaturesGrid.tsx  # 5-card features showcase
│   │   │   ├── LandingFeedback.tsx      # Email waitlist mock
│   │   │   ├── LandingFooter.tsx        # Copyright + links
│   │   │   └── LegalPageShell.tsx       # Shared chrome for /privacy and /terms
│   │   ├── _data/
│   │   │   └── examples.ts              # Curated 5-demo metadata
│   │   ├── _lib/
│   │   │   ├── history.ts               # Local history persistence
│   │   │   └── share.ts                 # DNA-in-URL share encoding
│   │   ├── api/
│   │   │   ├── _lib/
│   │   │   │   ├── dnaCache.ts          # URL-keyed DNA cache
│   │   │   │   └── memoryBank.ts        # Cross-run few-shot store
│   │   │   ├── agent/
│   │   │   │   ├── _helpers.ts          # Paper fetchers + SSE helpers
│   │   │   │   ├── extract/route.ts     # Managed-agents extraction
│   │   │   │   ├── audit/route.ts       # Reproducibility claims + harness
│   │   │   │   ├── debate/route.ts      # Attacker vs Defender
│   │   │   │   ├── discover/route.ts    # Parameter-space sweep
│   │   │   │   ├── frontier/route.ts    # NL-query → top-N synthesis
│   │   │   │   ├── kernel-stream/route.ts  # Cinematic re-stream w/ comments
│   │   │   │   └── multiverse/synthesize/route.ts
│   │   │   ├── extract/route.ts         # Direct (non-agent) extraction
│   │   │   ├── heal/route.ts            # Self-heal kernel runtime errors
│   │   │   └── export/[vizType]/route.ts  # Bundle to static HTML
│   │   ├── privacy/page.tsx             # Privacy Policy
│   │   ├── terms/page.tsx               # Terms of Service
│   │   ├── globals.css                  # Tailwind v4 @theme tokens + keyframes
│   │   ├── layout.tsx                   # Root layout, fonts, metadata
│   │   └── page.tsx                     # Home (mounts GenesisPipeline)
│   ├── components/
│   │   └── SandpackExecutor.tsx         # Sandpack mount + harness templates
│   ├── data/
│   │   ├── canon.ts                     # Canon types + category tokens
│   │   └── canonData.json               # 12 pre-computed legendary papers
│   └── types/
│       ├── paperDna.ts                  # Core DNA type
│       ├── multiverse.ts                # MultiverseDna + isMultiverseDna
│       ├── frontier.ts                  # FrontierDna + isFrontierDna
│       └── audit.ts                     # AuditClaim + JSON schema
├── public/
└── package.json
```

---

## Running Locally

**Prerequisites:**
- Node.js 20+
- `pnpm` (recommended) or `npm`
- An Anthropic API key with access to Claude Opus 4.7

```bash
# 1. Install dependencies
pnpm install

# 2. Set up env
cp .env.local.example .env.local
# Edit .env.local and add ANTHROPIC_API_KEY=sk-ant-...

# 3. Run dev
pnpm dev
# → http://localhost:3000

# 4. (Optional) Production build
pnpm build
pnpm start
```

The first paper extraction will take ~60 seconds. Subsequent extractions of the same URL return from cache instantly. Submissions in the same scientific category benefit from the Memory Bank's few-shot anchoring + Anthropic's prompt cache (5-minute ephemeral TTL) — expect 30-40% faster generation on warm caches.

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | Claude Opus 4.7 API access |
| `GENESIS_ENV_ID` | No | Pin a long-lived Anthropic Managed-Agents environment ID across server restarts (otherwise a fresh environment is created on first agent call) |

There are no `NEXT_PUBLIC_*` API keys. By design.

---

## Security Posture

- **Server-side secret isolation.** All API keys are read from `process.env` exclusively in server route handlers (everything under `src/app/api/`). Zero client-component leakage. Verified via grep audit.
- **SSRF guard.** `rejectPrivateHosts()` blocks user-submitted URLs targeting loopback, RFC1918 private ranges, link-local (covers AWS instance metadata at `169.254.169.254`), CGNAT, multicast, and IPv6 unique-local + link-local before any generic-paper fetch.
- **Fetch timeouts.** Every external API call has an explicit `AbortSignal.timeout` — 15s for HTML scrapes and arXiv HTML, 12s for arXiv/OpenAlex search, 10s for OpenAlex DOI lookup. A slow upstream cannot hold a route worker for the full `maxDuration`.
- **Cross-origin sandbox.** AI-generated JavaScript runs only inside Sandpack's cross-origin preview iframe, not in any same-origin context. No `eval`, no `new Function`, no `import()` of user input on the server side.
- **Bounded resource caps.** Kernel iterations capped at 5000 (or 100k for audit harnesses), prompt body capped at 150k chars (arXiv/PMC) or 80k (generic), debate turns capped at 360 tokens, search results capped at N=5, memory bank capped at 100 entries.
- **Graceful error states.** Every streaming route emits structured `error` SSE events that the client surfaces in the UI. The self-heal loop is bounded at 3 retries before showing a friendly fallback. There is no white-screen crash path.

---

## Roadmap

Plausible next steps, ranked by leverage:

- **Server-side memory pre-warming.** Cache the most-recent N exemplars in Anthropic's prompt cache via a periodic warming job, so cold-start latency for new sessions disappears.
- **Persistent multi-tenant memory.** Move the memory bank from filesystem to a real KV store (Redis, Cloudflare KV) so memory persists across deploys and scales horizontally.
- **Audit harness containment.** Run the audit harness in a Web Worker (already isolated) plus a CSP-strict iframe (additional defense in depth) for further hardening.
- **Citation graph.** When a paper cites another that's already in memory, surface the chain visually and pre-load the cited paper's DNA as additional context for synthesis.
- **Replay mode.** Save the full SSE event stream of an extraction and let users scrub back through the agent reasoning. Excellent for teaching how the system works.
- **Browser extension.** A right-click → "Open in GENESIS" on any arXiv/PMC/Nature page. Minimal extension, maximum reach.

---

## License & Acknowledgments

Built by Danyar Group for the Anthropic "Built with Opus 4.7" hackathon. Source code is provided as-is; see [Terms of Service](/terms) and [Privacy Policy](/privacy) for details on the deployed service.

**Standing on the shoulders of:**
- Anthropic — Claude Opus 4.7, the Managed Agents beta, prompt caching
- Vercel — Next.js 16, Geist
- CodeSandbox — Sandpack
- arXiv, OpenAlex, NCBI — open scientific infrastructure that made every paper-fetching path possible
- The original authors of every paper this system has read or will read. The Canon entries name them explicitly. The Multiverse and Frontier paths cite them. We extract algorithms; the science is theirs.

---

<div align="center">

**GENESIS** &nbsp;·&nbsp; Built with Claude Opus 4.7 &nbsp;·&nbsp; © 2026 Danyar Group

</div>
