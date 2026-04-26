/**
 * GENESIS Memory Bank — persistent cross-run learning store.
 *
 * Every successful Paper DNA extraction writes a lightweight summary here
 * (classification, kernel signature, an excerpt of the working kernel). On
 * a new submission, the extract route reads back exemplars matching the
 * predicted scientific category and injects them into the Opus 4.7 prompt
 * as few-shot anchors, with Anthropic prompt-cache markers so the exemplar
 * prefix is amortized across calls in the same category.
 *
 * Storage strategy mirrors `dnaCache.ts`:
 *   - in-memory cache (fast hot path, lost on cold start)
 *   - filesystem JSON in .next/cache/genesis-memory/memory_bank.json
 *
 * Capacity is capped (LRU on capturedAt) to keep prompt cost bounded and to
 * keep the file readable in a text editor for debugging.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PaperMeta } from "../agent/_helpers";

export type MemoryEntry = {
  /** Stable id derived from the paper's identifying URL/ID. */
  slug: string;
  /** Paper title — for human-readable logging only. */
  title: string;
  /** GENESIS classification (matches PAPER_DNA_SCHEMA enum). Primary lookup key. */
  classification: string;
  /** Kernel visualization type (e.g. "2d_chart"). */
  visualization_type: string;
  /** Number of parameters in the DNA. */
  parameters_count: number;
  /** Number of equations in the DNA. */
  equations_count: number;
  /** First N chars of the kernel — enough to anchor structure without
   * inflating context. Intentionally NOT the full kernel. */
  kernel_excerpt: string;
  /** Total kernel length so we can flag truncation in prompts. */
  kernel_length: number;
  /** Brief one-liner derived from core_algorithm — kept short for prompts. */
  core_algorithm_brief: string;
  /** Unix ms timestamp — used for LRU and "freshness" sorting. */
  capturedAt: number;
  /** Where this entry came from — "extract" (simple route) or "agent-extract"
   * (managed-agents route). Lets us prefer richer entries when multiple match. */
  source: "extract" | "agent-extract";
};

type MemoryFile = {
  version: number;
  entries: MemoryEntry[];
};

const FILE_VERSION = 1;
const ENTRY_CAP = 100;
const KERNEL_EXCERPT_CHARS = 2400;
const ALGORITHM_BRIEF_CHARS = 280;

const memoryDir = path.join(
  process.cwd(),
  ".next",
  "cache",
  "genesis-memory",
);
const memoryFile = path.join(memoryDir, "memory_bank.json");

/** In-memory mirror to avoid disk reads on every call within a hot server. */
let cache: MemoryEntry[] | null = null;
let writeChain: Promise<void> = Promise.resolve();

/* -------------------------------------------------------------------------- */
/*                                IO HELPERS                                  */
/* -------------------------------------------------------------------------- */

async function readDisk(): Promise<MemoryEntry[]> {
  try {
    const raw = await readFile(memoryFile, "utf-8");
    const parsed = JSON.parse(raw) as Partial<MemoryFile>;
    if (parsed && Array.isArray(parsed.entries)) {
      return parsed.entries.filter(isValidEntry);
    }
    return [];
  } catch {
    return [];
  }
}

async function writeDisk(entries: MemoryEntry[]): Promise<void> {
  try {
    await mkdir(memoryDir, { recursive: true });
    const file: MemoryFile = { version: FILE_VERSION, entries };
    await writeFile(memoryFile, JSON.stringify(file), "utf-8");
  } catch (err) {
    console.warn("[GENESIS] memoryBank writeDisk failed:", err);
  }
}

function isValidEntry(e: unknown): e is MemoryEntry {
  if (!e || typeof e !== "object") return false;
  const x = e as Record<string, unknown>;
  return (
    typeof x.slug === "string" &&
    typeof x.title === "string" &&
    typeof x.classification === "string" &&
    typeof x.visualization_type === "string" &&
    typeof x.parameters_count === "number" &&
    typeof x.equations_count === "number" &&
    typeof x.kernel_excerpt === "string" &&
    typeof x.kernel_length === "number" &&
    typeof x.core_algorithm_brief === "string" &&
    typeof x.capturedAt === "number" &&
    (x.source === "extract" || x.source === "agent-extract")
  );
}

async function loadAll(): Promise<MemoryEntry[]> {
  if (cache) return cache;
  cache = await readDisk();
  return cache;
}

/* -------------------------------------------------------------------------- */
/*                              PUBLIC API                                    */
/* -------------------------------------------------------------------------- */

export async function readMemory(): Promise<MemoryEntry[]> {
  return loadAll();
}

/** Hash the paper identifier (URL or arXiv id) into a stable slug. */
export function slugForPaper(paperIdentifier: string): string {
  const canon = paperIdentifier.trim().toLowerCase();
  return createHash("sha256").update(canon).digest("hex").slice(0, 16);
}

/**
 * Insert or update an entry. Capacity is capped at ENTRY_CAP — when the file
 * exceeds the cap, the oldest entry by capturedAt is evicted.
 *
 * Concurrent calls are serialized via writeChain so simultaneous extractions
 * don't corrupt the file.
 */
export function recordSuccess(
  entryWithoutTimestamp: Omit<MemoryEntry, "capturedAt">,
): Promise<void> {
  const next = writeChain.then(async () => {
    const entries = await loadAll();
    const incoming: MemoryEntry = {
      ...entryWithoutTimestamp,
      capturedAt: Date.now(),
    };

    const existingIdx = entries.findIndex((e) => e.slug === incoming.slug);
    if (existingIdx >= 0) {
      entries[existingIdx] = incoming;
    } else {
      entries.push(incoming);
    }

    // Sort newest-first for natural LRU eviction at the tail.
    entries.sort((a, b) => b.capturedAt - a.capturedAt);
    while (entries.length > ENTRY_CAP) entries.pop();

    cache = entries;
    await writeDisk(entries);
  });
  // Replace the chain unconditionally so subsequent writes wait for this.
  writeChain = next.catch((err) => {
    console.warn("[GENESIS] memoryBank record chain error:", err);
  });
  return next;
}

/**
 * Build a MemoryEntry directly from a freshly extracted DNA + URL. Centralizes
 * the truncation / shape logic so call sites don't have to repeat it.
 */
export function buildEntryFromDna(
  paperIdentifier: string,
  dna: {
    title: string;
    classification: string;
    visualization_type: string;
    parameters: unknown[];
    equations: unknown[];
    code_kernel: string;
    core_algorithm: string;
  },
  source: MemoryEntry["source"],
): Omit<MemoryEntry, "capturedAt"> {
  const kernel = dna.code_kernel;
  const excerpt =
    kernel.length > KERNEL_EXCERPT_CHARS
      ? kernel.slice(0, KERNEL_EXCERPT_CHARS) + "\n// … (truncated)"
      : kernel;
  const brief =
    dna.core_algorithm.length > ALGORITHM_BRIEF_CHARS
      ? dna.core_algorithm.slice(0, ALGORITHM_BRIEF_CHARS).trimEnd() + "…"
      : dna.core_algorithm;
  return {
    slug: slugForPaper(paperIdentifier),
    title: dna.title.slice(0, 200),
    classification: dna.classification,
    visualization_type: dna.visualization_type,
    parameters_count: dna.parameters.length,
    equations_count: dna.equations.length,
    kernel_excerpt: excerpt,
    kernel_length: kernel.length,
    core_algorithm_brief: brief,
    source,
  };
}

/**
 * Find up to `limit` exemplars suitable for few-shot anchoring on the new
 * paper's predicted classification. Falls back to most-recent overall when
 * no category match exists — even an off-category exemplar is useful for
 * teaching Opus the kernel-shape pattern.
 */
export async function findExemplars(
  predictedClassification: string | null,
  limit = 2,
): Promise<MemoryEntry[]> {
  const all = await loadAll();
  if (all.length === 0) return [];

  if (predictedClassification) {
    const matches = all
      .filter((e) => e.classification === predictedClassification)
      .slice(0, limit);
    if (matches.length > 0) return matches;
  }

  // No category match — return most recent N as a generic structural anchor.
  return all.slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/*                       CLASSIFICATION PREDICTOR                             */
/* -------------------------------------------------------------------------- */

/** Map a known arXiv category prefix to a GENESIS classification. */
const ARXIV_PREFIX_TO_CLASSIFICATION: Array<[RegExp, string]> = [
  [/^cs\.(?:lg|ai|ne|cv|cl|sd)\b/i, "neural_network"],
  [/^stat\.(?:ml)\b/i, "neural_network"],
  [/^math\.(?:oc|na)\b/i, "optimization"],
  [/^math\./i, "mathematical_proof"],
  [/^cs\.(?:ds|cc|dm|lo)\b/i, "mathematical_proof"],
  [/^stat\.(?:ap|me|co)\b/i, "statistical_model"],
  [/^q-fin\./i, "economic_model"],
  [/^econ\./i, "economic_model"],
  [/^q-bio\./i, "simulation"],
  [/^physics\.(?:flu-dyn|atom-ph|chem-ph|comp-ph)\b/i, "physics_engine"],
  [/^physics\./i, "simulation"],
  [/^nlin\./i, "simulation"],
  [/^cond-mat\./i, "simulation"],
  [/^astro-ph\./i, "simulation"],
  [/^hep-(?:th|ph|ex|lat)\b/i, "simulation"],
  [/^gr-qc\b/i, "simulation"],
];

/** Cheap title/abstract keyword fallback when no arXiv tags are available. */
const KEYWORD_TO_CLASSIFICATION: Array<[RegExp, string]> = [
  [/\b(neural network|deep learning|transformer|attention|lstm|cnn|gnn|reinforcement)\b/i, "neural_network"],
  [/\b(optimi[sz]ation|gradient descent|convex|sgd|adam|stochastic gradient)\b/i, "optimization"],
  [/\b(theorem|lemma|proof|conjecture|axiom)\b/i, "mathematical_proof"],
  [/\b(bayesian|posterior|likelihood|regression|inference|estimat)/i, "statistical_model"],
  [/\b(market|supply|demand|equilibrium|auction|game.theory|monetary)\b/i, "economic_model"],
  [/\b(fluid|navier|particle|molecular|n-body|hamiltonian|symplectic)\b/i, "physics_engine"],
  [/\b(simulat|monte carlo|cellular automaton|reaction.diffusion|chaos|attractor|ode|pde)\b/i, "simulation"],
  [/\b(visuali[sz]ation|chart|dashboard|plot)\b/i, "data_visualization"],
];

/**
 * Predict a GENESIS classification BEFORE Opus actually classifies the paper.
 * Used to look up category-matched exemplars from the memory bank — so the
 * prediction need only be approximate, not authoritative.
 */
export function predictClassification(meta: PaperMeta): string | null {
  // Pass 1: arXiv tag mapping (most reliable when available).
  for (const cat of meta.categories) {
    for (const [re, cls] of ARXIV_PREFIX_TO_CLASSIFICATION) {
      if (re.test(cat)) return cls;
    }
  }
  // Pass 2: keyword sniff on title + abstract.
  const haystack = `${meta.title} ${meta.abstract}`.slice(0, 4000);
  for (const [re, cls] of KEYWORD_TO_CLASSIFICATION) {
    if (re.test(haystack)) return cls;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*                          PROMPT FORMATTERS                                 */
/* -------------------------------------------------------------------------- */

/**
 * Render exemplars as a single text block ready to drop into a system prompt.
 * Wrapped in a delimiter so Opus understands "this is a structural reference,
 * not source material to copy from."
 */
export function formatExemplarBlock(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";
  const blocks = entries
    .map((e, i) => {
      const ageDays = Math.max(
        0,
        Math.floor((Date.now() - e.capturedAt) / 86_400_000),
      );
      return [
        `--- EXEMPLAR ${i + 1} (${ageDays}d ago) ---`,
        `Past paper title: ${e.title}`,
        `Classification: ${e.classification}`,
        `Visualization type: ${e.visualization_type}`,
        `Algorithm summary: ${e.core_algorithm_brief}`,
        `Working kernel structure (${e.kernel_length} chars total, excerpt below):`,
        "```js",
        e.kernel_excerpt,
        "```",
      ].join("\n");
    })
    .join("\n\n");

  return [
    "═══════════════════════════════════════════════════════════════════════",
    "GENESIS MEMORY · few-shot exemplars from prior successful extractions",
    "═══════════════════════════════════════════════════════════════════════",
    "",
    "The following kernels came from PAST papers GENESIS has successfully",
    "processed in this same scientific category. Use them as STRUCTURAL anchors:",
    "  • Mirror the export shape (default function signature, return shape).",
    "  • Mirror the parameter-spec discipline (snake_case, defaults, ranges).",
    "  • Mirror the deterministic, no-I/O, browser-safe coding style.",
    "Do NOT copy the algorithm itself — your output must implement the NEW",
    "paper's algorithm, not the exemplar's. Treat these as a syntax + shape",
    "reference only.",
    "",
    blocks,
    "",
    "═══════════════════ END EXEMPLARS — your task begins below ═══════════════════",
  ].join("\n");
}
