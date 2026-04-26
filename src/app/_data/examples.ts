import type { PaperDna } from "@/components/SandpackExecutor";

export type ExampleDomain =
  | "physics"
  | "ml"
  | "economics"
  | "biology"
  | "math";

export type CuratedExample = {
  slug: string;
  domain: ExampleDomain;
  cardTitle: string;
  cardTag: string;
  paperDna: PaperDna;
};

const NBODY_KERNEL = `const velocities = new Float32Array(2400);
const masses = new Float32Array(800);
let initialized = false;

export const count = 800;
export const pointSize = 0.042;

export function init(n) {
  const N = Math.min(n, 800);
  const positions = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = Math.cbrt(Math.random()) * 2.6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi) * 0.35;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    velocities[i * 3] = -y * 0.9;
    velocities[i * 3 + 1] = x * 0.9;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
    masses[i] = 0.6 + Math.random() * 0.8;
  }
  initialized = true;
  return positions;
}

export default function update(positions, dt, t, params) {
  if (!initialized) return;
  const n = positions.length / 3;
  const g = params?.gravity ?? 0.6;
  const damping = params?.damping ?? 0.002;
  const softening = 0.3;
  const step = Math.min(dt, 0.033);

  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    cx += positions[i * 3];
    cy += positions[i * 3 + 1];
    cz += positions[i * 3 + 2];
  }
  cx /= n; cy /= n; cz /= n;

  for (let i = 0; i < n; i++) {
    const dx = cx - positions[i * 3];
    const dy = cy - positions[i * 3 + 1];
    const dz = cz - positions[i * 3 + 2];
    const r2 = dx * dx + dy * dy + dz * dz + softening;
    const invR = 1 / Math.sqrt(r2);
    const invR3 = invR * invR * invR;
    const force = g * masses[i] * invR3;

    velocities[i * 3] += dx * force * step;
    velocities[i * 3 + 1] += dy * force * step;
    velocities[i * 3 + 2] += dz * force * step;

    velocities[i * 3] *= 1 - damping;
    velocities[i * 3 + 1] *= 1 - damping;
    velocities[i * 3 + 2] *= 1 - damping;

    positions[i * 3] += velocities[i * 3] * step;
    positions[i * 3 + 1] += velocities[i * 3 + 1] * step;
    positions[i * 3 + 2] += velocities[i * 3 + 2] * step;
  }
}
`;

const SGD_KERNEL = `export default function compute(params) {
  const lr = params?.learning_rate ?? 0.015;
  const momentum = params?.momentum ?? 0.85;
  const noise = params?.noise ?? 0.12;
  const steps = Math.max(10, Math.floor(params?.steps ?? 200));

  let x = 2.2, y = -2.0;
  let vx = 0, vy = 0;
  const data = [];

  for (let i = 0; i <= steps; i++) {
    const loss = (x - 1) * (x - 1) + 10 * (y - x * x) * (y - x * x);
    data.push({
      step: i,
      loss: Number(loss.toFixed(4)),
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
    });
    const gx = 2 * (x - 1) - 40 * x * (y - x * x);
    const gy = 20 * (y - x * x);
    vx = momentum * vx - lr * gx + (Math.random() - 0.5) * noise * lr;
    vy = momentum * vy - lr * gy + (Math.random() - 0.5) * noise * lr;
    x = Math.max(-4, Math.min(4, x + vx));
    y = Math.max(-4, Math.min(4, y + vy));
  }
  return data;
}
`;

const COBWEB_KERNEL = `export default function compute(params) {
  const demandSlope = params?.demand_slope ?? 1.4;
  const supplySlope = params?.supply_slope ?? 1.0;
  const shockAmp = params?.shock_amplitude ?? 1.5;
  const steps = Math.max(5, Math.floor(params?.time_steps ?? 60));

  const data = [];
  let price = 7.5;
  let prevPrice = 5;

  for (let t = 0; t <= steps; t++) {
    const shock = shockAmp * Math.sin(t * 0.18);
    const demand = Math.max(0, 12 - demandSlope * price + shock);
    const supply = Math.max(0, -1 + supplySlope * prevPrice);
    const equilibrium = (12 + 1) / (demandSlope + supplySlope);

    data.push({
      t,
      price: Number(price.toFixed(2)),
      demand: Number(demand.toFixed(2)),
      supply: Number(supply.toFixed(2)),
      equilibrium: Number(equilibrium.toFixed(2)),
    });

    prevPrice = price;
    // Cobweb update: price adjusts to clear market given lagged supply
    price = (12 + 1 + shock - supply + demand) / (demandSlope + supplySlope + 0.5);
    price = Math.max(0.1, price);
  }
  return data;
}
`;

const LOTKA_KERNEL = `export default function compute(params) {
  const alpha = params?.prey_growth ?? 1.0;
  const beta = params?.predation_rate ?? 0.1;
  const gamma = params?.predator_death ?? 0.6;
  const delta = params?.predator_growth ?? 0.04;
  const steps = Math.max(50, Math.floor(params?.time_steps ?? 800));
  const dt = 0.03;

  let prey = 40;
  let predator = 9;
  const data = [];

  for (let i = 0; i <= steps; i++) {
    if (i % 4 === 0) {
      data.push({
        time: Number((i * dt).toFixed(2)),
        prey: Number(prey.toFixed(2)),
        predator: Number(predator.toFixed(2)),
      });
    }
    const dPrey = alpha * prey - beta * prey * predator;
    const dPred = delta * prey * predator - gamma * predator;
    prey = Math.max(0.05, prey + dPrey * dt);
    predator = Math.max(0.05, predator + dPred * dt);
  }
  return data;
}
`;

const MANDELBROT_KERNEL = `let cached = null;
let cachedKey = "";

export function init() {
  return {};
}

export function simulate(state) {
  return state;
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [((r + m) * 255) | 0, ((g + m) * 255) | 0, ((b + m) * 255) | 0];
}

export function draw(ctx, state, frame, params) {
  const w = frame.width;
  const h = frame.height;
  const maxIter = Math.max(16, Math.floor(params?.max_iterations ?? 96));
  const zoom = params?.zoom ?? 1.0;
  const cx = params?.center_x ?? -0.5;
  const cy = params?.center_y ?? 0;
  const key = \`\${w}x\${h}|\${maxIter}|\${zoom.toFixed(3)}|\${cx.toFixed(4)}|\${cy.toFixed(4)}\`;

  if (cachedKey === key && cached) {
    ctx.putImageData(cached, 0, 0);
    return;
  }

  const img = ctx.createImageData(w, h);
  const px = img.data;
  const scale = 3.2 / (Math.min(w, h) * zoom);

  for (let py = 0; py < h; py++) {
    for (let pxi = 0; pxi < w; pxi++) {
      const cr = (pxi - w / 2) * scale + cx;
      const ci = (py - h / 2) * scale + cy;
      let zr = 0, zi = 0, iter = 0;
      while (iter < maxIter && zr * zr + zi * zi < 4) {
        const nzr = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
        zr = nzr;
        iter++;
      }
      const idx = (py * w + pxi) * 4;
      if (iter === maxIter) {
        px[idx] = 5; px[idx + 1] = 5; px[idx + 2] = 18; px[idx + 3] = 255;
      } else {
        const t = iter / maxIter;
        const hue = 260 + t * 180;
        const [r, g, b] = hslToRgb(hue % 360, 0.7, 0.35 + t * 0.35);
        px[idx] = r; px[idx + 1] = g; px[idx + 2] = b; px[idx + 3] = 255;
      }
    }
  }

  cached = img;
  cachedKey = key;
  ctx.putImageData(img, 0, 0);
}
`;

export const CURATED_EXAMPLES: CuratedExample[] = [
  {
    slug: "physics-nbody",
    domain: "physics",
    cardTitle: "N-Body Gravitational Dynamics",
    cardTag: "Physics · Particle Simulation",
    paperDna: {
      title: "N-Body Gravitational Dynamics: Orbital Evolution of Self-Gravitating Point Masses",
      classification: "physics_engine",
      core_algorithm:
        "Integrates Newton's law of universal gravitation over a cloud of N point masses. Each particle accelerates toward the system's center of mass at a rate proportional to 1/r², producing orbital rotations, infall, and disk-like structures. Uses a softened-potential approximation and explicit Euler integration for stability.",
      equations: [
        "F_{ij} = G \\cdot \\frac{m_i m_j}{(r_{ij}^2 + \\epsilon^2)^{3/2}} \\cdot \\hat{r}_{ij}",
        "a_i = \\sum_{j \\neq i} \\frac{G m_j (r_j - r_i)}{(|r_j - r_i|^2 + \\epsilon^2)^{3/2}}",
        "v_i(t + \\Delta t) = (1 - \\gamma) v_i(t) + a_i(t) \\Delta t",
        "r_i(t + \\Delta t) = r_i(t) + v_i(t + \\Delta t) \\Delta t",
      ],
      parameters: [
        {
          name: "gravity",
          description: "Gravitational constant G scaling the attractive force.",
          min: 0.1,
          max: 2.0,
          default_value: 0.6,
          type: "number",
        },
        {
          name: "damping",
          description: "Velocity damping per step (γ). Higher values pull particles into a denser core.",
          min: 0.0,
          max: 0.05,
          default_value: 0.002,
          type: "number",
        },
      ],
      visualization_type: "3d_particles",
      code_kernel: NBODY_KERNEL,
    },
  },
  {
    slug: "ml-sgd",
    domain: "ml",
    cardTitle: "Gradient Descent on a Rosenbrock Loss",
    cardTag: "Machine Learning · Training Dynamics",
    paperDna: {
      title:
        "Gradient Descent with Momentum: Convergence Dynamics on the Rosenbrock Loss Landscape",
      classification: "neural_network",
      core_algorithm:
        "Simulates stochastic gradient descent with momentum on the classic Rosenbrock benchmark — a non-convex loss with a narrow curved valley. The method demonstrates how learning rate, momentum, and injected noise interact to determine whether an optimizer overshoots, oscillates, or converges to the global minimum at (1, 1).",
      equations: [
        "\\mathcal{L}(x, y) = (x - 1)^2 + 10(y - x^2)^2",
        "g_t = \\nabla \\mathcal{L}(x_t, y_t)",
        "v_{t+1} = \\mu v_t - \\eta g_t + \\xi_t",
        "\\theta_{t+1} = \\theta_t + v_{t+1}",
        "\\xi_t \\sim \\mathcal{U}(-\\sigma \\eta, \\sigma \\eta)",
      ],
      parameters: [
        {
          name: "learning_rate",
          description: "Step size η applied to each gradient update.",
          min: 0.001,
          max: 0.05,
          default_value: 0.015,
          type: "number",
        },
        {
          name: "momentum",
          description: "Momentum coefficient μ — history of past gradients.",
          min: 0.0,
          max: 0.99,
          default_value: 0.85,
          type: "number",
        },
        {
          name: "noise",
          description: "Injected gradient noise σ (stochasticity scale).",
          min: 0.0,
          max: 0.8,
          default_value: 0.12,
          type: "number",
        },
        {
          name: "steps",
          description: "Number of optimization iterations.",
          min: 50,
          max: 600,
          default_value: 200,
          type: "integer",
        },
      ],
      visualization_type: "2d_chart",
      code_kernel: SGD_KERNEL,
    },
  },
  {
    slug: "econ-cobweb",
    domain: "economics",
    cardTitle: "Cobweb Supply & Demand Equilibrium",
    cardTag: "Economics · Market Dynamics",
    paperDna: {
      title:
        "The Cobweb Model: Price Dynamics Under Lagged Supply and Elastic Demand",
      classification: "economic_model",
      core_algorithm:
        "Iterates the textbook cobweb market model: demand responds instantly to the current price while supply depends on the previous period's price. Introducing a periodic demand shock exposes stable, neutrally stable, and divergent regimes as a function of the two slope parameters — a canonical illustration of how time lags generate endogenous price cycles.",
      equations: [
        "Q_d(t) = a - b_d \\cdot P(t) + s \\sin(\\omega t)",
        "Q_s(t) = -c + b_s \\cdot P(t - 1)",
        "Q_d(t) = Q_s(t)",
        "P^* = \\frac{a + c}{b_d + b_s}",
      ],
      parameters: [
        {
          name: "demand_slope",
          description: "Slope of the demand curve b_d. Higher values mean more elastic demand.",
          min: 0.3,
          max: 3.0,
          default_value: 1.4,
          type: "number",
        },
        {
          name: "supply_slope",
          description: "Slope of the lagged supply curve b_s.",
          min: 0.2,
          max: 2.5,
          default_value: 1.0,
          type: "number",
        },
        {
          name: "shock_amplitude",
          description: "Amplitude of the sinusoidal demand shock s.",
          min: 0.0,
          max: 4.0,
          default_value: 1.5,
          type: "number",
        },
        {
          name: "time_steps",
          description: "Number of market periods to simulate.",
          min: 20,
          max: 200,
          default_value: 60,
          type: "integer",
        },
      ],
      visualization_type: "2d_chart",
      code_kernel: COBWEB_KERNEL,
    },
  },
  {
    slug: "bio-lotka-volterra",
    domain: "biology",
    cardTitle: "Lotka–Volterra Predator–Prey",
    cardTag: "Biology · Population Dynamics",
    paperDna: {
      title:
        "Lotka–Volterra Dynamics: Oscillatory Coupling Between Predator and Prey Populations",
      classification: "simulation",
      core_algorithm:
        "Numerically integrates the Lotka–Volterra ordinary differential equations using explicit Euler steps. Prey grow exponentially in isolation and are culled proportionally to interactions with predators; predators decay without food and grow proportionally to successful predation events. The coupling produces the signature lagged oscillations observed in classic ecological data (e.g. lynx–hare cycles).",
      equations: [
        "\\frac{dN}{dt} = \\alpha N - \\beta N P",
        "\\frac{dP}{dt} = \\delta N P - \\gamma P",
        "H = \\delta N - \\gamma \\ln(N) + \\beta P - \\alpha \\ln(P)",
      ],
      parameters: [
        {
          name: "prey_growth",
          description: "Prey intrinsic growth rate α.",
          min: 0.1,
          max: 2.0,
          default_value: 1.0,
          type: "number",
        },
        {
          name: "predation_rate",
          description: "Predation rate β — prey removed per predator encounter.",
          min: 0.02,
          max: 0.4,
          default_value: 0.1,
          type: "number",
        },
        {
          name: "predator_death",
          description: "Predator natural death rate γ.",
          min: 0.1,
          max: 1.5,
          default_value: 0.6,
          type: "number",
        },
        {
          name: "predator_growth",
          description: "Predator growth δ per predation event (energy conversion).",
          min: 0.005,
          max: 0.15,
          default_value: 0.04,
          type: "number",
        },
      ],
      visualization_type: "2d_chart",
      code_kernel: LOTKA_KERNEL,
    },
  },
  {
    slug: "math-mandelbrot",
    domain: "math",
    cardTitle: "Mandelbrot Set · Escape-Time Fractal",
    cardTag: "Mathematics · Complex Dynamics",
    paperDna: {
      title:
        "The Mandelbrot Set: Escape-Time Iteration and Self-Similarity in the Complex Plane",
      classification: "mathematical_proof",
      core_algorithm:
        "For each pixel mapped to a complex number c, iterates the recurrence z → z² + c starting from z = 0 and records how many steps it takes for |z| to exceed 2. Pixels whose iteration never escapes within the iteration budget belong (approximately) to the Mandelbrot set. The resulting boundary is the most famous self-similar fractal in mathematics — its Hausdorff dimension is 2.",
      equations: [
        "z_{n+1} = z_n^2 + c, \\quad z_0 = 0",
        "M = \\{ c \\in \\mathbb{C} : \\sup_n |z_n| \\le 2 \\}",
        "\\dim_H(\\partial M) = 2",
      ],
      parameters: [
        {
          name: "max_iterations",
          description: "Iteration budget per pixel. Higher = more fractal detail but slower.",
          min: 32,
          max: 400,
          default_value: 96,
          type: "integer",
        },
        {
          name: "zoom",
          description: "Zoom factor into the complex plane.",
          min: 0.3,
          max: 50,
          default_value: 1.0,
          type: "number",
        },
        {
          name: "center_x",
          description: "Real part of the viewport center (Re c).",
          min: -2.0,
          max: 1.0,
          default_value: -0.5,
          type: "number",
        },
        {
          name: "center_y",
          description: "Imaginary part of the viewport center (Im c).",
          min: -1.5,
          max: 1.5,
          default_value: 0,
          type: "number",
        },
      ],
      visualization_type: "canvas_physics",
      code_kernel: MANDELBROT_KERNEL,
    },
  },
];

export function getExampleBySlug(slug: string): CuratedExample | null {
  return CURATED_EXAMPLES.find((e) => e.slug === slug) ?? null;
}
