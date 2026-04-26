"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import type { PaperDna } from "@/components/SandpackExecutor";
import { slugify } from "../_lib/slugify";

type Props = {
  paperDna: PaperDna;
};

export function ExportButton({ paperDna }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/export/${encodeURIComponent(paperDna.visualization_type)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(paperDna),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Export failed: HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugify(paperDna.title)}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr((e as Error).message);
      console.error("[ExportButton]", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={err ?? "Download a single self-contained HTML file"}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="h-3 w-3" />
      {busy ? "Exporting…" : "Export HTML"}
    </button>
  );
}

export default ExportButton;
