import Anthropic from "@anthropic-ai/sdk";
import { sseEvent, SSE_HEADERS } from "../../_helpers";
import {
  MULTIVERSE_SYNTHESIS_SCHEMA,
  type MultiverseDna,
  type PaperLineageEntry,
} from "@/types/multiverse";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM_PROMPT = `You are GENESIS MULTIVERSE, a synthesis engine. Given 2 or 3 Paper DNAs from related papers, you must produce ONE unified Paper DNA whose kernel runs ALL source algorithms simultaneously for direct comparison.

OUTPUT REQUIREMENTS:

1. visualization_type: MUST be "2d_chart" (preferred) or "math_explorer".
   - If any source paper used 3d_particles, canvas_physics, interactive_graph, or data_dashboard, COERCE to 2d_chart by extracting the algorithm's numerical trajectory (energy over time, error over iterations, count vs. radius, etc.).
   - Use math_explorer ONLY when sources are pure equations producing scalar results.

2. code_kernel: a single ES module that runs ALL N source algorithms per call.
   - For "2d_chart" / "interactive_graph" / "data_dashboard": export default function(params): Array<Record<string, number>>. Each row contains the x-axis key (typically "x" or "t" or "step") plus ONE numeric series per source paper, prefixed by that paper's series_key. Example: [{x: 0, adam: 1.0, sgd: 1.0, rmsprop: 1.0}, {x: 1, adam: 0.81, sgd: 0.9, rmsprop: 0.85}, ...].
   - For "math_explorer": export default function(params): Record<string, number | string>. Each result key prefixed with the paper's series_key plus an underscore.
   - DO NOT use external libraries. ES module syntax only.
   - DETERMINISTIC and TERMINATING. Cap any iteration count at 5000.

3. parameters: the deduplicated UNION of source parameters.
   - When two sources share a parameter name with the same semantic meaning (e.g., "learning_rate"), MERGE them into one entry — pick the widest reasonable [min, max] range and a sensible default (geometric mean of source defaults if numeric).
   - When names collide but semantics differ, prefix with the paper's series_key (e.g., "adam_beta1", "sgd_momentum").
   - ADD a "highlight_paper" parameter of type integer with min=0, max=N-1, default=0 — the chart shell uses this to thicken one series for emphasis.
   - The "dominant_axis" field names ONE parameter the user should sweep first to see meaningful differences across algorithms (e.g., "learning_rate"). It MUST appear in the parameters list.

4. lineage: an array describing each source paper, in the same order as the input. Each entry includes paperIndex (0..N-1), title, classification, visualization_type (the SOURCE's, not the unified one), and series_key (the unique short prefix used in the kernel output for that paper, e.g., "adam", "sgd"). series_key must be lowercase, alphanumeric, no spaces, max 12 chars.

5. equations: select 3-6 of the most informative equations across all source papers. When the same equation appears in multiple papers, include it once. When papers have DIFFERENT update rules for the same quantity, include each one labeled with the paper's short name in LaTeX text mode (e.g., "x_{k+1} = x_k - \\eta \\nabla f(x_k) \\quad \\text{(SGD)}").

6. classification: pick the dominant category from the source papers.

7. core_algorithm: 2-4 sentences describing the SHARED ABSTRACTION across the source papers, then noting the differences.

8. synthesis_summary: 1-2 sentences for the lineage strip — what all these papers have in common AND what makes the comparison interesting (the punchline).

9. synthesis_strategy: "parallel" (default — all algorithms run together, comparison via multi-series chart), "switch" (pick one algorithm at a time via integer slider), or "blend" (linearly interpolate between algorithms — only use this when the algorithms genuinely admit blending, e.g., gradient-based optimizers that share update structure).

10. title: a comparison title that names the synthesis (e.g., "Adam vs SGD vs RMSprop on a Quadratic Loss").

CRITICAL: The kernel must work with the parameters you declare. Test the parameter names mentally before emitting — every name read inside code_kernel via params.NAME must appear in the parameters list with a sensible default.`;

type Body = {
  papers?: unknown;
};

type SourcePaper = {
  title: string;
  classification: string;
  core_algorithm: string;
  equations: string[];
  parameters: Array<Record<string, unknown>>;
  visualization_type: string;
  code_kernel: string;
  url?: string;
};

function isPaperDnaShape(d: unknown): d is SourcePaper {
  if (!d || typeof d !== "object") return false;
  const o = d as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    typeof o.classification === "string" &&
    typeof o.core_algorithm === "string" &&
    Array.isArray(o.equations) &&
    Array.isArray(o.parameters) &&
    typeof o.visualization_type === "string" &&
    typeof o.code_kernel === "string"
  );
}

function validateSynthesizedDna(
  input: unknown,
  expectedLineageLength: number,
): MultiverseDna | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (
    typeof o.title !== "string" ||
    typeof o.classification !== "string" ||
    typeof o.core_algorithm !== "string" ||
    typeof o.synthesis_summary !== "string" ||
    typeof o.dominant_axis !== "string" ||
    typeof o.code_kernel !== "string"
  ) {
    return null;
  }
  if (o.visualization_type !== "2d_chart" && o.visualization_type !== "math_explorer") {
    return null;
  }
  if (
    o.synthesis_strategy !== "parallel" &&
    o.synthesis_strategy !== "switch" &&
    o.synthesis_strategy !== "blend"
  ) {
    return null;
  }

  const equations = Array.isArray(o.equations)
    ? (o.equations.filter((e) => typeof e === "string") as string[])
    : [];

  const params = Array.isArray(o.parameters) ? o.parameters : [];
  const parameters: MultiverseDna["parameters"] = [];
  for (const p of params) {
    if (!p || typeof p !== "object") continue;
    const pp = p as Record<string, unknown>;
    if (
      typeof pp.name !== "string" ||
      typeof pp.default_value !== "number" ||
      typeof pp.min !== "number" ||
      typeof pp.max !== "number"
    )
      continue;
    parameters.push({
      name: pp.name,
      description: typeof pp.description === "string" ? pp.description : "",
      default_value: pp.default_value,
      min: pp.min,
      max: pp.max,
      type: typeof pp.type === "string" ? pp.type : undefined,
    });
  }

  const lineageRaw = Array.isArray(o.lineage) ? o.lineage : [];
  const lineage: PaperLineageEntry[] = [];
  for (const l of lineageRaw) {
    if (!l || typeof l !== "object") continue;
    const ll = l as Record<string, unknown>;
    if (
      typeof ll.paperIndex !== "number" ||
      typeof ll.title !== "string" ||
      typeof ll.classification !== "string" ||
      typeof ll.visualization_type !== "string" ||
      typeof ll.series_key !== "string"
    )
      continue;
    lineage.push({
      paperIndex: ll.paperIndex,
      title: ll.title,
      classification: ll.classification,
      visualization_type: ll.visualization_type,
      series_key: ll.series_key,
      url: null,
    });
  }
  if (lineage.length !== expectedLineageLength) return null;

  return {
    title: o.title,
    classification: o.classification,
    core_algorithm: o.core_algorithm,
    equations,
    parameters,
    visualization_type: o.visualization_type as "2d_chart" | "math_explorer",
    code_kernel: o.code_kernel,
    lineage,
    synthesis_strategy: o.synthesis_strategy,
    synthesis_summary: o.synthesis_summary,
    dominant_axis: o.dominant_axis,
  };
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.papers) || body.papers.length < 2 || body.papers.length > 3) {
    return Response.json(
      { error: "Provide an array of 2 or 3 paperDna objects in the 'papers' field" },
      { status: 400 },
    );
  }

  const papers: SourcePaper[] = [];
  for (const p of body.papers) {
    if (!isPaperDnaShape(p)) {
      return Response.json(
        { error: "Each entry in 'papers' must be a valid PaperDna" },
        { status: 400 },
      );
    }
    papers.push(p);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          /* client disconnected */
        }
      };

      try {
        send("status", {
          message: `Synthesizing ${papers.length} papers into one unified visualization…`,
        });

        const userContent = [
          `Synthesize the following ${papers.length} papers into ONE unified Paper DNA.`,
          "",
          ...papers.flatMap((p, i) => [
            `=== Paper ${i} ===`,
            `Title: ${p.title}`,
            `Classification: ${p.classification}`,
            `Source visualization type: ${p.visualization_type}`,
            `Core algorithm: ${p.core_algorithm}`,
            `Equations:`,
            ...p.equations.map((e) => `  • ${e}`),
            `Parameters:`,
            ...p.parameters.map((pp) => {
              const o = pp as Record<string, unknown>;
              return `  • ${String(o.name)}: default=${String(o.default_value)} range=[${String(o.min)}, ${String(o.max)}] — ${String(o.description ?? "")}`;
            }),
            `Source kernel:`,
            "```js",
            p.code_kernel,
            "```",
            "",
          ]),
          "",
          "Produce the unified MultiverseDna per the schema. Choose visualization_type=2d_chart unless every source is a math_explorer. Pick stable, lowercase series_keys. Return ONLY the JSON.",
        ].join("\n");

        // Stream so the synthesis panel can show progress; we still
        // accumulate and JSON-parse the full result at the end.
        const synthesisStream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 16000,
          system: SYSTEM_PROMPT,
          output_config: {
            effort: "high",
            format: {
              type: "json_schema",
              schema: MULTIVERSE_SYNTHESIS_SCHEMA,
            },
          },
          messages: [{ role: "user", content: userContent }],
        });

        let acc = "";
        for await (const event of synthesisStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            acc += event.delta.text;
            send("synthesis_delta", { text: event.delta.text });
          }
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(acc);
        } catch (e) {
          throw new Error(`Synthesis JSON parse failed: ${(e as Error).message}`);
        }

        const dna = validateSynthesizedDna(parsed, papers.length);
        if (!dna) {
          throw new Error(
            "Synthesizer returned an invalid MultiverseDna shape (validation failed against schema).",
          );
        }

        // Reattach url field on lineage entries from the request payload order.
        for (let i = 0; i < dna.lineage.length; i++) {
          dna.lineage[i].url = papers[i].url ?? null;
        }

        send("done", { multiverseDna: dna });
        controller.close();
      } catch (err) {
        const message =
          err instanceof Anthropic.APIError
            ? `Claude API ${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        send("error", { message });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
