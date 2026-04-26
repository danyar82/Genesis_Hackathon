import type { PaperDna } from "@/components/SandpackExecutor";

export type SynthesisStrategy =
  | "parallel" // run all source algorithms simultaneously, return multi-series rows
  | "switch" // run one source at a time, selected by an integer slider
  | "blend"; // continuous interpolation between adjacent algorithms

export type PaperLineageEntry = {
  paperIndex: number;
  title: string;
  classification: string;
  visualization_type: string;
  url: string | null;
  series_key: string; // unique key prefix used in the unified kernel output
};

/**
 * A MultiverseDna IS a PaperDna (so it flows through Sandpack and history
 * unchanged) plus the lineage + synthesis metadata used by the lineage
 * strip in the live header.
 */
export type MultiverseDna = PaperDna & {
  lineage: PaperLineageEntry[];
  synthesis_strategy: SynthesisStrategy;
  synthesis_summary: string;
  dominant_axis: string;
};

export const MULTIVERSE_SYNTHESIS_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    classification: { type: "string" },
    core_algorithm: { type: "string" },
    synthesis_summary: { type: "string" },
    synthesis_strategy: {
      type: "string",
      enum: ["parallel", "switch", "blend"],
    },
    dominant_axis: { type: "string" },
    visualization_type: {
      type: "string",
      enum: ["2d_chart", "math_explorer"],
    },
    equations: {
      type: "array",
      items: { type: "string" },
    },
    parameters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          default_value: { type: "number" },
          min: { type: "number" },
          max: { type: "number" },
          type: { type: "string" },
        },
        required: ["name", "default_value", "min", "max"],
        additionalProperties: false,
      },
    },
    lineage: {
      type: "array",
      items: {
        type: "object",
        properties: {
          paperIndex: { type: "number" },
          title: { type: "string" },
          classification: { type: "string" },
          visualization_type: { type: "string" },
          series_key: { type: "string" },
        },
        required: [
          "paperIndex",
          "title",
          "classification",
          "visualization_type",
          "series_key",
        ],
        additionalProperties: false,
      },
    },
    code_kernel: { type: "string" },
  },
  required: [
    "title",
    "classification",
    "core_algorithm",
    "synthesis_summary",
    "synthesis_strategy",
    "dominant_axis",
    "visualization_type",
    "equations",
    "parameters",
    "lineage",
    "code_kernel",
  ],
  additionalProperties: false,
} as const;

export function isMultiverseDna(dna: PaperDna): dna is MultiverseDna {
  const x = dna as MultiverseDna;
  return (
    Array.isArray(x.lineage) &&
    x.lineage.length >= 2 &&
    typeof x.synthesis_summary === "string" &&
    typeof x.synthesis_strategy === "string"
  );
}
