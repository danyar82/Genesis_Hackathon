/**
 * Sandbox smoke test for the GENESIS Discovery kernel runner.
 * Exercises the four-layer defense against hostile kernels.
 *
 * Run from genesis/:
 *   node scripts/test-sandbox.mjs
 */
import { Worker } from "node:worker_threads";

const WORKER_HARD_KILL_MS = 7000;
const WORKER_MEMORY_LIMITS = {
  maxOldGenerationSizeMb: 128,
  maxYoungGenerationSizeMb: 32,
  codeRangeSizeMb: 32,
};

const WORKER_SOURCE = String.raw`
const { workerData, parentPort } = require("node:worker_threads");
const vm = require("node:vm");

(function main() {
const { kernel, params, vizType } = workerData;

function transformEsm(src) {
  return String(src)
    .replace(/^[ \t]*import[^;\n]*;?\s*$/gm, "")
    .replace(/export\s+default\s+/g, "exports.default = ")
    .replace(/export\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
      (_m, asyncKw, name) => "exports." + name + " = " + (asyncKw || "") + "function " + name)
    .replace(/export\s+const\s+([A-Za-z_$][\w$]*)\s*=/g, "exports.$1 =")
    .replace(/export\s+let\s+([A-Za-z_$][\w$]*)\s*=/g, "exports.$1 =")
    .replace(/export\s+class\s+([A-Za-z_$][\w$]*)/g, "exports.$1 = class $1")
    .replace(/export\s+\{[^}]*\}\s*;?/g, "");
}

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

const transformed = transformEsm(kernel);
const wrapped = "(function(){ const exports = {}; " + transformed + "; return exports; })()";
const ctx = vm.createContext(buildSandbox());

let exportsObj;
try {
  exportsObj = vm.runInContext(wrapped, ctx, { timeout: 5000 });
} catch (e) {
  parentPort.postMessage({ ok: false, errors: ["compile: " + (e && e.message ? e.message : e)] });
  return;
}

if (!exportsObj || typeof exportsObj.default !== "function") {
  parentPort.postMessage({ ok: false, errors: ["no callable default"] });
  return;
}

try {
  const result = vm.runInContext(
    "__d(__p)",
    Object.assign(ctx, { __d: exportsObj.default, __p: params }),
    { timeout: 5000 }
  );
  parentPort.postMessage({ ok: true, value: typeof result === "number" ? result : "(non-numeric)" });
} catch (e) {
  parentPort.postMessage({ ok: false, errors: ["run: " + (e && e.message ? e.message : e)] });
}
})();
`;

function runHostile(label, kernel, params = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const w = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { kernel, params, vizType: "2d_chart" },
      resourceLimits: WORKER_MEMORY_LIMITS,
    });
    let settled = false;
    const finish = (status, detail) => {
      if (settled) return;
      settled = true;
      const ms = Date.now() - start;
      console.log(`[${label}] ${status} (${ms}ms) — ${detail}`);
      w.terminate().catch(() => {});
      resolve({ status, detail, ms });
    };
    const killer = setTimeout(() => finish("HARD-KILLED", `timeout @${WORKER_HARD_KILL_MS}ms`), WORKER_HARD_KILL_MS);
    w.on("message", (m) => {
      clearTimeout(killer);
      finish(m.ok ? "ok" : "blocked", m.ok ? `value=${m.value}` : (m.errors || []).join(" | "));
    });
    w.on("error", (e) => {
      clearTimeout(killer);
      finish("worker-error", e.message ?? String(e));
    });
    w.on("exit", (c) => {
      if (!settled) {
        clearTimeout(killer);
        finish("exited", `code=${c}`);
      }
    });
  });
}

const TESTS = [
  {
    label: "1. baseline benign",
    kernel: "export default function(p) { return 42; }",
  },
  {
    label: "2. infinite loop",
    kernel: "export default function(p) { while(true){} return 1; }",
  },
  {
    label: "3. process.exit access",
    kernel: "export default function(p) { return process.exit(1); }",
  },
  {
    label: "4. require('fs')",
    kernel: "export default function(p) { const fs = require('fs'); return fs.readdirSync('/').length; }",
  },
  {
    label: "5. setTimeout escape",
    kernel: "export default function(p) { setTimeout(()=>{}, 9999); return 1; }",
  },
  {
    label: "6. globalThis access",
    kernel: "export default function(p) { return Object.keys(globalThis).length; }",
  },
  {
    label: "7. fetch access",
    kernel: "export default function(p) { return fetch('http://example.com'); }",
  },
  {
    label: "8. OOM allocation",
    kernel: "export default function(p) { const a = new Float64Array(1e9); return a.length; }",
  },
];

const results = [];
for (const t of TESTS) {
  results.push(await runHostile(t.label, t.kernel));
}

console.log("\n=== summary ===");
const ok = results.filter((r) => r.status === "ok").length;
const blocked = results.filter((r) => r.status === "blocked" || r.status === "HARD-KILLED" || r.status === "worker-error" || r.status === "exited").length;
console.log(`benign passed: ${ok} / 1`);
console.log(`hostile blocked: ${blocked} / ${TESTS.length - 1}`);
process.exit(0);
