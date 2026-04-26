"use client";

import type { ReactNode } from "react";
import { ShellErrorBoundary } from "./ErrorBoundary";
import { ParameterSidebar } from "./ParameterSidebar";
import { ShellSkeleton } from "./Skeleton";
import type { ParameterSpec, ParamValues } from "./types";

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  parameters?: ParameterSpec[];
  values?: ParamValues;
  onChange?: (values: ParamValues) => void;
  results?: Record<string, number | string> | null;
  loading?: boolean;
  loadingLabel?: string;
  className?: string;
  onReset?: () => void;
};

export function ShellFrame({
  children,
  title,
  subtitle,
  parameters,
  values,
  onChange,
  results,
  loading = false,
  loadingLabel,
  className = "",
  onReset,
}: Props) {
  return (
    <div
      className={`group relative flex aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] shadow-[0_0_60px_-30px_rgba(139,92,246,0.35)] backdrop-blur-sm sm:aspect-[16/9] ${className}`}
    >
      {(title || subtitle) && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-4 pb-8 pt-3">
          {title && (
            <div className="truncate text-xs font-medium text-zinc-200">
              {title}
            </div>
          )}
          {subtitle && (
            <div className="truncate text-[11px] text-zinc-500">{subtitle}</div>
          )}
        </div>
      )}

      <div className="relative flex h-full w-full items-center justify-center">
        {loading ? (
          <ShellSkeleton label={loadingLabel} />
        ) : (
          <ShellErrorBoundary onReset={onReset} label={title}>
            {children}
          </ShellErrorBoundary>
        )}
      </div>

      {parameters && values && onChange && (
        <ParameterSidebar
          parameters={parameters}
          values={values}
          onChange={onChange}
          results={results}
        />
      )}
    </div>
  );
}
