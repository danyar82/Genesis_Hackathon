import Anthropic from "@anthropic-ai/sdk";
import {
  fetchPaperMetadata,
  PAPER_DNA_SCHEMA,
  sseEvent,
  SSE_HEADERS,
} from "../agent/_helpers";
import { readDna, writeDna, type CachedDnaMeta } from "../_lib/dnaCache";
import {
  buildEntryFromDna,
  findExemplars,
  formatExemplarBlock,
  predictClassification,
  recordSuccess,
} from "../_lib/memoryBank";

export const runtime = "nodejs";
export const maxDuration = 120;

const EXTRACTION_SYSTEM_PROMPT = `You are a scientific algorithm extractor. Given an academic paper, extract:
- title: paper title
- classification: one of [simulation, optimization, statistical_model, neural_network, physics_engine, economic_model, mathematical_proof, data_visualization]
- core_algorithm: description of the main algorithm/concept
- equations: array of key mathematical equations in LaTeX
- parameters: array of { name, description, default_value, min, max, type }
- visualization_type: one of [3d_particles, 2d_chart, interactive_graph, canvas_physics, math_explorer, data_dashboard]
- code_kernel: working JavaScript/TypeScript code that implements the core algorithm as a pure function

Return valid JSON only.`;

export async function POST(request: Request) {
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url : null;
  if (!url) {
    return Response.json(
      { error: "Missing or invalid 'url' in request body" },
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

  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  if (!fresh) {
    const cached = await readDna(url);
    if (cached) {
      console.log(`[GENESIS] cache hit (extract): ${url}`);
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (event: string, data: unknown) => {
            try {
              controller.enqueue(encoder.encode(sseEvent(event, data)));
            } catch {
              /* client disconnected */
            }
          };
          send("status", { message: "Cached — replaying…", cached: true });
          send("done", { paperDna: cached.paperDna });
          controller.close();
        },
      });
      return new Response(stream, { headers: SSE_HEADERS });
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      try {
        send("status", {
          phase: "fetching",
          message: "Fetching paper metadata…",
          url,
        });

        const paper = await fetchPaperMetadata(url);
        const capturedMeta: CachedDnaMeta = {
          title: paper.title,
          authors: paper.authors,
          categories: paper.categories,
          abstract_length: paper.abstract.length,
        };

        send("status", {
          phase: "analyzing",
          message: "Paper fetched — extracting with Claude Opus 4.7…",
          paper: {
            title: paper.title,
            authors: paper.authors,
            categories: paper.categories,
            abstractLength: paper.abstract.length,
          },
        });

        const client = new Anthropic({ apiKey });

        // ── GENESIS MEMORY · few-shot anchoring ──────────────────────────
        // Predict the GENESIS classification cheaply from arXiv tags +
        // title/abstract keywords, look up exemplars in the same category,
        // and prepend them to the system prompt. The base prompt and the
        // exemplar block each get an `ephemeral` cache_control marker so
        // Anthropic prompt-caches the prefix — back-to-back extractions in
        // the same category amortize the input tokens at ~10% cost.
        const predictedClassification = predictClassification(paper);
        const exemplars = await findExemplars(predictedClassification, 2);
        const exemplarBlock = formatExemplarBlock(exemplars);
        if (exemplars.length > 0) {
          send("status", {
            phase: "memory",
            message: `GENESIS Memory · ${exemplars.length} exemplar${exemplars.length > 1 ? "s" : ""} loaded${
              predictedClassification ? ` for ${predictedClassification}` : ""
            }`,
            exemplars: exemplars.map((e) => ({
              title: e.title,
              classification: e.classification,
            })),
            predictedClassification,
          });
        }

        const systemBlocks: Anthropic.TextBlockParam[] = [
          {
            type: "text",
            text: EXTRACTION_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ];
        if (exemplarBlock) {
          systemBlocks.push({
            type: "text",
            text: exemplarBlock,
            cache_control: { type: "ephemeral" },
          });
        }

        const userContent = [
          `Paper Title: ${paper.title}`,
          `Authors: ${paper.authors.join(", ")}`,
          `Categories: ${paper.categories.join(", ")}`,
          `Source provenance: ${paper.source ?? "unknown"}`,
          "",
          "Abstract:",
          paper.abstract,
          ...(paper.body
            ? [
                "",
                "--- FULL PAPER BODY (truncated if long; argue from THIS, not from speculation) ---",
                paper.body.slice(0, 120_000),
                "--- END PAPER BODY ---",
              ]
            : []),
          "",
          "Produce the structured Paper DNA JSON as specified. The code_kernel must be a self-contained pure JavaScript/TypeScript function that implements the paper's core algorithm — no external libraries, no I/O, fully executable in a browser sandbox.",
        ].join("\n");

        const claudeStream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 32000,
          system: systemBlocks,
          output_config: {
            effort: "high",
            format: {
              type: "json_schema",
              schema: PAPER_DNA_SCHEMA,
            },
          },
          messages: [{ role: "user", content: userContent }],
        });

        let charCount = 0;
        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            charCount += event.delta.text.length;
            send("delta", { text: event.delta.text, chars: charCount });
          }
        }

        const finalMessage = await claudeStream.finalMessage();
        const textBlock = finalMessage.content.find(
          (b): b is Anthropic.TextBlock => b.type === "text",
        );
        if (!textBlock) {
          throw new Error("Claude response contained no text block");
        }

        let paperDna: unknown;
        try {
          paperDna = JSON.parse(textBlock.text);
        } catch (err) {
          throw new Error(
            `Failed to parse Claude JSON output: ${(err as Error).message}`,
          );
        }

        send("done", {
          paperDna,
          usage: {
            input_tokens: finalMessage.usage.input_tokens,
            output_tokens: finalMessage.usage.output_tokens,
            cache_read_input_tokens:
              finalMessage.usage.cache_read_input_tokens ?? 0,
          },
          stop_reason: finalMessage.stop_reason,
        });

        if (paperDna && typeof paperDna === "object") {
          writeDna(url, {
            paperDna: paperDna as Record<string, unknown>,
            paperMeta: capturedMeta,
            cachedAt: Date.now(),
          }).catch((e) =>
            console.warn("[GENESIS] dnaCache write failed:", e),
          );

          // ── GENESIS MEMORY · save successful extraction ─────────────────
          // Validate the shape one more time before recording so a malformed
          // DNA never poisons future few-shot anchors.
          const dna = paperDna as Record<string, unknown>;
          if (
            typeof dna.title === "string" &&
            typeof dna.classification === "string" &&
            typeof dna.visualization_type === "string" &&
            typeof dna.code_kernel === "string" &&
            dna.code_kernel.length > 50 &&
            Array.isArray(dna.parameters) &&
            Array.isArray(dna.equations) &&
            typeof dna.core_algorithm === "string"
          ) {
            recordSuccess(
              buildEntryFromDna(
                url,
                {
                  title: dna.title,
                  classification: dna.classification,
                  visualization_type: dna.visualization_type,
                  parameters: dna.parameters,
                  equations: dna.equations,
                  code_kernel: dna.code_kernel,
                  core_algorithm: dna.core_algorithm,
                },
                "extract",
              ),
            ).catch((e) =>
              console.warn("[GENESIS] memoryBank write failed:", e),
            );
          }
        }

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
