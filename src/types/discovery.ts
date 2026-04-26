export type ObservationShape = "rows" | "record" | "snapshots" | "particles";

export type SeriesStat = {
  min: number;
  max: number;
  mean: number;
  final: number;
  monotonic: "increasing" | "decreasing" | "neither";
  diverged: boolean;
  oscillation_count: number;
};

export type KernelObservation = {
  ok: boolean;
  shape?: ObservationShape;
  rowCount?: number;
  series?: Record<string, SeriesStat>;
  scalars?: Record<string, number | string>;
  errors?: string[];
  durationMs?: number;
};

export type Discovery = {
  id: string;
  title: string;
  description: string;
  parameters: Record<string, number>;
  novelty_score: number; // 0..1
  category:
    | "phase_transition"
    | "chaos_boundary"
    | "optimal_point"
    | "edge_of_stability"
    | "surprising_stability"
    | "resonance"
    | "other";
};

export type DiscoveryProbe = {
  id: string;
  parameters: Record<string, number>;
  rationale: string;
  observation: KernelObservation | null; // null while running
};

export const DISCOVERY_SUBMIT_SCHEMA = {
  type: "object",
  properties: {
    discoveries: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          parameters: {
            type: "object",
            additionalProperties: { type: "number" },
          },
          novelty_score: { type: "number" },
          category: {
            type: "string",
            enum: [
              "phase_transition",
              "chaos_boundary",
              "optimal_point",
              "edge_of_stability",
              "surprising_stability",
              "resonance",
              "other",
            ],
          },
        },
        required: [
          "title",
          "description",
          "parameters",
          "novelty_score",
          "category",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["discoveries"],
  additionalProperties: false,
} as const;

export const RUN_KERNEL_SCHEMA = {
  type: "object",
  properties: {
    parameters: {
      type: "object",
      additionalProperties: { type: "number" },
    },
    rationale: {
      type: "string",
      description:
        "One short sentence explaining what hypothesis this probe is testing.",
    },
  },
  required: ["parameters", "rationale"],
  additionalProperties: false,
} as const;

export function validateDiscoveriesPayload(
  raw: unknown,
  paramSchemaNames: Set<string>,
): { ok: true; discoveries: Discovery[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["Tool input is not an object."] };
  }
  const arr = (raw as { discoveries?: unknown }).discoveries;
  if (!Array.isArray(arr)) {
    return { ok: false, errors: ["Missing 'discoveries' array."] };
  }
  if (arr.length === 0) {
    return { ok: false, errors: ["No discoveries provided."] };
  }

  const out: Discovery[] = [];
  for (let i = 0; i < arr.length; i++) {
    const r = arr[i];
    if (!r || typeof r !== "object") {
      errors.push(`Discovery ${i} is not an object.`);
      continue;
    }
    const d = r as Record<string, unknown>;
    if (typeof d.title !== "string" || d.title.length === 0) {
      errors.push(`Discovery ${i} missing string 'title'.`);
      continue;
    }
    if (typeof d.description !== "string" || d.description.length === 0) {
      errors.push(`Discovery ${i} missing string 'description'.`);
      continue;
    }
    if (!d.parameters || typeof d.parameters !== "object") {
      errors.push(`Discovery ${i} missing 'parameters' object.`);
      continue;
    }
    const params: Record<string, number> = {};
    for (const [k, v] of Object.entries(d.parameters as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        params[k] = v;
      }
    }
    // At least one declared parameter must appear
    let touched = 0;
    for (const k of Object.keys(params)) {
      if (paramSchemaNames.has(k)) touched++;
    }
    if (touched === 0) {
      errors.push(
        `Discovery ${i} parameters reference no known parameter from the schema.`,
      );
      continue;
    }
    const novelty =
      typeof d.novelty_score === "number" && Number.isFinite(d.novelty_score)
        ? Math.max(0, Math.min(1, d.novelty_score))
        : 0.5;
    const category =
      typeof d.category === "string" &&
      [
        "phase_transition",
        "chaos_boundary",
        "optimal_point",
        "edge_of_stability",
        "surprising_stability",
        "resonance",
        "other",
      ].includes(d.category)
        ? (d.category as Discovery["category"])
        : "other";
    out.push({
      id: `disc-${i + 1}`,
      title: d.title.slice(0, 120),
      description: d.description.slice(0, 600),
      parameters: params,
      novelty_score: novelty,
      category,
    });
  }

  if (out.length === 0) {
    return { ok: false, errors: errors.length ? errors : ["No valid discoveries."] };
  }
  return { ok: true, discoveries: out };
}
