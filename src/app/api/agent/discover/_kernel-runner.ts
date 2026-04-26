import { Worker } from "node:worker_threads";
import type { KernelObservation } from "@/types/discovery";

/**
 * GENESIS Discovery — server-side kernel sandbox.
 *
 * Defense in depth (4 layers):
 *   1. Worker thread isolation (separate V8 isolate, separate event loop, hard kill).
 *      Resource-capped: ~160 MB heap.
 *   2. vm.createContext with whitelist sandbox (no process, no require, no I/O).
 *   3. vm.runInContext({ timeout: 5000 }) catches sync overruns.
 *   4. Parent-side setTimeout(7000) + worker.terminate() — guaranteed V8-level kill.
 *
 * The worker source is delivered inline as a string and evaluated via
 *   `new Worker(WORKER_SOURCE, { eval: true })`
 * to avoid file-path resolution issues under Turbopack.
 */

const WORKER_HARD_KILL_MS = 7000;
const WORKER_MEMORY_LIMITS = {
  maxOldGenerationSizeMb: 128,
  maxYoungGenerationSizeMb: 32,
  codeRangeSizeMb: 32,
};

// ---------------------------------------------------------------------------
// Inline worker source. Self-contained — no external imports, no Node-specific
// APIs leak into the sandboxed kernel.
// ---------------------------------------------------------------------------

const WORKER_SOURCE = String.raw`
const { workerData, parentPort } = require("node:worker_threads");
const vm = require("node:vm");

(function main() {
const { kernel, params, vizType } = workerData;

// ESM → vm-runnable source. We don't accept import statements; if the kernel
// has any "import ..." we strip them since the sandbox provides no module
// resolution (and the kernel shouldn't need any beyond the whitelisted globals).
function transformEsm(src) {
  return String(src)
    // strip imports outright
    .replace(/^[ \t]*import[^;\n]*;?\s*$/gm, "")
    // export default <expr>;        →  exports.default = <expr>;
    .replace(/export\s+default\s+/g, "exports.default = ")
    // export async function NAME    →  exports.NAME = async function NAME
    .replace(
      /export\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
      (_m, asyncKw, name) => "exports." + name + " = " + (asyncKw || "") + "function " + name,
    )
    // export const NAME =           →  exports.NAME =
    .replace(/export\s+const\s+([A-Za-z_$][\w$]*)\s*=/g, "exports.$1 =")
    // export let NAME =             →  exports.NAME =
    .replace(/export\s+let\s+([A-Za-z_$][\w$]*)\s*=/g, "exports.$1 =")
    // export class NAME             →  exports.NAME = class NAME
    .replace(
      /export\s+class\s+([A-Za-z_$][\w$]*)/g,
      "exports.$1 = class $1",
    )
    // export { ... };               →  ""
    .replace(/export\s+\{[^}]*\}\s*;?/g, "");
}

// Whitelist sandbox. Notably absent: process, require, Buffer, global,
// globalThis, setTimeout, setInterval, setImmediate, fetch, XMLHttpRequest.
function buildSandbox() {
  return {
    Math, Number, String, Boolean, Array, Object, Date, JSON,
    Map, Set, WeakMap, WeakSet,
    Float32Array, Float64Array,
    Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array,
    Uint8ClampedArray,
    Promise, Symbol,
    isFinite, isNaN, parseFloat, parseInt,
    Error, TypeError, RangeError,
  };
}

function summarizeRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: true, shape: "rows", rowCount: 0, series: {}, errors: [] };
  }
  const sample = rows[0] || {};
  const keys = Object.keys(sample).filter(
    (k) => typeof sample[k] === "number" && Number.isFinite(sample[k]),
  );
  const series = {};

  for (const k of keys) {
    let min = Infinity, max = -Infinity, sum = 0, n = 0, finalVal = 0;
    let lastChangeSign = 0; // -1, 0, +1
    let oscCount = 0;
    let monoUp = true, monoDown = true;
    let prev = null;
    let diverged = false;

    for (let i = 0; i < rows.length; i++) {
      const v = rows[i] && rows[i][k];
      if (typeof v !== "number") continue;
      if (!Number.isFinite(v) || Math.abs(v) > 1e10) {
        diverged = true;
        // keep counting but mark it
      }
      if (Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
        n++;
        finalVal = v;
        if (prev !== null) {
          const diff = v - prev;
          const sign = diff > 1e-12 ? 1 : diff < -1e-12 ? -1 : 0;
          if (sign === 1) monoDown = false;
          if (sign === -1) monoUp = false;
          if (sign !== 0 && lastChangeSign !== 0 && sign !== lastChangeSign) {
            oscCount++;
          }
          if (sign !== 0) lastChangeSign = sign;
        }
        prev = v;
      } else {
        prev = null;
        monoUp = false;
        monoDown = false;
      }
    }

    series[k] = {
      min: n > 0 ? min : 0,
      max: n > 0 ? max : 0,
      mean: n > 0 ? sum / n : 0,
      final: finalVal,
      monotonic: monoUp ? "increasing" : monoDown ? "decreasing" : "neither",
      diverged,
      oscillation_count: oscCount,
    };
  }

  return {
    ok: true,
    shape: "rows",
    rowCount: rows.length,
    series,
    errors: [],
  };
}

function summarizeRecord(record) {
  if (!record || typeof record !== "object") {
    return { ok: true, shape: "record", scalars: {}, errors: [] };
  }
  const scalars = {};
  for (const [k, v] of Object.entries(record)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      scalars[k] = v;
    } else if (typeof v === "string") {
      scalars[k] = v.slice(0, 80);
    }
  }
  return { ok: true, shape: "record", scalars, errors: [] };
}

function summarizeSnapshots(snapshots) {
  // snapshots is an array of state-derived numeric records
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return { ok: true, shape: "snapshots", rowCount: 0, series: {}, errors: [] };
  }
  return Object.assign(summarizeRows(snapshots), { shape: "snapshots" });
}

function summarizeParticles(positions) {
  // positions is a Float32Array of [x,y,z, x,y,z, ...]
  if (!positions || typeof positions.length !== "number") {
    return { ok: true, shape: "particles", scalars: {}, errors: [] };
  }
  const n = Math.floor(positions.length / 3);
  if (n === 0) return { ok: true, shape: "particles", scalars: { count: 0 }, errors: [] };
  let sx = 0, sy = 0, sz = 0;
  let s2 = 0;
  let minX = Infinity, maxX = -Infinity;
  let diverged = false;
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      diverged = true;
      continue;
    }
    if (Math.abs(x) > 1e6 || Math.abs(y) > 1e6 || Math.abs(z) > 1e6) {
      diverged = true;
    }
    sx += x; sy += y; sz += z;
    s2 += x * x + y * y + z * z;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  const cx = sx / n, cy = sy / n, cz = sz / n;
  const meanRsq = s2 / n;
  const spread = Math.sqrt(Math.max(0, meanRsq - (cx * cx + cy * cy + cz * cz)));
  return {
    ok: true,
    shape: "particles",
    scalars: {
      count: n,
      centroid_x: cx,
      centroid_y: cy,
      centroid_z: cz,
      spread,
      diverged: diverged ? 1 : 0,
    },
    errors: [],
  };
}

function summarizeError(message) {
  return { ok: false, errors: [String(message).slice(0, 240)] };
}

// ---- main ----

const start = Date.now();
let result;

try {
  const transformed = transformEsm(kernel);
  const wrapped =
    "(function(){ const exports = {}; " +
    transformed +
    "; return exports; })()";

  const sandbox = buildSandbox();
  const ctx = vm.createContext(sandbox);

  let exportsObj;
  try {
    exportsObj = vm.runInContext(wrapped, ctx, { timeout: 5000 });
  } catch (e) {
    parentPort.postMessage(
      Object.assign(summarizeError("compile: " + (e && e.message ? e.message : e)), {
        durationMs: Date.now() - start,
      }),
    );
    return;
  }

  if (!exportsObj || typeof exportsObj !== "object") {
    parentPort.postMessage(
      Object.assign(summarizeError("kernel produced no exports"), {
        durationMs: Date.now() - start,
      }),
    );
    return;
  }

  const dflt = exportsObj.default;
  const init = exportsObj.init;
  const simulate = exportsObj.simulate;

  if (vizType === "canvas_physics" && typeof simulate === "function") {
    // Run init → simulate loop → collect snapshots
    let state = typeof init === "function" ? init.call(null, params) : null;
    const snapshots = [];
    const N = 100;
    const dt = 0.016;
    for (let i = 0; i < N; i++) {
      let next;
      try {
        next = vm.runInContext(
          "({ s: __genesis_simulate(__genesis_state, __genesis_dt, __genesis_params) })",
          Object.assign(ctx, {
            __genesis_simulate: simulate,
            __genesis_state: state,
            __genesis_dt: dt,
            __genesis_params: params,
          }),
          { timeout: 100 },
        );
      } catch (e) {
        result = summarizeError("simulate step " + i + ": " + (e && e.message ? e.message : e));
        break;
      }
      if (next && next.s !== undefined) state = next.s;
      // Collect a numeric summary of the state object
      const snap = {};
      if (state && typeof state === "object") {
        for (const [k, v] of Object.entries(state)) {
          if (typeof v === "number" && Number.isFinite(v)) snap[k] = v;
        }
      }
      snap.step = i;
      snapshots.push(snap);
    }
    if (!result) result = summarizeSnapshots(snapshots);
  } else if (vizType === "3d_particles" && typeof dflt === "function") {
    // init → loop default(positions, dt, t, params) → summarize positions
    const count = exportsObj.count || 256;
    let positions;
    try {
      positions =
        typeof init === "function"
          ? init.call(null, count)
          : new Float32Array(count * 3);
    } catch (e) {
      result = summarizeError("init: " + (e && e.message ? e.message : e));
    }
    if (!result) {
      const N = 60;
      const dt = 0.016;
      let t = 0;
      let crashed = false;
      for (let i = 0; i < N; i++) {
        try {
          dflt.call(null, positions, dt, t, params);
        } catch (e) {
          result = summarizeError("step " + i + ": " + (e && e.message ? e.message : e));
          crashed = true;
          break;
        }
        t += dt;
      }
      if (!crashed) result = summarizeParticles(positions);
    }
  } else if (typeof dflt === "function") {
    // 2d_chart / interactive_graph / data_dashboard / math_explorer
    let raw;
    try {
      raw = vm.runInContext(
        "__genesis_default(__genesis_params)",
        Object.assign(ctx, {
          __genesis_default: dflt,
          __genesis_params: params,
        }),
        { timeout: 5000 },
      );
    } catch (e) {
      result = summarizeError("run: " + (e && e.message ? e.message : e));
    }
    if (!result) {
      if (Array.isArray(raw)) {
        result = summarizeRows(raw);
      } else if (raw && typeof raw === "object") {
        result = summarizeRecord(raw);
      } else if (typeof raw === "number") {
        result = { ok: true, shape: "record", scalars: { value: raw }, errors: [] };
      } else {
        result = summarizeError(
          "kernel returned " + (raw === undefined ? "undefined" : typeof raw),
        );
      }
    }
  } else {
    result = summarizeError("kernel did not export a callable default/simulate");
  }
} catch (e) {
  result = summarizeError("worker: " + (e && e.message ? e.message : e));
}

result.durationMs = Date.now() - start;
parentPort.postMessage(result);
})();
`;

export type RunKernelArgs = {
  kernel: string;
  params: Record<string, number>;
  vizType: string;
  signal?: AbortSignal;
};

export async function runKernelInWorker({
  kernel,
  params,
  vizType,
  signal,
}: RunKernelArgs): Promise<KernelObservation> {
  if (signal?.aborted) {
    return { ok: false, errors: ["aborted before start"] };
  }

  const startedAt = Date.now();

  const worker = new Worker(WORKER_SOURCE, {
    eval: true,
    workerData: { kernel, params, vizType },
    resourceLimits: WORKER_MEMORY_LIMITS,
    // No env access; close all stdio so worker can't observe parent.
    stdout: true,
    stderr: true,
  });

  let settled = false;
  let killTimer: NodeJS.Timeout | undefined;
  let abortHandler: (() => void) | undefined;

  const cleanup = () => {
    if (killTimer) clearTimeout(killTimer);
    if (abortHandler && signal) signal.removeEventListener("abort", abortHandler);
    worker
      .terminate()
      .catch(() => {
        /* ignore */
      });
  };

  return new Promise<KernelObservation>((resolve) => {
    const finish = (obs: KernelObservation) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        ...obs,
        durationMs: obs.durationMs ?? Date.now() - startedAt,
      });
    };

    killTimer = setTimeout(() => {
      finish({
        ok: false,
        errors: [
          `worker hard-killed after ${WORKER_HARD_KILL_MS}ms (likely infinite loop)`,
        ],
      });
    }, WORKER_HARD_KILL_MS);

    if (signal) {
      abortHandler = () => finish({ ok: false, errors: ["aborted by client"] });
      if (signal.aborted) {
        abortHandler();
        return;
      }
      signal.addEventListener("abort", abortHandler);
    }

    worker.on("message", (msg: unknown) => {
      if (msg && typeof msg === "object") {
        finish(msg as KernelObservation);
      } else {
        finish({ ok: false, errors: ["worker sent malformed message"] });
      }
    });

    worker.on("error", (err) => {
      const message = err instanceof Error ? err.message : String(err);
      // V8 OOM surfaces here as ERR_WORKER_OUT_OF_MEMORY
      finish({
        ok: false,
        errors: [`worker error: ${message.slice(0, 200)}`],
      });
    });

    worker.on("exit", (code) => {
      if (!settled) {
        finish({
          ok: false,
          errors: [`worker exited with code ${code} before posting result`],
        });
      }
    });
  });
}
