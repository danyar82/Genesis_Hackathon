import type { PaperDna } from "./paperDna";

/** Where a Frontier source paper was discovered. */
export type FrontierSearchOrigin = "arxiv" | "openalex";

/** A single source paper that contributed to the Frontier synthesis. The
 * server fills the canonical fields (title, url, ids, search origin); Opus
 * fills `relevance_note` during synthesis to explain how each paper informed
 * the hybrid kernel. */
export type FrontierSource = {
  paperIndex: number;
  title: string;
  authors: string[];
  url: string | null;
  arxiv_id: string | null;
  doi: string | null;
  search_origin: FrontierSearchOrigin;
  /** 1-line note from Opus explaining what this paper contributed. */
  relevance_note: string;
};

/** A PaperDna produced by the Frontier pipeline. Adds metadata about the
 * natural-language research problem and which papers fed the synthesis. */
export type FrontierDna = PaperDna & {
  research_problem: string;
  synthesis_summary: string;
  frontier_sources: FrontierSource[];
};

export function isFrontierDna(dna: PaperDna): dna is FrontierDna {
  const x = dna as FrontierDna;
  return (
    Array.isArray(x.frontier_sources) &&
    x.frontier_sources.length >= 1 &&
    typeof x.research_problem === "string" &&
    typeof x.synthesis_summary === "string"
  );
}

/** JSON schema fragment for what Opus should return — only the fields it
 * generates (server enriches the rest before emitting to the client). */
export const FRONTIER_SYNTHESIS_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    classification: {
      type: "string",
      enum: [
        "simulation",
        "optimization",
        "statistical_model",
        "neural_network",
        "physics_engine",
        "economic_model",
        "mathematical_proof",
        "data_visualization",
      ],
    },
    core_algorithm: { type: "string" },
    equations: { type: "array", items: { type: "string" } },
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
        required: [
          "name",
          "description",
          "default_value",
          "min",
          "max",
          "type",
        ],
        additionalProperties: false,
      },
    },
    visualization_type: {
      type: "string",
      enum: [
        "3d_particles",
        "2d_chart",
        "interactive_graph",
        "canvas_physics",
        "math_explorer",
        "data_dashboard",
      ],
    },
    code_kernel: { type: "string" },
    research_problem: { type: "string" },
    synthesis_summary: { type: "string" },
    relevance_notes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          paperIndex: { type: "number" },
          title: { type: "string" },
          relevance_note: { type: "string" },
        },
        required: ["paperIndex", "title", "relevance_note"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "title",
    "classification",
    "core_algorithm",
    "equations",
    "parameters",
    "visualization_type",
    "code_kernel",
    "research_problem",
    "synthesis_summary",
    "relevance_notes",
  ],
  additionalProperties: false,
} as const;
