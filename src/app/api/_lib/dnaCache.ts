import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractArxivId, extractPubmedId } from "../agent/_helpers";

export type CachedDnaMeta = {
  title: string;
  authors: string[];
  categories: string[];
  abstract_length: number;
};

export type CachedDna = {
  paperDna: Record<string, unknown>;
  paperMeta: CachedDnaMeta;
  cachedAt: number;
};

const MEMORY_CAP = 500;
const memCache = new Map<string, CachedDna>();
const cacheDir = path.join(process.cwd(), ".next", "cache", "genesis-dna");

export function canonicalKey(input: string): string {
  const trimmed = input.trim();

  const arxiv = extractArxivId(trimmed);
  if (arxiv) return `arxiv-${arxiv.replace(/[\\/]/g, "_")}`;

  const pubmed = extractPubmedId(trimmed);
  if (pubmed) {
    if (pubmed.db === "pmc") {
      return `pmc-${pubmed.id.replace(/^PMC/i, "")}`;
    }
    return `pubmed-${pubmed.id}`;
  }

  let canon = trimmed.toLowerCase();
  try {
    const u = new URL(trimmed);
    canon = `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}${u.search}`.toLowerCase();
  } catch {
    // not a URL — use trimmed lowercase as-is
  }
  const hash = createHash("sha256").update(canon).digest("hex").slice(0, 16);
  return `url-${hash}`;
}

function fileFor(key: string): string {
  return path.join(cacheDir, `${key}.json`);
}

async function readDisk(key: string): Promise<CachedDna | null> {
  try {
    const raw = await readFile(fileFor(key), "utf-8");
    return JSON.parse(raw) as CachedDna;
  } catch {
    return null;
  }
}

async function writeDisk(key: string, value: CachedDna): Promise<void> {
  try {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(fileFor(key), JSON.stringify(value), "utf-8");
  } catch (err) {
    console.warn(`[GENESIS] dnaCache writeDisk failed for ${key}:`, err);
  }
}

function rememberInMemory(key: string, value: CachedDna): void {
  if (memCache.has(key)) memCache.delete(key);
  memCache.set(key, value);
  while (memCache.size > MEMORY_CAP) {
    const oldest = memCache.keys().next().value;
    if (oldest === undefined) break;
    memCache.delete(oldest);
  }
}

export async function readDna(input: string): Promise<CachedDna | null> {
  const key = canonicalKey(input);
  const hit = memCache.get(key);
  if (hit) return hit;
  const disk = await readDisk(key);
  if (disk) rememberInMemory(key, disk);
  return disk;
}

export async function writeDna(input: string, value: CachedDna): Promise<void> {
  const key = canonicalKey(input);
  rememberInMemory(key, value);
  await writeDisk(key, value);
}
