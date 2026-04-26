export type VizType =
  | "3d_particles"
  | "2d_chart"
  | "interactive_graph"
  | "data_dashboard"
  | "canvas_physics"
  | "math_explorer";

export type ParameterSpec = {
  name: string;
  description?: string;
  min: number;
  max: number;
  default_value: number;
  step?: number;
  type?: string;
};

const BASE_STYLES = `:root { color-scheme: dark; }
html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; background: #050509; color: #e5e7eb; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
* { box-sizing: border-box; }
.genesis-error { padding: 24px; font-family: ui-monospace, monospace; color: #fca5a5; background: #050509; min-height: 100vh; }
.genesis-error h3 { color: #f87171; margin: 0 0 8px 0; font-size: 14px; }
.genesis-error pre { color: #fca5a5; font-size: 12px; white-space: pre-wrap; word-break: break-word; }
.genesis-root { position: relative; display: flex; flex-direction: row; width: 100vw; height: 100vh; overflow: hidden; }
.genesis-viz { position: relative; flex: 1 1 0%; min-width: 0; height: 100%; overflow: hidden; }
`;

const SIDEBAR_TSX = `import { useEffect, useState } from "react";

export type ParameterSpec = {
  name: string;
  description?: string;
  min: number;
  max: number;
  default_value: number;
  step?: number;
  type?: string;
};

export function initialValues(parameters: ParameterSpec[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of parameters) out[p.name] = p.default_value;
  return out;
}

function resolveStep(p: ParameterSpec): number {
  if (p.step) return p.step;
  if (p.type === "integer") return 1;
  const range = Math.abs(p.max - p.min);
  if (range === 0) return 0.01;
  if (range <= 1) return 0.001;
  if (range <= 10) return 0.01;
  if (range <= 100) return 0.1;
  return 1;
}

function fmt(v: number): string {
  if (Number.isInteger(v)) return String(v);
  const a = Math.abs(v);
  if (a < 0.001) return v.toExponential(2);
  if (a < 1) return v.toFixed(4);
  if (a < 100) return v.toFixed(3);
  return v.toFixed(1);
}

type Props = {
  parameters: ParameterSpec[];
  values: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
};

function InfoIcon({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const enter = () => setOpen(true);
  const leave = () => setOpen(false);
  return (
    <span
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={leave}
      tabIndex={0}
      role="button"
      aria-label={"Parameter description: " + text}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 13,
        height: 13,
        borderRadius: "50%",
        background: open ? "rgba(167,139,250,0.20)" : "rgba(255,255,255,0.05)",
        border: "1px solid " + (open ? "rgba(167,139,250,0.55)" : "rgba(255,255,255,0.14)"),
        color: open ? "#c4b5fd" : "#a1a1aa",
        fontSize: 9,
        fontWeight: 700,
        fontFamily: "ui-serif, Georgia, serif",
        fontStyle: "italic",
        cursor: "help",
        outline: "none",
        transition: "all 130ms ease",
        flexShrink: 0,
        userSelect: "none",
        lineHeight: 1,
      }}
    >
      i
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: -4,
            zIndex: 100,
            minWidth: 200,
            maxWidth: 240,
            padding: "8px 10px",
            background: "rgba(10,10,18,0.96)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(167,139,250,0.28)",
            borderRadius: 8,
            color: "#e4e4e7",
            fontSize: 11,
            lineHeight: 1.45,
            fontStyle: "normal",
            fontFamily: "inherit",
            fontWeight: 400,
            boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
            pointerEvents: "none",
            whiteSpace: "normal",
            textAlign: "left",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -5,
              left: 6,
              width: 9,
              height: 9,
              transform: "rotate(45deg)",
              background: "rgba(10,10,18,0.96)",
              borderTop: "1px solid rgba(167,139,250,0.28)",
              borderLeft: "1px solid rgba(167,139,250,0.28)",
            }}
          />
          {text}
        </span>
      )}
    </span>
  );
}

export function Sidebar({ parameters, values, onChange }: Props) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setOpen(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (parameters.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 30,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          fontSize: 11,
          fontWeight: 500,
          background: "rgba(0,0,0,0.5)",
          color: "#e5e7eb",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 6,
          cursor: "pointer",
          backdropFilter: "blur(12px)",
          fontFamily: "inherit",
        }}
      >
        {open ? "Hide" : "Parameters"}
        {!open && (
          <span
            style={{
              fontSize: 10,
              padding: "0 6px",
              marginLeft: 2,
              background: "rgba(139,92,246,0.3)",
              borderRadius: 999,
              color: "#e9d5ff",
            }}
          >
            {parameters.length}
          </span>
        )}
      </button>

      <aside
        aria-hidden={!open}
        style={{
          flex: "0 0 auto",
          width: open ? "min(290px, 75vw)" : 0,
          height: "100%",
          background: open ? "rgba(0,0,0,0.55)" : "transparent",
          backdropFilter: open ? "blur(16px)" : "none",
          borderLeft: open
            ? "1px solid rgba(255,255,255,0.1)"
            : "1px solid transparent",
          overflow: "hidden",
          transition:
            "width 280ms cubic-bezier(0.2, 0.8, 0.2, 1), background 280ms ease, border-color 280ms ease",
          zIndex: 20,
        }}
      >
        <div
          style={{
            width: "100%",
            minWidth: 220,
            height: "100%",
            padding: "52px 16px 16px",
            overflowY: "auto",
            opacity: open ? 1 : 0,
            transition: "opacity 220ms ease",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#a1a1aa",
              marginBottom: 14,
            }}
          >
            Parameters
          </div>
          {parameters.map((p) => {
            const v = values[p.name] ?? p.default_value;
            const step = resolveStep(p);
            const frac = (v - p.min) / Math.max(1e-9, p.max - p.min);
            return (
              <div key={p.name} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      minWidth: 0,
                    }}
                  >
                    <label
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#e5e7eb",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.name}
                    </label>
                    {p.description && <InfoIcon text={p.description} />}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#c4b5fd",
                      fontFamily: "ui-monospace, monospace",
                      flexShrink: 0,
                    }}
                  >
                    {fmt(v)}
                  </span>
                </div>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={step}
                  value={v}
                  onChange={(e) =>
                    onChange({ ...values, [p.name]: Number(e.target.value) })
                  }
                  style={{
                    width: "100%",
                    height: 4,
                    accentColor: "#a78bfa",
                    background: \`linear-gradient(90deg, rgba(139,92,246,0.55) 0%, rgba(6,182,212,0.45) \${frac * 100}%, rgba(255,255,255,0.06) \${frac * 100}%)\`,
                    borderRadius: 999,
                    appearance: "none",
                    WebkitAppearance: "none",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 9,
                    color: "#52525b",
                    fontFamily: "ui-monospace, monospace",
                    marginTop: 2,
                  }}
                >
                  <span>{fmt(p.min)}</span>
                  <span>{fmt(p.max)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
`;

const PARTICLES_APP = `import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import * as kernel from "./kernel";
import { parameters } from "./params";
import { Sidebar, initialValues } from "./sidebar";

const k = kernel as unknown as Record<string, unknown>;
const updateFn = (k.default ?? k.update ?? k.step ?? k.simulate ?? k.tick) as
  | ((
      positions: Float32Array,
      dt: number,
      t: number,
      params: Record<string, number>,
    ) => void)
  | undefined;
const initFn = (k.init ?? k.initialize ?? k.seed) as
  | ((
      count: number,
      params?: Record<string, number>,
    ) => Float32Array | Array<{ x?: number; y?: number; z?: number }>)
  | undefined;
const COUNT = typeof k.count === "number" ? (k.count as number) : 2000;
const POINT_SIZE = typeof k.pointSize === "number" ? (k.pointSize as number) : 0.05;
const POINT_COLOR = typeof k.color === "string" ? (k.color as string) : "#a78bfa";

function Particles({
  paramsRef,
}: {
  paramsRef: React.MutableRefObject<Record<string, number>>;
}) {
  const ref = useRef<THREE.Points | null>(null);

  const positions = useMemo(() => {
    if (typeof initFn === "function") {
      const seed = initFn(COUNT, paramsRef.current);
      if (seed instanceof Float32Array) return seed;
      if (Array.isArray(seed)) {
        const arr = new Float32Array(COUNT * 3);
        for (let i = 0; i < Math.min(seed.length, COUNT); i++) {
          const p = seed[i] ?? {};
          arr[i * 3] = Number(p.x ?? 0);
          arr[i * 3 + 1] = Number(p.y ?? 0);
          arr[i * 3 + 2] = Number(p.z ?? 0);
        }
        return arr;
      }
    }
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT * 3; i++) arr[i] = (Math.random() - 0.5) * 4;
    return arr;
  }, []);

  useFrame((state, dt) => {
    if (typeof updateFn !== "function" || !ref.current) return;
    const attr = ref.current.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    updateFn(
      attr.array as Float32Array,
      dt,
      state.clock.elapsedTime,
      paramsRef.current,
    );
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={POINT_SIZE}
        color={POINT_COLOR}
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function App() {
  const [values, setValues] = useState<Record<string, number>>(() =>
    initialValues(parameters),
  );
  const paramsRef = useRef(values);
  paramsRef.current = values;

  useEffect(() => {
    let frame = 0;
    let cancelAnim = () => {};
    function handle(e: MessageEvent) {
      const d = e.data;
      if (!d || typeof d !== "object" || d.type !== "genesis:set-params") return;
      const incoming = d.values;
      if (!incoming || typeof incoming !== "object") return;
      cancelAnim();
      const startTs = performance.now();
      const duration = 600;
      let startVals: Record<string, number> | null = null;
      const step = (now: number) => {
        const t = Math.min(1, (now - startTs) / duration);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        setValues((prev) => {
          if (!startVals) startVals = { ...prev };
          const next = { ...prev };
          for (const k of Object.keys(incoming)) {
            const v = (incoming as Record<string, unknown>)[k];
            const sv = (startVals as Record<string, number>)[k];
            if (typeof v !== "number" || !Number.isFinite(v)) continue;
            if (typeof sv === "number") next[k] = sv + (v - sv) * ease;
            else next[k] = v;
          }
          return next;
        });
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      cancelAnim = () => { if (frame) cancelAnimationFrame(frame); };
    }
    window.addEventListener("message", handle);
    return () => {
      window.removeEventListener("message", handle);
      cancelAnim();
    };
  }, []);

  if (typeof updateFn !== "function") {
    return (
      <div className="genesis-error">
        <h3>kernel export missing</h3>
        <pre>Expected: export default (positions, dt, t, params) =&gt; void</pre>
      </div>
    );
  }

  return (
    <div className="genesis-root">
      <div className="genesis-viz">
        <Canvas camera={{ position: [0, 0, 5], fov: 55 }} dpr={[1, 2]}>
          <color attach="background" args={["#050509"]} />
          <ambientLight intensity={0.45} />
          <pointLight position={[5, 5, 5]} intensity={0.6} />
          <OrbitControls enableDamping dampingFactor={0.08} rotateSpeed={0.6} />
          <Particles paramsRef={paramsRef} />
        </Canvas>
      </div>
      <Sidebar parameters={parameters} values={values} onChange={setValues} />
    </div>
  );
}
`;

const CHART_APP = `import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as kernel from "./kernel";
import { parameters } from "./params";
import { Sidebar, initialValues } from "./sidebar";

const k = kernel as unknown as Record<string, unknown>;
const computeFn = (k.default ?? k.compute ?? k.simulate ?? k.run ?? k.generate) as
  | ((
      params: Record<string, number>,
    ) => Array<Record<string, number>>)
  | undefined;

const COLORS = ["#a78bfa", "#22d3ee", "#60a5fa", "#f472b6", "#34d399", "#fbbf24"];

export default function App() {
  const [values, setValues] = useState<Record<string, number>>(() =>
    initialValues(parameters),
  );

  // Listen for parameter overrides posted from the parent (Discovery feature).
  // Animates values over ~600ms with easeInOut so the change is visible.
  useEffect(() => {
    let frame = 0;
    let cancelAnim = () => {};
    function handle(e: MessageEvent) {
      const d = e.data;
      if (!d || typeof d !== "object" || d.type !== "genesis:set-params") return;
      const incoming = d.values;
      if (!incoming || typeof incoming !== "object") return;
      cancelAnim();
      const startTs = performance.now();
      const duration = 600;
      let startVals: Record<string, number> | null = null;
      const step = (now: number) => {
        const t = Math.min(1, (now - startTs) / duration);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        setValues((prev) => {
          if (!startVals) startVals = { ...prev };
          const next = { ...prev };
          for (const k of Object.keys(incoming)) {
            const v = (incoming as Record<string, unknown>)[k];
            const sv = (startVals as Record<string, number>)[k];
            if (typeof v !== "number" || !Number.isFinite(v)) continue;
            if (typeof sv === "number") next[k] = sv + (v - sv) * ease;
            else next[k] = v;
          }
          return next;
        });
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      cancelAnim = () => { if (frame) cancelAnimationFrame(frame); };
    }
    window.addEventListener("message", handle);
    return () => {
      window.removeEventListener("message", handle);
      cancelAnim();
    };
  }, []);

  const data = useMemo(() => {
    if (typeof computeFn !== "function") return [];
    const out = computeFn(values);
    return Array.isArray(out) ? out : [];
  }, [values]);

  if (typeof computeFn !== "function") {
    return (
      <div className="genesis-error">
        <h3>kernel export missing</h3>
        <pre>Expected: export default (params) =&gt; Array&lt;Record&lt;string, number&gt;&gt;</pre>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="genesis-root">
        <div className="genesis-viz">
          <div className="genesis-error">
            <h3>No data returned</h3>
            <pre>compute(params) returned an empty array.</pre>
          </div>
        </div>
        <Sidebar parameters={parameters} values={values} onChange={setValues} />
      </div>
    );
  }

  const row = data[0] ?? {};
  const keys = Object.keys(row);
  const xKey =
    keys.find((key) => /^(x|t|time|step|i|n|iter|epoch|k)$/i.test(key)) ??
    keys[0] ??
    "x";
  const yKeys = keys.filter(
    (key) => key !== xKey && typeof row[key] === "number",
  );

  // Multiverse: when the kernel declares a "highlight_paper" parameter, the
  // value selects which series gets emphasized (thicker stroke + full opacity);
  // others fade slightly. A simple, backwards-compatible affordance.
  const hasHighlight = parameters.some((p) => p.name === "highlight_paper");
  const highlightIdx = hasHighlight
    ? Math.min(
        Math.max(0, Math.round(values.highlight_paper ?? 0)),
        Math.max(0, yKeys.length - 1),
      )
    : -1;

  return (
    <div className="genesis-root">
      <div className="genesis-viz" style={{ padding: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 12, right: 24, left: 0, bottom: 12 }}
          >
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="rgba(255,255,255,0.07)"
            />
            <XAxis
              dataKey={xKey}
              stroke="rgba(255,255,255,0.45)"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.55)" }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.45)"
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.55)" }}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(10,10,20,0.9)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 11,
                color: "#e5e7eb",
                backdropFilter: "blur(8px)",
              }}
              cursor={{ stroke: "rgba(139,92,246,0.35)", strokeWidth: 1 }}
            />
            {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {yKeys.map((yk, i) => {
              const isHighlighted = highlightIdx === i;
              const dim = highlightIdx >= 0 && !isHighlighted;
              return (
                <Line
                  key={yk}
                  type="monotone"
                  dataKey={yk}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={isHighlighted ? 3.5 : 1.75}
                  strokeOpacity={dim ? 0.45 : 1}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Sidebar parameters={parameters} values={values} onChange={setValues} />
    </div>
  );
}
`;

const CANVAS_APP = `import { useEffect, useRef, useState } from "react";
import * as kernel from "./kernel";
import { parameters } from "./params";
import { Sidebar, initialValues } from "./sidebar";

const k = kernel as unknown as Record<string, unknown>;
const initFn = (k.init ?? k.initialize ?? k.seed) as
  | ((params?: Record<string, number>) => unknown)
  | undefined;
const simulateFn = (k.simulate ?? k.step ?? k.update ?? k.tick) as
  | ((state: unknown, dt: number, params: Record<string, number>) => unknown)
  | undefined;
const drawFn = (k.draw ?? k.render ?? k.default) as
  | ((
      ctx: CanvasRenderingContext2D,
      state: unknown,
      frame: { width: number; height: number; t: number },
      params: Record<string, number>,
    ) => void)
  | undefined;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [values, setValues] = useState<Record<string, number>>(() =>
    initialValues(parameters),
  );
  const paramsRef = useRef(values);
  paramsRef.current = values;

  useEffect(() => {
    let frame = 0;
    let cancelAnim = () => {};
    function handle(e: MessageEvent) {
      const d = e.data;
      if (!d || typeof d !== "object" || d.type !== "genesis:set-params") return;
      const incoming = d.values;
      if (!incoming || typeof incoming !== "object") return;
      cancelAnim();
      const startTs = performance.now();
      const duration = 600;
      let startVals: Record<string, number> | null = null;
      const step = (now: number) => {
        const t = Math.min(1, (now - startTs) / duration);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        setValues((prev) => {
          if (!startVals) startVals = { ...prev };
          const next = { ...prev };
          for (const k of Object.keys(incoming)) {
            const v = (incoming as Record<string, unknown>)[k];
            const sv = (startVals as Record<string, number>)[k];
            if (typeof v !== "number" || !Number.isFinite(v)) continue;
            if (typeof sv === "number") next[k] = sv + (v - sv) * ease;
            else next[k] = v;
          }
          return next;
        });
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      cancelAnim = () => { if (frame) cancelAnimationFrame(frame); };
    }
    window.addEventListener("message", handle);
    return () => {
      window.removeEventListener("message", handle);
      cancelAnim();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      const rect = host.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let state: unknown =
      typeof initFn === "function" ? initFn(paramsRef.current) : {};
    const t0 = performance.now();
    let lastT = t0;
    let raf = 0;
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;
      const dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;

      if (typeof simulateFn === "function") {
        const next = simulateFn(state, dt, paramsRef.current);
        if (next !== undefined) state = next;
      }

      ctx.fillStyle = "#050509";
      ctx.fillRect(0, 0, w, h);

      if (typeof drawFn === "function") {
        drawFn(
          ctx,
          state,
          { width: w, height: h, t: (now - t0) / 1000 },
          paramsRef.current,
        );
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  if (typeof drawFn !== "function") {
    return (
      <div className="genesis-error">
        <h3>kernel export missing</h3>
        <pre>Expected: export function draw(ctx, state, frame, params) =&gt; void</pre>
      </div>
    );
  }

  return (
    <div className="genesis-root">
      <div className="genesis-viz">
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
      </div>
      <Sidebar parameters={parameters} values={values} onChange={setValues} />
    </div>
  );
}
`;

const MATH_APP = `import { useEffect, useMemo, useState } from "react";
import * as kernel from "./kernel";
import { parameters } from "./params";
import { Sidebar, initialValues } from "./sidebar";

const k = kernel as unknown as Record<string, unknown>;
const computeFn = (k.default ?? k.compute ?? k.evaluate ?? k.run) as
  | ((
      params: Record<string, number>,
    ) => Record<string, number | string>)
  | undefined;

export default function App() {
  const [values, setValues] = useState<Record<string, number>>(() =>
    initialValues(parameters),
  );

  useEffect(() => {
    let frame = 0;
    let cancelAnim = () => {};
    function handle(e: MessageEvent) {
      const d = e.data;
      if (!d || typeof d !== "object" || d.type !== "genesis:set-params") return;
      const incoming = d.values;
      if (!incoming || typeof incoming !== "object") return;
      cancelAnim();
      const startTs = performance.now();
      const duration = 600;
      let startVals: Record<string, number> | null = null;
      const step = (now: number) => {
        const t = Math.min(1, (now - startTs) / duration);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        setValues((prev) => {
          if (!startVals) startVals = { ...prev };
          const next = { ...prev };
          for (const k of Object.keys(incoming)) {
            const v = (incoming as Record<string, unknown>)[k];
            const sv = (startVals as Record<string, number>)[k];
            if (typeof v !== "number" || !Number.isFinite(v)) continue;
            if (typeof sv === "number") next[k] = sv + (v - sv) * ease;
            else next[k] = v;
          }
          return next;
        });
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      cancelAnim = () => { if (frame) cancelAnimationFrame(frame); };
    }
    window.addEventListener("message", handle);
    return () => {
      window.removeEventListener("message", handle);
      cancelAnim();
    };
  }, []);

  const results = useMemo(() => {
    if (typeof computeFn !== "function") return null;
    try {
      return computeFn(values);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [values]);

  if (typeof computeFn !== "function") {
    return (
      <div className="genesis-error">
        <h3>kernel export missing</h3>
        <pre>Expected: export default (params) =&gt; Record&lt;string, number | string&gt;</pre>
      </div>
    );
  }

  return (
    <div className="genesis-root">
      <div
        className="genesis-viz"
        style={{
          padding: "40px 36px",
          overflowY: "auto",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#71717a",
            marginBottom: 12,
          }}
        >
          Live Results
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: "10px 24px",
            alignItems: "baseline",
            padding: 20,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
          }}
        >
          {results &&
            Object.entries(results).map(([key, val]) => (
              <div
                key={key}
                style={{ display: "contents" }}
              >
                <div style={{ color: "#a1a1aa", fontSize: 13 }}>{key}</div>
                <div
                  style={{
                    color: "#a78bfa",
                    fontSize: 14,
                    fontWeight: 500,
                    textAlign: "right",
                  }}
                >
                  {typeof val === "number"
                    ? Number.isInteger(val)
                      ? val
                      : val.toFixed(4)
                    : String(val)}
                </div>
              </div>
            ))}
        </div>
      </div>
      <Sidebar parameters={parameters} values={values} onChange={setValues} />
    </div>
  );
}
`;

const INDEX_TSX = `import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
`;

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GENESIS Preview</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

type Template = {
  appFile: string;
  dependencies: Record<string, string>;
};

const THREE_DEPS = {
  three: "0.184.0",
  "@react-three/fiber": "9.6.0",
  "@react-three/drei": "10.7.7",
};

const RECHARTS_DEPS = {
  recharts: "3.8.1",
  // recharts imports react-is directly; Sandpack doesn't resolve transitive
  // deps from the host node_modules, so we must declare it explicitly.
  "react-is": "19.2.4",
};

const TEMPLATES: Record<VizType, Template> = {
  "3d_particles": { appFile: PARTICLES_APP, dependencies: THREE_DEPS },
  "2d_chart": { appFile: CHART_APP, dependencies: RECHARTS_DEPS },
  interactive_graph: { appFile: CHART_APP, dependencies: RECHARTS_DEPS },
  data_dashboard: { appFile: CHART_APP, dependencies: RECHARTS_DEPS },
  canvas_physics: { appFile: CANVAS_APP, dependencies: {} },
  math_explorer: { appFile: MATH_APP, dependencies: {} },
};

function serializeParams(parameters: ParameterSpec[]): string {
  const safe = parameters.map((p) => ({
    name: p.name,
    description: p.description ?? "",
    min: Number.isFinite(p.min) ? p.min : 0,
    max: Number.isFinite(p.max) ? p.max : 1,
    default_value: Number.isFinite(p.default_value)
      ? p.default_value
      : (p.min + p.max) / 2,
    step: p.step,
    type: p.type,
  }));
  return `import type { ParameterSpec } from "./sidebar";\n\nexport const parameters: ParameterSpec[] = ${JSON.stringify(safe, null, 2)};\n`;
}

export function getTemplate(
  vizType: string,
  codeKernel: string,
  parameters: ParameterSpec[] = [],
) {
  const key = (vizType as VizType) in TEMPLATES ? (vizType as VizType) : "2d_chart";
  const tpl = TEMPLATES[key];
  return {
    vizType: key,
    files: {
      "/App.tsx": tpl.appFile,
      "/index.tsx": INDEX_TSX,
      "/styles.css": BASE_STYLES,
      "/sidebar.tsx": SIDEBAR_TSX,
      "/params.ts": serializeParams(parameters),
      "/public/index.html": INDEX_HTML,
      "/kernel.ts": codeKernel,
    },
    customSetup: {
      entry: "/index.tsx",
      dependencies: {
        react: "19.2.4",
        "react-dom": "19.2.4",
        ...tpl.dependencies,
      },
    },
  };
}
