"use client";

import katex from "katex";
import { useMemo } from "react";

type Props = {
  latex: string;
  displayMode?: boolean;
  className?: string;
};

export function Equation({ latex, displayMode = true, className }: Props) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        output: "html",
        strict: "ignore",
        trust: false,
      });
    } catch {
      return null;
    }
  }, [latex, displayMode]);

  if (!html) {
    return (
      <pre
        className={`overflow-x-auto font-mono text-[11px] text-zinc-400 ${className ?? ""}`}
      >
        {latex}
      </pre>
    );
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default Equation;
