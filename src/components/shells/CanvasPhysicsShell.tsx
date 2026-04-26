"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShellFrame } from "./_internals/ShellFrame";
import { initialValues, type ParameterSpec, type ParamValues } from "./_internals/types";

export type CanvasSimulateFn<State> = (
  state: State,
  dt: number,
  params: ParamValues,
) => State | void;

export type CanvasDrawFn<State> = (
  ctx: CanvasRenderingContext2D,
  state: State,
  params: ParamValues,
  frame: { width: number; height: number; t: number },
) => void;

type Props<State> = {
  width?: number;
  height?: number;
  initialState?: State | (() => State);
  simulateFn: CanvasSimulateFn<State>;
  drawFn: CanvasDrawFn<State>;
  parameters?: ParameterSpec[];
  title?: string;
  subtitle?: string;
  loading?: boolean;
  autoPlay?: boolean;
  background?: string;
  className?: string;
};

export function CanvasPhysicsShell<State>({
  width = 800,
  height = 480,
  initialState,
  simulateFn,
  drawFn,
  parameters,
  title = "Physics Simulation",
  subtitle,
  loading = false,
  autoPlay = true,
  background = "#050509",
  className,
}: Props<State>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [values, setValues] = useState<ParamValues>(() =>
    initialValues(parameters),
  );
  const [playing, setPlaying] = useState(autoPlay);
  const [resetToken, setResetToken] = useState(0);

  const paramsRef = useRef<ParamValues>(values);
  paramsRef.current = values;
  const playingRef = useRef<boolean>(playing);
  playingRef.current = playing;

  const stateRef = useRef<State | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const handleChange = useCallback(
    (v: ParamValues) => setValues(v),
    [],
  );

  const handleReset = useCallback(() => {
    setResetToken((t) => t + 1);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.aspectRatio = `${width} / ${height}`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    stateRef.current =
      typeof initialState === "function"
        ? (initialState as () => State)()
        : (initialState as State | null) ?? (null as unknown as State);

    const t0 = performance.now();
    lastTimeRef.current = t0;

    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;
      const dt = Math.min(0.1, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      try {
        if (playingRef.current && stateRef.current !== null) {
          const next = simulateFn(
            stateRef.current as State,
            dt,
            paramsRef.current,
          );
          if (next !== undefined) stateRef.current = next;
        }

        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
        if (stateRef.current !== null) {
          drawFn(ctx, stateRef.current as State, paramsRef.current, {
            width,
            height,
            t: (now - t0) / 1000,
          });
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[CanvasPhysicsShell] simulate/draw threw:", err);
        }
        cancelled = true;
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [width, height, background, simulateFn, drawFn, initialState, resetToken]);

  return (
    <ShellFrame
      title={title}
      subtitle={subtitle ?? `${width}×${height}`}
      parameters={parameters}
      values={values}
      onChange={handleChange}
      onReset={handleReset}
      loading={loading}
      loadingLabel="Warming up simulation…"
      className={className}
    >
      <div className="relative flex h-full w-full items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          className="block h-full w-auto max-w-full rounded-lg border border-white/5 bg-black/30"
          style={{ background }}
        />
        <div className="absolute bottom-4 left-4 z-10 flex gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause simulation" : "Play simulation"}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-white/10 bg-black/60 px-2 text-[11px] font-medium text-zinc-200 backdrop-blur-md transition-colors hover:border-white/25 hover:bg-black/80"
          >
            {playing ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset simulation"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-white/10 bg-black/60 px-2 text-[11px] font-medium text-zinc-200 backdrop-blur-md transition-colors hover:border-white/25 hover:bg-black/80"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
      </div>
    </ShellFrame>
  );
}

export default CanvasPhysicsShell;
