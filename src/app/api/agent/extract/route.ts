import Anthropic from "@anthropic-ai/sdk";
import {
  decodeXmlEntities,
  fetchPaperMetadata,
  sseEvent,
  SSE_HEADERS,
} from "../_helpers";
import { readDna, writeDna, type CachedDnaMeta } from "../../_lib/dnaCache";
import {
  buildEntryFromDna,
  findExemplars,
  formatExemplarBlock,
  predictClassification,
  recordSuccess,
} from "../../_lib/memoryBank";

export const runtime = "nodejs";
export const maxDuration = 300;

const AGENT_SYSTEM_PROMPT = `You are GENESIS, a scientific paper analyzer. Given an arXiv URL, produce a structured Paper DNA including runnable JavaScript.

FOLLOW THIS EXACT SEQUENCE. Do not skip or merge phases. Each phase MUST start with a report_progress() call so the UI stays in sync.

1. Call report_progress("fetching", "<short message>"), then call fetch_arxiv_paper(url) with the URL provided in the user message.

2. Call report_progress("parsing", "<short message>"). Read the paper's title, abstract, and categories from the fetch result. Identify the core algorithmic contribution in 1-2 sentences of internal reasoning.

3. Call report_progress("extracting", "<short message>"). Decide:
   - classification: one of [simulation, optimization, statistical_model, neural_network, physics_engine, economic_model, mathematical_proof, data_visualization]
   - core_algorithm: 2-4 sentence description.
   - equations: 3-8 key equations in LaTeX.
   - parameters: 3-8 tunable numeric parameters, each with {name, description, min, max, default_value, type}. Choose sensible ranges. Use \`type: "number"\` or \`type: "integer"\`.
   - visualization_type: one of [3d_particles, 2d_chart, interactive_graph, canvas_physics, math_explorer, data_dashboard]. Pick the one that best fits the algorithm's output.

4. Call report_progress("generating", "<short message>"). Produce code_kernel: a self-contained JavaScript/TypeScript ES module that implements the core algorithm.
   - The kernel must accept a \`params\` object as its LAST argument (keyed by the parameter names you defined).
   - For 3d_particles: \`export default function(positions: Float32Array, dt: number, t: number, params): void\` — mutate positions in place.
   - For 2d_chart / interactive_graph / data_dashboard: \`export default function(params): Array<Record<string, number>>\`.
   - For canvas_physics: \`export function init(params), export function simulate(state, dt, params), export function draw(ctx, state, frame, params)\`.
   - For math_explorer: \`export default function(params): Record<string, number | string>\`.
   - No external libraries, no network, no I/O. ES module syntax only. Pure JavaScript.

5. Call submit_paper_dna with ALL 7 fields filled in (title, classification, core_algorithm, equations, parameters, visualization_type, code_kernel). This is your final action.

Keep any intermediate text concise. Tool calls are the mechanism — don't narrate.`;

const CLASSIFICATION_ENUM = [
  "simulation",
  "optimization",
  "statistical_model",
  "neural_network",
  "physics_engine",
  "economic_model",
  "mathematical_proof",
  "data_visualization",
];

const VISUALIZATION_ENUM = [
  "3d_particles",
  "2d_chart",
  "interactive_graph",
  "canvas_physics",
  "math_explorer",
  "data_dashboard",
];

const PROGRESS_STEPS = ["fetching", "parsing", "extracting", "generating"] as const;

const AGENT_TOOLS = [
  {
    type: "custom" as const,
    name: "fetch_arxiv_paper",
    description:
      "Fetch paper metadata from any supported source: arXiv (URL or bare ID), PubMed/PMC (NCBI URLs), or a generic http(s) page (extracts title + meta description). Returns title, abstract, authors, and categories. Call this ONCE during the fetching phase with the URL the user provided.",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            "The paper URL. Examples: 'https://arxiv.org/abs/1412.6980', '1412.6980', 'https://pubmed.ncbi.nlm.nih.gov/30311904/', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6150118/', or any web page with a paper title and description.",
        },
      },
      required: ["url"],
    },
  },
  {
    type: "custom" as const,
    name: "report_progress",
    description:
      "Report progress to the UI. Call this at the START of each of the four phases (fetching, parsing, extracting, generating) before doing any other work for that phase. The message should be a short human-readable status line.",
    input_schema: {
      type: "object",
      properties: {
        step: {
          type: "string",
          enum: [...PROGRESS_STEPS],
          description: "Which phase is starting.",
        },
        message: {
          type: "string",
          description: "Short (<80 char) human-readable status line.",
        },
      },
      required: ["step", "message"],
    },
  },
  {
    type: "custom" as const,
    name: "submit_paper_dna",
    description:
      "Submit the final Paper DNA with all required fields. This is the terminal action — call it exactly once at the end.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        classification: { type: "string", enum: CLASSIFICATION_ENUM },
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
          },
        },
        visualization_type: { type: "string", enum: VISUALIZATION_ENUM },
        code_kernel: { type: "string" },
      },
      required: [
        "title",
        "classification",
        "core_algorithm",
        "equations",
        "parameters",
        "visualization_type",
        "code_kernel",
      ],
    },
  },
];

let AGENT_ID: string | null = process.env.GENESIS_AGENT_ID ?? null;
let AGENT_VERSION: number | null = process.env.GENESIS_AGENT_VERSION
  ? Number(process.env.GENESIS_AGENT_VERSION)
  : null;
let ENV_ID: string | null = process.env.GENESIS_ENV_ID ?? null;
let agentInitInFlight: Promise<void> | null = null;

async function ensureAgentAndEnv(client: Anthropic): Promise<void> {
  if (AGENT_ID && ENV_ID) return;
  if (agentInitInFlight) return agentInitInFlight;

  agentInitInFlight = (async () => {
    if (!ENV_ID) {
      const env = await client.beta.environments.create({
        name: `genesis-${Date.now()}`,
        description: "Ephemeral environment for GENESIS paper-analysis agent.",
        config: {
          type: "cloud",
          networking: { type: "unrestricted" },
        },
      });
      ENV_ID = env.id;
      console.log(
        `[GENESIS] Created environment: ${env.id}\n  -> set GENESIS_ENV_ID=${env.id} in .env.local to pin across restarts.`,
      );
    }

    if (!AGENT_ID) {
      const agent = await client.beta.agents.create({
        name: "GENESIS Paper Analyzer",
        description:
          "Extracts Paper DNA + generates runnable JavaScript from an arXiv paper via phased custom tools.",
        model: "claude-opus-4-7",
        system: AGENT_SYSTEM_PROMPT,
        // The SDK's CustomToolInputSchema type omits `type`/`additionalProperties`,
        // but the managed-agents API *requires* `type: "object"` at the top level
        // and *rejects* `additionalProperties`. We send the runtime-correct shape
        // and cast past the stale TS type.
        tools: AGENT_TOOLS as unknown as Parameters<
          typeof client.beta.agents.create
        >[0]["tools"],
      });
      AGENT_ID = agent.id;
      AGENT_VERSION = agent.version;
      console.log(
        `[GENESIS] Created agent: ${agent.id} @ version ${agent.version}\n  -> set GENESIS_AGENT_ID=${agent.id} and GENESIS_AGENT_VERSION=${agent.version} in .env.local.`,
      );
    }
  })();

  try {
    await agentInitInFlight;
  } finally {
    agentInitInFlight = null;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function summarizeToolArgs(
  toolName: string,
  input: Record<string, unknown>,
): string {
  if (toolName === "fetch_arxiv_paper") {
    const u = typeof input.url === "string" ? input.url : "";
    return `url=${truncate(u, 60)}`;
  }
  if (toolName === "report_progress") {
    const step = typeof input.step === "string" ? input.step : "?";
    const message =
      typeof input.message === "string" ? input.message : "";
    return `step=${step} ${message ? `· ${truncate(message, 50)}` : ""}`;
  }
  if (toolName === "submit_paper_dna") {
    const eqs = Array.isArray(input.equations) ? input.equations.length : 0;
    const params = Array.isArray(input.parameters)
      ? input.parameters.length
      : 0;
    const viz =
      typeof input.visualization_type === "string"
        ? input.visualization_type
        : "?";
    return `equations=${eqs} params=${params} viz=${viz}`;
  }
  return Object.keys(input).slice(0, 3).join(", ");
}

function validatePaperDna(input: unknown): { ok: true; dna: Record<string, unknown> } | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "submit_paper_dna was called with non-object input" };
  }
  const dna = input as Record<string, unknown>;
  const requiredStrings = [
    "title",
    "classification",
    "core_algorithm",
    "visualization_type",
    "code_kernel",
  ];
  for (const key of requiredStrings) {
    if (typeof dna[key] !== "string" || !(dna[key] as string).length) {
      return { ok: false, error: `submit_paper_dna missing/invalid field: ${key}` };
    }
  }
  if (!Array.isArray(dna.equations)) {
    return { ok: false, error: "submit_paper_dna.equations must be an array" };
  }
  if (!Array.isArray(dna.parameters)) {
    return { ok: false, error: "submit_paper_dna.parameters must be an array" };
  }
  if (!CLASSIFICATION_ENUM.includes(dna.classification as string)) {
    return {
      ok: false,
      error: `submit_paper_dna.classification must be one of ${CLASSIFICATION_ENUM.join(", ")}`,
    };
  }
  if (!VISUALIZATION_ENUM.includes(dna.visualization_type as string)) {
    return {
      ok: false,
      error: `submit_paper_dna.visualization_type must be one of ${VISUALIZATION_ENUM.join(", ")}`,
    };
  }
  return { ok: true, dna };
}

const REPLAY_STEPS: Array<{ step: string; message: string; delayMs: number }> = [
  { step: "fetching", message: "Restoring cached metadata…", delayMs: 120 },
  { step: "parsing", message: "Reading paper structure…", delayMs: 120 },
  { step: "extracting", message: "Loading paper DNA…", delayMs: 120 },
  { step: "generating", message: "Restoring kernel…", delayMs: 140 },
];

function replayCachedStream(cached: {
  paperDna: Record<string, unknown>;
  paperMeta: CachedDnaMeta;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          /* client disconnected */
        }
      };

      send("status", { message: "Cached — replaying…", cached: true });

      for (const phase of REPLAY_STEPS) {
        send("step_start", { step: phase.step, message: phase.message });
        if (phase.step === "fetching") {
          send("step_complete", {
            step: "fetching",
            metadata: cached.paperMeta,
          });
        } else if (phase.step === "generating") {
          const dna = cached.paperDna;
          send("step_complete", {
            step: "generating",
            metadata: {
              code_kernel_chars:
                typeof dna.code_kernel === "string"
                  ? dna.code_kernel.length
                  : 0,
              parameter_count: Array.isArray(dna.parameters)
                ? dna.parameters.length
                : 0,
            },
          });
        } else {
          send("step_complete", { step: phase.step });
        }
        await new Promise((r) => setTimeout(r, phase.delayMs));
      }

      send("done", { paperDna: cached.paperDna });
      controller.close();
    },
  });
}

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
  try {
    // Allow bare arXiv IDs like "1412.6980" as well as real URLs.
    if (!/^\d{4}\.\d{4,5}(v\d+)?$/.test(url.trim())) {
      new URL(url);
    }
  } catch {
    return Response.json(
      { error: "Invalid URL — provide an arXiv, PubMed/PMC, or any http(s) paper URL" },
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
      console.log(`[GENESIS] cache hit: ${url}`);
      return new Response(replayCachedStream(cached), {
        headers: SSE_HEADERS,
      });
    }
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  let capturedMeta: CachedDnaMeta | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          // Controller already closed — client disconnected.
        }
      };

      let sessionId: string | null = null;

      try {
        send("status", { message: "Provisioning agent…" });
        await ensureAgentAndEnv(client);

        if (!AGENT_ID || !ENV_ID) {
          throw new Error("Agent or environment failed to initialize.");
        }

        send("status", {
          message: "Starting agent session…",
          agentId: AGENT_ID,
          environmentId: ENV_ID,
        });

        const session = await client.beta.sessions.create({
          agent: AGENT_VERSION
            ? { type: "agent", id: AGENT_ID, version: AGENT_VERSION }
            : AGENT_ID,
          environment_id: ENV_ID,
          title: `Extract: ${url}`,
        });
        sessionId = session.id;

        send("status", {
          message: "Session ready — streaming agent events",
          sessionId: session.id,
        });

        // ── GENESIS MEMORY · few-shot anchoring ──────────────────────────
        // The Managed Agents API bakes the system prompt at agent-create time
        // and reuses the agent across sessions, so we can't update `system`
        // per request. Instead we inject the exemplar block into the FIRST
        // user message — Opus reads it before reasoning about the new paper.
        //
        // Pre-fetch metadata so we can predict the GENESIS classification and
        // pull category-matched exemplars. Any failure here just means we
        // fall back to most-recent-overall exemplars (still useful for
        // anchoring kernel shape) — never blocks the agent run.
        let exemplarBlock = "";
        try {
          const previewMeta = await fetchPaperMetadata(url);
          const predicted = predictClassification(previewMeta);
          const exemplars = await findExemplars(predicted, 2);
          exemplarBlock = formatExemplarBlock(exemplars);
          if (exemplars.length > 0) {
            send("status", {
              phase: "memory",
              message: `GENESIS Memory · ${exemplars.length} exemplar${
                exemplars.length > 1 ? "s" : ""
              } loaded${predicted ? ` for ${predicted}` : ""}`,
              exemplars: exemplars.map((e) => ({
                title: e.title,
                classification: e.classification,
              })),
              predictedClassification: predicted,
            });
          }
        } catch {
          // Memory anchoring is best-effort — proceed without it on any error.
        }

        // Stream-first: open event stream BEFORE sending user message so we
        // don't miss the leading events. The stream only delivers events that
        // occur after it opens.
        const eventStream = await client.beta.sessions.events.stream(session.id);

        const userMessageText = exemplarBlock
          ? `${exemplarBlock}\n\n---\n\nNow analyze THIS new arXiv paper and produce its Paper DNA. Use the exemplars above as a structural / syntactic reference only — your output must implement the new paper's algorithm:\n\n${url}`
          : `Analyze this arXiv paper and produce Paper DNA:\n\n${url}`;

        await client.beta.sessions.events.send(session.id, {
          events: [
            {
              type: "user.message",
              content: [
                {
                  type: "text",
                  text: userMessageText,
                },
              ],
            },
          ],
        });

        let dnaSubmitted = false;

        for await (const event of eventStream) {
          if (event.type === "agent.custom_tool_use") {
            const toolName = event.name;
            const toolUseId = event.id;
            const input = event.input ?? {};

            send("tool_call", {
              id: toolUseId,
              name: toolName,
              argSummary: summarizeToolArgs(toolName, input),
            });

            if (toolName === "fetch_arxiv_paper") {
              const toolUrl =
                typeof input.url === "string" ? input.url : url;

              let resultText: string;
              let toolOk = true;
              let toolSummary = "";
              try {
                const paper = await fetchPaperMetadata(toolUrl);
                resultText = JSON.stringify({
                  title: paper.title,
                  abstract: paper.abstract,
                  authors: paper.authors,
                  categories: paper.categories,
                  // When the host provides a machine-readable body (arXiv HTML
                  // render, PMC JATS body, scraped article content), pass it
                  // through so the agent reasons from real methodology rather
                  // than the abstract alone. Capped at 120k chars to keep the
                  // tool-result payload bounded.
                  body: paper.body
                    ? paper.body.slice(0, 120_000)
                    : undefined,
                  source: paper.source,
                });
                capturedMeta = {
                  title: paper.title,
                  authors: paper.authors,
                  categories: paper.categories,
                  abstract_length: paper.abstract.length,
                };
                send("step_complete", {
                  step: "fetching",
                  metadata: capturedMeta,
                });
                const authorBlurb =
                  paper.authors.length === 0
                    ? ""
                    : paper.authors.length === 1
                      ? ` · ${paper.authors[0]}`
                      : ` · ${paper.authors[0]} et al.`;
                toolSummary = `Fetched “${truncate(paper.title, 50)}”${authorBlurb}`;
              } catch (err) {
                resultText = JSON.stringify({
                  error: `fetch_paper failed: ${(err as Error).message}`,
                });
                toolOk = false;
                toolSummary = `Fetch failed: ${truncate((err as Error).message, 80)}`;
              }

              send("tool_result", {
                id: toolUseId,
                ok: toolOk,
                summary: toolSummary,
              });

              await client.beta.sessions.events.send(session.id, {
                events: [
                  {
                    type: "user.custom_tool_result",
                    custom_tool_use_id: toolUseId,
                    content: [{ type: "text", text: resultText }],
                  },
                ],
              });
            } else if (toolName === "report_progress") {
              const step =
                typeof input.step === "string"
                  ? input.step
                  : "unknown";
              const message =
                typeof input.message === "string"
                  ? input.message
                  : "";
              send("step_start", { step, message });

              send("tool_result", {
                id: toolUseId,
                ok: true,
                summary: `phase → ${step}`,
              });

              await client.beta.sessions.events.send(session.id, {
                events: [
                  {
                    type: "user.custom_tool_result",
                    custom_tool_use_id: toolUseId,
                    content: [{ type: "text", text: "ok" }],
                  },
                ],
              });
            } else if (toolName === "submit_paper_dna") {
              const validated = validatePaperDna(input);
              if (!validated.ok) {
                send("tool_result", {
                  id: toolUseId,
                  ok: false,
                  summary: `Validation failed: ${truncate(validated.error, 80)}`,
                });
                await client.beta.sessions.events.send(session.id, {
                  events: [
                    {
                      type: "user.custom_tool_result",
                      custom_tool_use_id: toolUseId,
                      content: [
                        {
                          type: "text",
                          text: `Validation failed: ${validated.error}. Please call submit_paper_dna again with corrected fields.`,
                        },
                      ],
                      is_error: true,
                    },
                  ],
                });
                continue;
              }

              // Decode any XML entities the model may have left in equations
              // (occasionally arXiv abstracts leak them through).
              const cleanedDna = {
                ...validated.dna,
                title: decodeXmlEntities(String(validated.dna.title)),
                core_algorithm: decodeXmlEntities(
                  String(validated.dna.core_algorithm),
                ),
              };

              send("step_complete", {
                step: "generating",
                metadata: {
                  code_kernel_chars:
                    typeof validated.dna.code_kernel === "string"
                      ? validated.dna.code_kernel.length
                      : 0,
                  parameter_count: Array.isArray(validated.dna.parameters)
                    ? validated.dna.parameters.length
                    : 0,
                },
              });

              send("tool_result", {
                id: toolUseId,
                ok: true,
                summary: `Accepted (${
                  Array.isArray(validated.dna.equations)
                    ? validated.dna.equations.length
                    : 0
                } eqs · ${
                  Array.isArray(validated.dna.parameters)
                    ? validated.dna.parameters.length
                    : 0
                } params)`,
              });

              send("done", { paperDna: cleanedDna });
              dnaSubmitted = true;

              if (capturedMeta) {
                writeDna(url, {
                  paperDna: cleanedDna,
                  paperMeta: capturedMeta,
                  cachedAt: Date.now(),
                }).catch((e) =>
                  console.warn("[GENESIS] dnaCache write failed:", e),
                );
              }

              // ── GENESIS MEMORY · save successful extraction ─────────────
              // The agent's submit_paper_dna validator already enforced the
              // shape; we widen the type via Record<string, unknown> so the
              // narrow type guards below can reach all DNA fields.
              const dnaRec = cleanedDna as Record<string, unknown>;
              if (
                typeof dnaRec.title === "string" &&
                typeof dnaRec.classification === "string" &&
                typeof dnaRec.visualization_type === "string" &&
                typeof dnaRec.code_kernel === "string" &&
                dnaRec.code_kernel.length > 50 &&
                Array.isArray(dnaRec.parameters) &&
                Array.isArray(dnaRec.equations) &&
                typeof dnaRec.core_algorithm === "string"
              ) {
                recordSuccess(
                  buildEntryFromDna(
                    url,
                    {
                      title: dnaRec.title,
                      classification: dnaRec.classification,
                      visualization_type: dnaRec.visualization_type,
                      parameters: dnaRec.parameters,
                      equations: dnaRec.equations,
                      code_kernel: dnaRec.code_kernel,
                      core_algorithm: dnaRec.core_algorithm,
                    },
                    "agent-extract",
                  ),
                ).catch((e) =>
                  console.warn("[GENESIS] memoryBank write failed:", e),
                );
              }

              await client.beta.sessions.events.send(session.id, {
                events: [
                  {
                    type: "user.custom_tool_result",
                    custom_tool_use_id: toolUseId,
                    content: [{ type: "text", text: "accepted" }],
                  },
                ],
              });
              break;
            } else {
              // Unknown custom tool — respond with an error so the agent doesn't hang.
              send("tool_result", {
                id: toolUseId,
                ok: false,
                summary: `Unknown tool: ${toolName}`,
              });
              await client.beta.sessions.events.send(session.id, {
                events: [
                  {
                    type: "user.custom_tool_result",
                    custom_tool_use_id: toolUseId,
                    content: [
                      {
                        type: "text",
                        text: `Unknown tool: ${toolName}`,
                      },
                    ],
                    is_error: true,
                  },
                ],
              });
            }
          } else if (event.type === "agent.message") {
            const text = event.content
              .map((c) => (c.type === "text" ? c.text : ""))
              .join(" ")
              .trim();
            if (text) send("agent_message", { text });
          } else if (event.type === "session.status_terminated") {
            send("error", { message: "Agent session terminated unexpectedly" });
            break;
          } else if (event.type === "session.status_idle") {
            const stopType = event.stop_reason?.type;
            if (stopType === "end_turn" || stopType === "retries_exhausted") {
              if (!dnaSubmitted) {
                send("error", {
                  message: `Agent ended (${stopType}) without submitting Paper DNA`,
                });
              }
              break;
            }
            // "requires_action" — the agent is waiting on a tool_result we'll
            // emit in response to an upcoming agent.custom_tool_use. Keep
            // streaming.
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
      } finally {
        if (sessionId) {
          client.beta.sessions
            .archive(sessionId)
            .catch((e) =>
              console.warn(`[GENESIS] Failed to archive session ${sessionId}:`, e),
            );
        }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
