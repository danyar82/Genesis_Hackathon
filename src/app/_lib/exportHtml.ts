import type { PaperDna, PaperDnaParameter, VizType } from "@/types/paperDna";

const BASE_CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; width: 100%; min-height: 100vh; background: #050509; color: #e5e7eb; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
#root { width: 100%; min-height: 100vh; }
.gx-root { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
.gx-error { padding: 24px; font-family: ui-monospace, monospace; color: #fca5a5; min-height: 100vh; }
.gx-error h3 { color: #f87171; margin: 0 0 8px 0; font-size: 14px; }
.gx-error pre { color: #fca5a5; font-size: 12px; white-space: pre-wrap; }
.gx-sidebar-toggle { position: absolute; top: 12px; right: 12px; z-index: 30; display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; font-size: 11px; font-weight: 500; background: rgba(0,0,0,0.5); color: #e5e7eb; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; cursor: pointer; backdrop-filter: blur(12px); font-family: inherit; }
.gx-sidebar-toggle .gx-count { font-size: 10px; padding: 0 6px; margin-left: 2px; background: rgba(139,92,246,0.3); border-radius: 999px; color: #e9d5ff; }
.gx-sidebar { position: absolute; top: 0; right: 0; bottom: 0; width: 290px; max-width: 85%; z-index: 20; background: rgba(0,0,0,0.55); backdrop-filter: blur(16px); border-left: 1px solid rgba(255,255,255,0.1); padding: 52px 16px 16px; overflow-y: auto; }
.gx-sidebar-title { font-size: 10px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #a1a1aa; margin-bottom: 14px; }
.gx-param { margin-bottom: 16px; }
.gx-param-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; }
.gx-param-name { font-size: 13px; font-weight: 500; color: #e5e7eb; }
.gx-param-value { font-size: 11px; color: #c4b5fd; font-family: ui-monospace, monospace; }
.gx-param-desc { font-size: 10px; color: #71717a; margin: 0 0 6px 0; line-height: 1.3; }
.gx-param input[type=range] { width: 100%; height: 4px; accent-color: #a78bfa; border-radius: 999px; appearance: none; -webkit-appearance: none; }
.gx-param-bounds { display: flex; justify-content: space-between; font-size: 9px; color: #52525b; font-family: ui-monospace, monospace; margin-top: 2px; }
.gx-results { padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px 24px; align-items: baseline; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.gx-results .k { color: #a1a1aa; font-size: 13px; }
.gx-results .v { color: #a78bfa; font-size: 14px; font-weight: 500; text-align: right; }
.gx-footer { position: fixed; bottom: 8px; left: 12px; font-size: 10px; color: #52525b; font-family: ui-monospace, monospace; pointer-events: none; }
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeParams(params: PaperDnaParameter[]): PaperDnaParameter[] {
  return params.map((p) => ({
    name: p.name,
    description: p.description ?? "",
    min: Number.isFinite(p.min) ? p.min : 0,
    max: Number.isFinite(p.max) ? p.max : 1,
    default_value: Number.isFinite(p.default_value)
      ? p.default_value
      : (p.min + p.max) / 2,
    type: p.type,
  }));
}

const PARTICLES_RUNTIME = `
import * as THREE from "https://esm.sh/three@0.184.0";
import { OrbitControls } from "https://esm.sh/three@0.184.0/examples/jsm/controls/OrbitControls.js";

const COUNT = (kernel.count && Number(kernel.count)) || 2000;
const POINT_SIZE = (kernel.pointSize && Number(kernel.pointSize)) || 0.05;
const POINT_COLOR = kernel.color || "#a78bfa";

const updateFn = kernel.default || kernel.update || kernel.step || kernel.simulate || kernel.tick;
const initFn = kernel.init || kernel.initialize || kernel.seed;

if (typeof updateFn !== "function") {
  document.body.innerHTML = '<div class="gx-error"><h3>kernel export missing</h3><pre>Expected: export default (positions, dt, t, params) =&gt; void</pre></div>';
  throw new Error("kernel update function missing");
}

let positions;
if (typeof initFn === "function") {
  const seed = initFn(COUNT, paramsRef);
  if (seed instanceof Float32Array) {
    positions = seed;
  } else if (Array.isArray(seed)) {
    positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < Math.min(seed.length, COUNT); i++) {
      const p = seed[i] || {};
      positions[i * 3] = Number(p.x ?? 0);
      positions[i * 3 + 1] = Number(p.y ?? 0);
      positions[i * 3 + 2] = Number(p.z ?? 0);
    }
  }
}
if (!positions) {
  positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT * 3; i++) positions[i] = (Math.random() - 0.5) * 4;
}

const root = document.getElementById("root");
const wrap = document.createElement("div");
wrap.className = "gx-root";
root.appendChild(wrap);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#050509");
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
wrap.appendChild(renderer.domElement);

const geom = new THREE.BufferGeometry();
const attr = new THREE.BufferAttribute(positions, 3);
geom.setAttribute("position", attr);
const mat = new THREE.PointsMaterial({
  size: POINT_SIZE,
  color: POINT_COLOR,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const points = new THREE.Points(geom, mat);
scene.add(points);
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const pl = new THREE.PointLight(0xffffff, 0.6);
pl.position.set(5, 5, 5);
scene.add(pl);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

mountSidebar(wrap);

const clock = new THREE.Clock();
function tick() {
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();
  updateFn(positions, dt, t, paramsRef);
  attr.needsUpdate = true;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
`;

const CHART_RUNTIME = `
const computeFn = kernel.default || kernel.compute || kernel.simulate || kernel.run || kernel.generate;
if (typeof computeFn !== "function") {
  document.body.innerHTML = '<div class="gx-error"><h3>kernel export missing</h3><pre>Expected: export default (params) =&gt; Array&lt;Record&lt;string, number&gt;&gt;</pre></div>';
  throw new Error("kernel compute function missing");
}

const COLORS = ["#a78bfa", "#22d3ee", "#60a5fa", "#f472b6", "#34d399", "#fbbf24"];
const root = document.getElementById("root");
const wrap = document.createElement("div");
wrap.className = "gx-root";
wrap.style.padding = "16px";
root.appendChild(wrap);

const svgNS = "http://www.w3.org/2000/svg";
const svg = document.createElementNS(svgNS, "svg");
svg.setAttribute("width", "100%");
svg.setAttribute("height", "100%");
svg.style.display = "block";
wrap.appendChild(svg);

function render() {
  const data = computeFn(paramsRef);
  if (!Array.isArray(data) || data.length === 0) return;
  const row0 = data[0] || {};
  const keys = Object.keys(row0);
  const xKey = keys.find((k) => /^(x|t|time|step|i|n|iter|epoch|k)$/i.test(k)) || keys[0];
  const yKeys = keys.filter((k) => k !== xKey && typeof row0[k] === "number");

  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  const pad = { top: 24, right: 32, bottom: 32, left: 56 };
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;
  svg.setAttribute("viewBox", \`0 0 \${w} \${h}\`);
  svg.innerHTML = "";

  const xs = data.map((d) => Number(d[xKey] ?? 0));
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const yk of yKeys) {
    for (const d of data) {
      const v = Number(d[yk]);
      if (Number.isFinite(v)) {
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
      }
    }
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) { yMin = 0; yMax = 1; }
  if (yMin === yMax) { yMin -= 1; yMax += 1; }

  const xMap = (v) => pad.left + ((v - xMin) / (xMax - xMin || 1)) * iw;
  const yMap = (v) => pad.top + (1 - (v - yMin) / (yMax - yMin || 1)) * ih;

  // grid
  for (let i = 0; i <= 4; i++) {
    const gy = pad.top + (i / 4) * ih;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", pad.left);
    line.setAttribute("x2", w - pad.right);
    line.setAttribute("y1", gy);
    line.setAttribute("y2", gy);
    line.setAttribute("stroke", "rgba(255,255,255,0.07)");
    svg.appendChild(line);
    const tickLabel = document.createElementNS(svgNS, "text");
    tickLabel.setAttribute("x", pad.left - 6);
    tickLabel.setAttribute("y", gy + 4);
    tickLabel.setAttribute("fill", "rgba(255,255,255,0.55)");
    tickLabel.setAttribute("font-size", "11");
    tickLabel.setAttribute("text-anchor", "end");
    const v = yMax - (i / 4) * (yMax - yMin);
    tickLabel.textContent = Number.isInteger(v) ? String(v) : v.toFixed(2);
    svg.appendChild(tickLabel);
  }

  // x ticks
  for (let i = 0; i <= 4; i++) {
    const gx = pad.left + (i / 4) * iw;
    const tickLabel = document.createElementNS(svgNS, "text");
    tickLabel.setAttribute("x", gx);
    tickLabel.setAttribute("y", h - pad.bottom + 16);
    tickLabel.setAttribute("fill", "rgba(255,255,255,0.55)");
    tickLabel.setAttribute("font-size", "11");
    tickLabel.setAttribute("text-anchor", "middle");
    const v = xMin + (i / 4) * (xMax - xMin);
    tickLabel.textContent = Number.isInteger(v) ? String(v) : v.toFixed(2);
    svg.appendChild(tickLabel);
  }

  // lines
  yKeys.forEach((yk, i) => {
    const path = document.createElementNS(svgNS, "path");
    let d = "";
    for (let j = 0; j < data.length; j++) {
      const x = xMap(Number(data[j][xKey]));
      const y = yMap(Number(data[j][yk]));
      d += (j === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1) + " ";
    }
    path.setAttribute("d", d.trim());
    path.setAttribute("stroke", COLORS[i % COLORS.length]);
    path.setAttribute("stroke-width", "1.75");
    path.setAttribute("fill", "none");
    svg.appendChild(path);
  });

  // legend
  if (yKeys.length > 1) {
    const lg = document.createElementNS(svgNS, "g");
    yKeys.forEach((yk, i) => {
      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("transform", \`translate(\${pad.left + i * 110}, 12)\`);
      const sw = document.createElementNS(svgNS, "rect");
      sw.setAttribute("width", "10");
      sw.setAttribute("height", "10");
      sw.setAttribute("fill", COLORS[i % COLORS.length]);
      sw.setAttribute("rx", "2");
      const lbl = document.createElementNS(svgNS, "text");
      lbl.setAttribute("x", "14");
      lbl.setAttribute("y", "9");
      lbl.setAttribute("fill", "rgba(255,255,255,0.7)");
      lbl.setAttribute("font-size", "11");
      lbl.textContent = yk;
      g.appendChild(sw);
      g.appendChild(lbl);
      lg.appendChild(g);
    });
    svg.appendChild(lg);
  }
}

window.addEventListener("resize", render);
mountSidebar(wrap, render);
render();
`;

const CANVAS_RUNTIME = `
const initFn = kernel.init || kernel.initialize || kernel.seed;
const simulateFn = kernel.simulate || kernel.step || kernel.update || kernel.tick;
const drawFn = kernel.draw || kernel.render || kernel.default;
if (typeof drawFn !== "function") {
  document.body.innerHTML = '<div class="gx-error"><h3>kernel export missing</h3><pre>Expected: export function draw(ctx, state, frame, params) =&gt; void</pre></div>';
  throw new Error("kernel draw function missing");
}

const root = document.getElementById("root");
const wrap = document.createElement("div");
wrap.className = "gx-root";
root.appendChild(wrap);
const canvas = document.createElement("canvas");
canvas.style.display = "block";
canvas.style.width = "100vw";
canvas.style.height = "100vh";
wrap.appendChild(canvas);
const ctx = canvas.getContext("2d");

const dpr = Math.min(window.devicePixelRatio || 1, 2);
let w = 0, h = 0;
function resize() {
  w = window.innerWidth; h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener("resize", resize);

let state = typeof initFn === "function" ? initFn(paramsRef) : {};
const t0 = performance.now();
let lastT = t0;
function tick(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if (typeof simulateFn === "function") {
    const next = simulateFn(state, dt, paramsRef);
    if (next !== undefined) state = next;
  }
  ctx.fillStyle = "#050509";
  ctx.fillRect(0, 0, w, h);
  drawFn(ctx, state, { width: w, height: h, t: (now - t0) / 1000 }, paramsRef);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

mountSidebar(wrap);
`;

const MATH_RUNTIME = `
const computeFn = kernel.default || kernel.compute || kernel.evaluate || kernel.run;
if (typeof computeFn !== "function") {
  document.body.innerHTML = '<div class="gx-error"><h3>kernel export missing</h3><pre>Expected: export default (params) =&gt; Record&lt;string, number | string&gt;</pre></div>';
  throw new Error("kernel compute function missing");
}

const root = document.getElementById("root");
const wrap = document.createElement("div");
wrap.className = "gx-root";
wrap.style.padding = "40px 36px";
wrap.style.paddingRight = "316px";
wrap.style.minHeight = "100vh";
wrap.style.fontFamily = "ui-monospace, monospace";
root.appendChild(wrap);

const head = document.createElement("div");
head.style.fontSize = "11px";
head.style.letterSpacing = "0.22em";
head.style.textTransform = "uppercase";
head.style.color = "#71717a";
head.style.marginBottom = "12px";
head.textContent = "Live Results";
wrap.appendChild(head);

const grid = document.createElement("div");
grid.className = "gx-results";
wrap.appendChild(grid);

function fmtV(val) {
  if (typeof val === "number") {
    if (Number.isInteger(val)) return String(val);
    return val.toFixed(4);
  }
  return String(val);
}

function render() {
  let results;
  try { results = computeFn(paramsRef); } catch (e) { results = { error: e.message }; }
  grid.innerHTML = "";
  if (!results) return;
  for (const [k, v] of Object.entries(results)) {
    const kd = document.createElement("div");
    kd.className = "k";
    kd.textContent = k;
    const vd = document.createElement("div");
    vd.className = "v";
    vd.textContent = fmtV(v);
    grid.appendChild(kd);
    grid.appendChild(vd);
  }
}
render();
mountSidebar(wrap, render);
`;

const SIDEBAR_RUNTIME = `
function fmt(v) {
  if (Number.isInteger(v)) return String(v);
  const a = Math.abs(v);
  if (a < 0.001) return v.toExponential(2);
  if (a < 1) return v.toFixed(4);
  if (a < 100) return v.toFixed(3);
  return v.toFixed(1);
}

function resolveStep(p) {
  if (p.step) return p.step;
  if (p.type === "integer") return 1;
  const r = Math.abs(p.max - p.min);
  if (r === 0) return 0.01;
  if (r <= 1) return 0.001;
  if (r <= 10) return 0.01;
  if (r <= 100) return 0.1;
  return 1;
}

function mountSidebar(parent, onChange) {
  if (!parameters || parameters.length === 0) return;

  const toggle = document.createElement("button");
  toggle.className = "gx-sidebar-toggle";
  toggle.type = "button";
  toggle.textContent = "Hide";
  parent.appendChild(toggle);

  const aside = document.createElement("aside");
  aside.className = "gx-sidebar";
  parent.appendChild(aside);

  const title = document.createElement("div");
  title.className = "gx-sidebar-title";
  title.textContent = "Parameters";
  aside.appendChild(title);

  const valueLabels = new Map();
  function applyOpen(open) {
    aside.style.display = open ? "" : "none";
    if (open) {
      toggle.textContent = "Hide";
    } else {
      toggle.innerHTML = "";
      const t = document.createTextNode("Parameters");
      toggle.appendChild(t);
      const c = document.createElement("span");
      c.className = "gx-count";
      c.textContent = String(parameters.length);
      toggle.appendChild(c);
    }
  }
  let open = window.matchMedia("(max-width: 640px)").matches ? false : true;
  applyOpen(open);
  toggle.addEventListener("click", () => { open = !open; applyOpen(open); });

  for (const p of parameters) {
    const row = document.createElement("div");
    row.className = "gx-param";

    const head = document.createElement("div");
    head.className = "gx-param-head";
    const name = document.createElement("label");
    name.className = "gx-param-name";
    name.textContent = p.name;
    const val = document.createElement("span");
    val.className = "gx-param-value";
    val.textContent = fmt(paramsRef[p.name]);
    valueLabels.set(p.name, val);
    head.appendChild(name);
    head.appendChild(val);
    row.appendChild(head);

    if (p.description) {
      const desc = document.createElement("p");
      desc.className = "gx-param-desc";
      desc.textContent = p.description;
      row.appendChild(desc);
    }

    const range = document.createElement("input");
    range.type = "range";
    range.min = String(p.min);
    range.max = String(p.max);
    range.step = String(resolveStep(p));
    range.value = String(paramsRef[p.name]);
    range.addEventListener("input", (e) => {
      const v = Number(e.target.value);
      paramsRef[p.name] = v;
      val.textContent = fmt(v);
      if (typeof onChange === "function") onChange();
    });
    row.appendChild(range);

    const bounds = document.createElement("div");
    bounds.className = "gx-param-bounds";
    const lo = document.createElement("span"); lo.textContent = fmt(p.min);
    const hi = document.createElement("span"); hi.textContent = fmt(p.max);
    bounds.appendChild(lo); bounds.appendChild(hi);
    row.appendChild(bounds);

    aside.appendChild(row);
  }
}
`;

const FOOTER_RUNTIME = `
const footer = document.createElement("div");
footer.className = "gx-footer";
footer.textContent = "GENESIS · standalone export";
document.body.appendChild(footer);
`;

function pickRuntime(viz: VizType): string {
  switch (viz) {
    case "3d_particles":
      return PARTICLES_RUNTIME;
    case "canvas_physics":
      return CANVAS_RUNTIME;
    case "math_explorer":
      return MATH_RUNTIME;
    case "2d_chart":
    case "interactive_graph":
    case "data_dashboard":
    default:
      return CHART_RUNTIME;
  }
}

export function buildHtml(viz: VizType, dna: PaperDna): string {
  const params = safeParams(dna.parameters);
  const initialValues: Record<string, number> = {};
  for (const p of params) initialValues[p.name] = p.default_value;

  const kernelLiteral = JSON.stringify(dna.code_kernel);
  const paramsLiteral = JSON.stringify(params);
  const valuesLiteral = JSON.stringify(initialValues);

  const runtime = pickRuntime((dna.visualization_type as VizType) || "2d_chart");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(dna.title)} — GENESIS</title>
<style>${BASE_CSS}</style>
</head>
<body>
<div id="root"></div>
<script type="module">
const parameters = ${paramsLiteral};
const paramsRef = ${valuesLiteral};

const kernelSrc = ${kernelLiteral};
const kernelBlob = new Blob([kernelSrc], { type: "text/javascript" });
const kernelUrl = URL.createObjectURL(kernelBlob);
let kernel;
try {
  kernel = await import(/* @vite-ignore */ kernelUrl);
} catch (err) {
  document.body.innerHTML = '<div class="gx-error"><h3>kernel module failed to load</h3><pre>' + (err && err.message ? err.message : String(err)) + '</pre></div>';
  throw err;
} finally {
  URL.revokeObjectURL(kernelUrl);
}

${SIDEBAR_RUNTIME}

${runtime}

${FOOTER_RUNTIME}
</script>
</body>
</html>
`;
}
