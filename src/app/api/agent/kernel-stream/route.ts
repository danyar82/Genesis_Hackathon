import Anthropic from "@anthropic-ai/sdk";
import { sseEvent, SSE_HEADERS } from "../_helpers";

export const runtime = "nodejs";
export const maxDuration = 90;

const STREAM_KERNEL_PROMPT = `You are showcasing a JavaScript algorithm kernel for an interactive paper visualization. You will receive an existing working kernel. Your job is to reproduce it with brief inline comments that explain the KEY decisions: math constants, edge cases, parameter mappings, why a coefficient was chosen.

Strict rules:
- Do NOT change exports or function signatures.
- Do NOT change behavior — same outputs for the same inputs.
- Output ONLY the final code with comments. No markdown fences. No preamble. No trailing prose.
- Keep it concise. One-line comments where they help; skip them where the code is obvious.`;

type Body = {
  kernel?: unknown;
  vizType?: unknown;
  title?: unknown;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const kernel = typeof body.kernel === "string" ? body.kernel : null;
  const vizType = typeof body.vizType === "string" ? body.vizType : "";
  const title = typeof body.title === "string" ? body.title : "";

  if (!kernel) {
    return Response.json(
      { error: "Missing or invalid 'kernel' in request body" },
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
  const encoder = new TextEncoder();

  const userContent = [
    `Visualization type: ${vizType || "(unknown)"}`,
    `Paper: ${title || "(untitled)"}`,
    "",
    "Original kernel:",
    "---",
    kernel,
    "---",
    "",
    "Reproduce the kernel verbatim, inserting brief inline comments where they aid understanding. Same exports, same behavior.",
  ].join("\n");

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
        const claudeStream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 16000,
          system: STREAM_KERNEL_PROMPT,
          messages: [{ role: "user", content: userContent }],
        });

        let acc = "";
        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            acc += event.delta.text;
            send("kernel_delta", { text: event.delta.text, total: acc.length });
          }
        }
        send("kernel_done", { code: acc });
      } catch (err) {
        const message =
          err instanceof Anthropic.APIError
            ? `Claude API ${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
