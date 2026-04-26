import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const HEAL_SYSTEM_PROMPT = `You are a code healer for an in-browser code sandbox. The user's generated code produced an error when executed in a Sandpack iframe. Analyze the error and return the COMPLETE fixed code.

Rules:
- Return ONLY the complete fixed source of the same module (not a diff, not a snippet, not markdown fences).
- Keep the same public exports and overall shape unless the error is specifically about the export shape.
- The code runs in a browser iframe via Sandpack — no Node.js APIs, no 'require', no 'fs'. ES module syntax only.
- If the error says an export is missing, add it with a reasonable implementation derived from what's already there.
- Never return an empty module.`;

const SIGNATURE_HINTS: Record<string, string> = {
  "3d_particles":
    "Expected: `export default function(positions: Float32Array, dt: number, t: number): void` that mutates positions in place. Optional: `export function init(count: number): Float32Array | Array<{x,y,z}>`, `export const count: number`.",
  "2d_chart":
    "Expected: `export default function(params: Record<string, number>): Array<Record<string, number>>` returning chart data rows. Each row should have a numeric x-axis key (x, t, time, step, or i) plus 1+ numeric series keys.",
  interactive_graph:
    "Expected: `export default function(params: Record<string, number>): Array<Record<string, number>>` returning data rows.",
  data_dashboard:
    "Expected: `export default function(params: Record<string, number>): Array<Record<string, number>>` returning data rows.",
  canvas_physics:
    "Expected: `export function init(): State`, `export function simulate(state: State, dt: number): State | void`, `export function draw(ctx: CanvasRenderingContext2D, state: State, frame: { width: number; height: number; t: number }): void`.",
  math_explorer:
    "Expected: `export default function(params: Record<string, number>): Record<string, number | string>` returning named results.",
};

const HEAL_SCHEMA = {
  type: "object",
  properties: {
    code: { type: "string" },
    explanation: { type: "string" },
  },
  required: ["code", "explanation"],
  additionalProperties: false,
} as const;

type HealBody = {
  code?: unknown;
  error?: unknown;
  stackTrace?: unknown;
  vizType?: unknown;
};

export async function POST(request: Request) {
  let body: HealBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : null;
  const error = typeof body.error === "string" ? body.error : null;
  const stackTrace = typeof body.stackTrace === "string" ? body.stackTrace : "";
  const vizType = typeof body.vizType === "string" ? body.vizType : "";

  if (!code) {
    return Response.json(
      { error: "Missing or invalid 'code' in request body" },
      { status: 400 },
    );
  }
  if (!error) {
    return Response.json(
      { error: "Missing or invalid 'error' in request body" },
      { status: 400 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  const client = new Anthropic({ apiKey });

  const signatureHint =
    SIGNATURE_HINTS[vizType] ?? "Keep the same exports as the original code.";

  const userContent = [
    `Visualization type: ${vizType || "(unknown)"}`,
    `${signatureHint}`,
    "",
    `Error: ${error}`,
    stackTrace ? `Stack / frames: ${stackTrace.slice(0, 1500)}` : "",
    "",
    "Original code:",
    "---",
    code,
    "---",
    "",
    "Return the complete fixed source in the 'code' field, and a one-sentence explanation of what you changed in the 'explanation' field.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      system: HEAL_SYSTEM_PROMPT,
      output_config: {
        effort: "high",
        format: {
          type: "json_schema",
          schema: HEAL_SCHEMA,
        },
      },
      messages: [{ role: "user", content: userContent }],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    if (!textBlock) {
      return Response.json(
        { error: "Claude returned no text block" },
        { status: 502 },
      );
    }

    let parsed: { code: string; explanation: string };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch (e) {
      return Response.json(
        { error: `Failed to parse heal JSON: ${(e as Error).message}` },
        { status: 502 },
      );
    }

    if (!parsed.code || typeof parsed.code !== "string") {
      return Response.json(
        { error: "Claude returned no 'code' field" },
        { status: 502 },
      );
    }

    return Response.json({
      code: parsed.code,
      explanation: parsed.explanation ?? "",
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_read_input_tokens:
          response.usage.cache_read_input_tokens ?? 0,
      },
      stop_reason: response.stop_reason,
    });
  } catch (e) {
    const msg =
      e instanceof Anthropic.APIError
        ? `Claude ${e.status}: ${e.message}`
        : e instanceof Error
          ? e.message
          : String(e);
    return Response.json({ error: msg }, { status: 502 });
  }
}
