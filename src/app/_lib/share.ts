import type { PaperDna } from "@/components/SandpackExecutor";

/**
 * Encode a PaperDna as a URL-safe base64 string.
 * Size: ~1.3× the JSON size. A typical DNA runs ~2–4 KB encoded,
 * well inside browser URL limits (~8 KB) for demo sharing.
 */
export function encodeDnaToParam(dna: PaperDna): string {
  const json = JSON.stringify(dna);
  if (typeof window === "undefined") {
    return Buffer.from(json, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeDnaFromParam(param: string): PaperDna | null {
  try {
    const padded = param.replace(/-/g, "+").replace(/_/g, "/");
    const binary =
      typeof window === "undefined"
        ? Buffer.from(padded, "base64").toString("binary")
        : window.atob(padded + "===".slice((padded.length + 3) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json =
      typeof window === "undefined"
        ? Buffer.from(bytes).toString("utf-8")
        : new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.title === "string" &&
      typeof parsed.code_kernel === "string" &&
      typeof parsed.visualization_type === "string"
    ) {
      return parsed as PaperDna;
    }
    return null;
  } catch {
    return null;
  }
}

export type ShareTarget =
  | { kind: "example"; slug: string }
  | { kind: "dna"; dna: PaperDna };

export function buildShareUrl(target: ShareTarget, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : "/");
  const url = new URL(base, "http://localhost");
  url.search = "";
  if (target.kind === "example") {
    url.searchParams.set("example", target.slug);
  } else {
    url.searchParams.set("dna", encodeDnaToParam(target.dna));
  }
  return url.pathname + url.search;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
