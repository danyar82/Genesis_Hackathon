"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onReset?: () => void;
  label?: string;
};

type State = { error: Error | null };

export class ShellErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[shell error]", this.props.label ?? "", error, info);
    }
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-[240px] w-full items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-red-500/20 bg-red-500/[0.04] p-5 text-center backdrop-blur-md">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-300" />
            </div>
            <div className="text-sm font-medium text-zinc-100">
              Visualization crashed
            </div>
            <pre className="mx-auto mt-2 max-w-sm overflow-hidden text-[11px] leading-snug text-red-200/80">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              onClick={this.reset}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-white/25 hover:bg-white/10"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
