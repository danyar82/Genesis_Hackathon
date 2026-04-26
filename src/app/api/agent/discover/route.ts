import Anthropic from "@anthropic-ai/sdk";
import { sseEvent, SSE_HEADERS } from "../_helpers";
import { runKernelInWorker } from "./_kernel-runner";
import {
  DISCOVERY_SUBMIT_SCHEMA,
  RUN_KERNEL_SCHEMA,
  validateDiscoveriesPayload,
  type Discovery,
  type KernelObservation,
} from "@/types/discovery";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_TOOL_CALLS = 12;
const ROUTE_DEADLINE_MS = 80_000;

const SYSTEM_PROMPT = `You are GENESIS DISCOVERY, an autonomous parameter-space explorer. Given a working algorithm kernel and its parameter schema, your mission is to find 3-5 GENUINELY INTERESTING parameter regimes — values that produce qualitatively different, surprising, or pedagogically illuminating behavior.

INTERESTING REGIMES (in priority order):
1. Phase transitions — small parameter change causes qualitative behavior shift
2. Chaos boundaries — parameter values where the system transitions to chaotic/divergent behavior
3. Optimal points — parameters that minimize/maximize an output quantity meaningfully
4. Edge of stability — values just before divergence; oscillations grow but don't explode
5. Surprising stability — values that seem extreme but still produce well-behaved output
6. Resonance / lock-in — parameter combinations producing repeating patterns

WORKFLOW:
1. Examine the parameter schema. Note ranges and defaults.
2. Run "run_kernel" with strategic probes: defaults first; then corners/extremes; then targeted exploration based on findings.
3. After each run, the observation summary tells you about divergence, oscillations, monotonicity, mean/min/max, and final values.
4. Hypothesize what makes the system tick: which params drive what behavior.
5. Refine your probes — bisect, sweep, or zoom in on interesting regions.
6. When you have 3-5 well-supported, distinct regimes, submit them via "submit_discoveries".

CONSTRAINTS:
- TIME BUDGET: ~80 seconds total wall-clock. Reserve the LAST ~10 seconds for submit_discoveries — call it as soon as you have 3-5 distinct, well-supported regimes, even if you have spare run_kernel budget. Submitting late risks the loop being torn down before your discoveries are recorded.
- TOOL CALL BUDGET: at most ${MAX_TOOL_CALLS} run_kernel calls; use them deliberately. Each call has rationale + parameters required.
- Each kernel run is bounded to 5 seconds. Don't push absurd ranges that might hang.
- Submit discoveries in ORDER OF NOVELTY (most surprising first). novelty_score is 0-1.
- Each discovery's parameters object must use only parameter names from the schema; values must be numbers.
- Use defaults for parameters you didn't manipulate.

DO NOT propose discoveries you haven't actually tested. Every discovery must come from an actual run_kernel observation.`;

type Body = {
  kernel?: unknown;
  params?: unknown; // parameter schema (array of {name, default_value, min, max, ...})
  paperTitle?: unknown;
  classification?: unknown;
  vizType?: unknown;
};

type ParamSpec = {
  name: string;
  default_value: number;
  min: number;
  max: number;
  description?: string;
  type?: string;
};

function isParamSpec(p: unknown): p is ParamSpec {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    typeof o.default_value === "number" &&
    typeof o.min === "number" &&
    typeof o.max === "number"
  );
}

function clampParams(
  raw: unknown,
  schema: ParamSpec[],
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  for (const spec of schema) {
    const v = o[spec.name];
    if (typeof v === "number" && Number.isFinite(v)) {
      // Clamp to a generous extension of the declared range so the agent
      // can still test edge-of-divergence behavior (3x range each side).
      const span = spec.max - spec.min;
      const lo = spec.min - span;
      const hi = spec.max + span;
      out[spec.name] = Math.max(lo, Math.min(hi, v));
    } else {
      out[spec.name] = spec.default_value;
    }
  }
  return out;
}

function compactObservation(obs: KernelObservation): string {
  // Keep tool_result content under 4 KB.
  const json = JSON.stringify(obs, (_k, v) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      // Limit precision to 6 sig figs to keep payloads tight.
      const abs = Math.abs(v);
      if (abs > 0 && (abs < 1e-3 || abs > 1e6)) {
        return Number(v.toExponential(4));
      }
      return Math.round(v * 1e6) / 1e6;
    }
    return v;
  });
  if (json.length <= 4000) return json;
  return json.slice(0, 4000) + "...[truncated]";
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.kernel !== "string" || body.kernel.length === 0) {
    return Response.json(
      { error: "Missing or invalid 'kernel' (string) in request body" },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.params)) {
    return Response.json(
      { error: "Missing or invalid 'params' (array) in request body" },
      { status: 400 },
    );
  }
  const paramSchema: ParamSpec[] = body.params
    .filter(isParamSpec)
    .map((p) => ({
      name: p.name,
      default_value: p.default_value,
      min: p.min,
      max: p.max,
      description: p.description,
      type: p.type,
    }));

  if (paramSchema.length === 0) {
    return Response.json(
      { error: "params array contained no valid parameter specs" },
      { status: 400 },
    );
  }

  const kernel = body.kernel;
  const paperTitle =
    typeof body.paperTitle === "string" ? body.paperTitle : "Unknown";
  const classification =
    typeof body.classification === "string" ? body.classification : "unknown";
  const vizType = typeof body.vizType === "string" ? body.vizType : "2d_chart";

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

      // ---- Abort plumbing ----
      const routeAbort = new AbortController();
      const routeSignal = routeAbort.signal;
      const reqSignal = request.signal;
      const onReqAbort = () => routeAbort.abort();
      reqSignal.addEventListener("abort", onReqAbort);
      const deadlineTimer = setTimeout(() => {
        routeAbort.abort();
      }, ROUTE_DEADLINE_MS);

      try {
        send("status", {
          message: `Discovering parameter regimes for ${paperTitle.slice(0, 80)}…`,
        });

        const paramSchemaNames = new Set(paramSchema.map((p) => p.name));

        // ---- Tool definitions ----
        const tools: Anthropic.Tool[] = [
          {
            name: "run_kernel",
            description:
              "Execute the algorithm kernel with specific parameter values and observe the output. Returns a compact statistical summary (per-series min/max/mean/final/monotonicity/divergence/oscillation_count for row outputs; scalars for math_explorer). Use this to test hypotheses about the parameter space.",
            input_schema: RUN_KERNEL_SCHEMA as unknown as Anthropic.Tool["input_schema"],
          },
          {
            name: "submit_discoveries",
            description:
              "Submit the final list of 3-5 most interesting parameter regimes. Each discovery must include a title, description, parameters (numbers), category, and novelty_score (0-1). Only call this once you've explored enough to be confident.",
            input_schema:
              DISCOVERY_SUBMIT_SCHEMA as unknown as Anthropic.Tool["input_schema"],
          },
        ];

        const initialUserContent = [
          `Paper: ${paperTitle}`,
          `Classification: ${classification}`,
          `Visualization type: ${vizType}`,
          "",
          "Parameter schema:",
          ...paramSchema.map(
            (p) =>
              `  • ${p.name}: default=${p.default_value} range=[${p.min}, ${p.max}] — ${p.description ?? ""}`,
          ),
          "",
          "Kernel source (read-only — do not propose modifications):",
          "```js",
          kernel.slice(0, 8000),
          "```",
          "",
          `Begin exploration. You have at most ${MAX_TOOL_CALLS} run_kernel calls. Submit discoveries when ready.`,
        ].join("\n");

        const messages: Anthropic.MessageParam[] = [
          { role: "user", content: initialUserContent },
        ];

        let toolCallCount = 0;
        let finalDiscoveries: Discovery[] | null = null;
        let rounds = 0;
        const MAX_ROUNDS = MAX_TOOL_CALLS + 3; // some slack for retries on validation

        while (
          rounds < MAX_ROUNDS &&
          finalDiscoveries === null &&
          !routeSignal.aborted
        ) {
          rounds++;

          const turn = await client.messages.create({
            model: "claude-opus-4-7",
            max_tokens: 4000,
            system: SYSTEM_PROMPT,
            tools,
            messages,
          });

          messages.push({ role: "assistant", content: turn.content });

          if (routeSignal.aborted) break;

          // Stream any text deltas the model produced (visible reasoning)
          for (const block of turn.content) {
            if (block.type === "text" && block.text.trim().length > 0) {
              send("discovery_thinking", { text: block.text });
            }
          }

          // Process tool_use blocks; collect tool_results to send back.
          const toolUseBlocks = turn.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );

          if (toolUseBlocks.length === 0) {
            // No tool calls — agent gave up or finished.
            break;
          }

          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of toolUseBlocks) {
            if (routeSignal.aborted) break;

            if (block.name === "submit_discoveries") {
              const validated = validateDiscoveriesPayload(
                block.input,
                paramSchemaNames,
              );
              if (validated.ok) {
                // Fill in any missing parameter names with defaults so the UI
                // can apply the discovery cleanly.
                for (const d of validated.discoveries) {
                  for (const spec of paramSchema) {
                    if (!(spec.name in d.parameters)) {
                      d.parameters[spec.name] = spec.default_value;
                    }
                  }
                }
                finalDiscoveries = validated.discoveries;
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: `Accepted ${validated.discoveries.length} discoveries. Thank you.`,
                });
                break;
              } else {
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: `Validation failed: ${validated.errors.join("; ")}. Please fix and call submit_discoveries again.`,
                  is_error: true,
                });
              }
            } else if (block.name === "run_kernel") {
              if (toolCallCount >= MAX_TOOL_CALLS) {
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content:
                    "Tool call budget exhausted. Stop probing and submit_discoveries with your best findings now.",
                  is_error: true,
                });
                continue;
              }
              toolCallCount++;
              const input = (block.input ?? {}) as {
                parameters?: unknown;
                rationale?: unknown;
              };
              const params = clampParams(input.parameters, paramSchema);
              const rationale =
                typeof input.rationale === "string"
                  ? input.rationale.slice(0, 240)
                  : "(no rationale)";

              send("discovery_probe", {
                id: block.id,
                index: toolCallCount,
                params,
                rationale,
                observation: null, // pending
              });

              const obs = await runKernelInWorker({
                kernel,
                params,
                vizType,
                signal: routeSignal,
              });

              send("discovery_probe", {
                id: block.id,
                index: toolCallCount,
                params,
                rationale,
                observation: obs,
              });

              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: compactObservation(obs),
                is_error: !obs.ok,
              });
            } else {
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: `Unknown tool: ${block.name}`,
                is_error: true,
              });
            }
          }

          if (finalDiscoveries) break;
          if (routeSignal.aborted) break;
          if (toolResults.length === 0) break;

          messages.push({ role: "user", content: toolResults });

          // Forced submission when budget is spent
          if (
            toolCallCount >= MAX_TOOL_CALLS &&
            finalDiscoveries === null &&
            rounds < MAX_ROUNDS - 1
          ) {
            messages.push({
              role: "user",
              content:
                "Tool budget exhausted. Based on what you've observed, submit your top 3-5 discoveries now using submit_discoveries.",
            });
          }
        }

        if (routeSignal.aborted) {
          send("error", { message: "Discovery aborted." });
          controller.close();
          return;
        }

        if (!finalDiscoveries) {
          // The agent burned its budget without submitting. Surface what we have
          // (the route emits no fallback discoveries — the UI shows the probe
          // history and a "couldn't formulate" message).
          send("error", {
            message:
              "Agent did not formulate discoveries within the budget. The probe history above shows what was explored.",
          });
          controller.close();
          return;
        }

        send("discoveries_done", {
          discoveries: finalDiscoveries,
          probesUsed: toolCallCount,
        });
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
        clearTimeout(deadlineTimer);
        reqSignal.removeEventListener("abort", onReqAbort);
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
