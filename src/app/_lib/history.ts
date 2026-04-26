import type { PaperDna } from "@/components/SandpackExecutor";

const STORAGE_KEY = "genesis:history:v1";
const MAX_ENTRIES = 12;

export type HistorySource = "example" | "live";

export type HistoryEntry = {
  id: string;
  title: string;
  classification: string;
  visualization_type: string;
  timestamp: number;
  source: HistorySource;
  slug?: string;
  paperDna: PaperDna;
};

function safeRead(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEntry =>
        e &&
        typeof e.id === "string" &&
        typeof e.title === "string" &&
        typeof e.timestamp === "number" &&
        e.paperDna &&
        typeof e.paperDna === "object",
    );
  } catch {
    return [];
  }
}

function safeWrite(entries: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent("genesis:history:changed"));
  } catch {
    // quota exceeded or storage disabled — swallow silently; UX continues.
  }
}

export function getHistory(): HistoryEntry[] {
  return safeRead().sort((a, b) => b.timestamp - a.timestamp);
}

export function addToHistory(
  paperDna: PaperDna,
  opts: { source: HistorySource; slug?: string } = { source: "live" },
): HistoryEntry {
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    title: paperDna.title,
    classification: paperDna.classification,
    visualization_type: paperDna.visualization_type,
    timestamp: Date.now(),
    source: opts.source,
    slug: opts.slug,
    paperDna,
  };

  const existing = safeRead();
  // Dedupe: for examples, keep only the most recent run per slug; for live,
  // only dedupe by exact title match within the last hour.
  const dedupe = existing.filter((e) => {
    if (opts.source === "example" && opts.slug && e.slug === opts.slug) {
      return false;
    }
    if (
      opts.source === "live" &&
      e.source === "live" &&
      e.title === paperDna.title &&
      Date.now() - e.timestamp < 60 * 60 * 1000
    ) {
      return false;
    }
    return true;
  });

  const next = [entry, ...dedupe].slice(0, MAX_ENTRIES);
  safeWrite(next);
  return entry;
}

export function removeFromHistory(id: string): void {
  const next = safeRead().filter((e) => e.id !== id);
  safeWrite(next);
}

export function clearHistory(): void {
  safeWrite([]);
}

export function subscribeToHistory(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("genesis:history:changed", handler);
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) callback();
  });
  return () => {
    window.removeEventListener("genesis:history:changed", handler);
  };
}
