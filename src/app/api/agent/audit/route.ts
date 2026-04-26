import Anthropic from "@anthropic-ai/sdk";
import { fetchPaperMetadata, sseEvent, SSE_HEADERS } from "../_helpers";
import { AUDIT_CLAIMS_SCHEMA, type AuditClaim } from "@/types/audit";

export const runtime = "nodejs";
export const maxDuration = 120;

const CLAIMS_SYSTEM_PROMPT = `You are GENESIS AUDIT, a scientific paper reproducibility analyst. Given a paper's abstract and a description of its core algorithm, identify NUMERICAL claims that can be verified by RUNNING the algorithm in JavaScript with no external data.

Pick claims that are:
- numerical (a number, rate, exponent, ratio, threshold)
- INTRINSIC to the algorithm — observable from running the kernel itself, not requiring external datasets, ground truth, or human evaluation
- specific enough to test (e.g., "converges in O(1/k^2)" → expected_value=2 for the negative log-log slope)

Examples of GOOD claims:
- "Converges at rate O(1/k^2)" → expected_value: 2, unit: "negative-log-slope"
- "Energy conserved to within 0.1%" → expected_value: 0.001, unit: "relative-energy-drift"
- "Phase transition at α = 1.4" → expected_value: 1.4, unit: "alpha"
- "Reduces loss by 90% in 100 iterations" → expected_value: 0.1, unit: "loss-ratio-after-100"

Examples of BAD claims (skip these):
- "Achieves 92.3% accuracy on MNIST" — needs MNIST data
- "Outperforms baseline X" — needs baseline implementation
- "Converges faster than method Y" — needs Y to compare
- Vague qualitative statements

Return AT MOST 5 claims. If the abstract has no testable numerical claims, return an empty array. Each claim's id should be "claim-1", "claim-2", etc. The test_method field should be a concise sentence describing how to verify the claim by running the kernel — e.g., "Run for 1000 iterations, fit log-log slope of error vs k, return negated slope."`;

const HARNESS_SYSTEM_PROMPT = `You generate a JavaScript audit harness that tests numerical claims against an algorithm kernel by running it.

CONTRACT:
- ES module syntax. Output ONLY the module source — no markdown fences, no preamble, no trailing prose.
- Export ONE function: \`export async function runAudit(kernel)\` returning Promise<Array<{claim_id, actual_value, unit, passed, notes}>>.
- The kernel argument is the imported module; access exports via kernel.default, kernel.init, kernel.simulate, etc., depending on the visualization type.
- For each claim, do a deterministic test and return a result entry. Always return ALL claims even if a test fails — record the failure as { passed: false, actual_value: null, notes: "<reason>" }.
- 'passed' should be true if the actual value is within the claim's tolerance of the expected value. Use the tolerance_kind to decide: "absolute" means |actual - expected| <= tolerance; "relative" means |actual - expected| / |expected| <= tolerance.

STRICT SECURITY RULES — VIOLATIONS WILL BE REJECTED:
- NO network access: do NOT use fetch, XMLHttpRequest, WebSocket, EventSource, navigator.sendBeacon.
- NO DOM access: do NOT touch document, window.open, localStorage, sessionStorage, indexedDB, cookies.
- NO dynamic code: do NOT use eval, new Function, setTimeout(string), setInterval(string), import().
- NO worker spawning: do NOT use Worker, SharedWorker, ServiceWorker.
- All loops must terminate within 5 seconds. Cap any iteration count at 100,000.
- All numeric outputs must be plain JS numbers (no BigInt, no typed arrays in result fields).
- NO file I/O: do NOT use FileReader, Blob, URL.createObjectURL.

KERNEL SHAPES BY VISUALIZATION TYPE:
- 3d_particles: kernel.default(positions: Float32Array, dt, t, params) mutates in place. kernel.init(count, params) optionally seeds.
- 2d_chart / interactive_graph / data_dashboard: kernel.default(params) returns Array<Record<string, number>>.
- canvas_physics: kernel.init(params), kernel.simulate(state, dt, params), kernel.draw(ctx, state, frame, params). Skip claims that require kernel.draw — it needs a canvas context.
- math_explorer: kernel.default(params) returns Record<string, number | string>.

Use the parameter defaults from the params spec for canonical runs, then sweep when needed (e.g., to detect a phase transition).

If a claim is fundamentally untestable from this kernel shape, return { passed: false, actual_value: null, notes: "Cannot verify from kernel surface: <one-line reason>" } — do not fabricate results.`;

type Body = {
  paperDna?: unknown;
  url?: unknown;
  abstractOverride?: unknown;
};

function isPaperDnaShape(d: unknown): d is {
  title: string;
  core_algorithm: string;
  visualization_type: string;
  code_kernel: string;
  parameters: Array<Record<string, unknown>>;
} {
  if (!d || typeof d !== "object") return false;
  const o = d as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    typeof o.core_algorithm === "string" &&
    typeof o.visualization_type === "string" &&
    typeof o.code_kernel === "string" &&
    Array.isArray(o.parameters)
  );
}

function validateClaims(input: unknown): AuditClaim[] {
  if (!input || typeof input !== "object") return [];
  const arr = (input as { claims?: unknown }).claims;
  if (!Array.isArray(arr)) return [];

  const out: AuditClaim[] = [];
  for (const raw of arr.slice(0, 5)) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    if (
      typeof c.id !== "string" ||
      typeof c.statement !== "string" ||
      typeof c.expected_value !== "number" ||
      !Number.isFinite(c.expected_value) ||
      typeof c.expected_unit !== "string" ||
      typeof c.tolerance !== "number" ||
      !Number.isFinite(c.tolerance) ||
      (c.tolerance_kind !== "absolute" && c.tolerance_kind !== "relative") ||
      typeof c.test_method !== "string"
    ) {
      continue;
    }
    out.push({
      id: c.id,
      statement: c.statement,
      expected_value: c.expected_value,
      expected_unit: c.expected_unit,
      tolerance: Math.max(0, c.tolerance),
      tolerance_kind: c.tolerance_kind,
      test_method: c.test_method,
    });
  }
  return out;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isPaperDnaShape(body.paperDna)) {
    return Response.json(
      { error: "Missing or invalid 'paperDna' in request body" },
      { status: 400 },
    );
  }
  const dna = body.paperDna;
  const url = typeof body.url === "string" ? body.url : null;
  const abstractOverride =
    typeof body.abstractOverride === "string"
      ? body.abstractOverride
      : null;

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
        // Resolve abstract + body: explicit abstract override > re-fetch from
        // URL (gives both abstract AND, where the host provides it, full body
        // text) > fallback to core_algorithm only.
        let abstract: string;
        let body: string | undefined;
        let provenance: string = "dna-only";
        if (abstractOverride) {
          abstract = abstractOverride;
          provenance = "override";
        } else if (url) {
          send("status", { message: "Fetching paper for audit…" });
          try {
            const meta = await fetchPaperMetadata(url);
            abstract = meta.abstract || dna.core_algorithm;
            body = meta.body;
            provenance = meta.source ?? "unknown";
          } catch {
            abstract = dna.core_algorithm;
          }
        } else {
          abstract = dna.core_algorithm;
        }

        // ============ PHASE 1: claims extraction ============
        send("status", { message: "Extracting numerical claims…" });

        // Prefer the full body when we have it — claims grounded in real
        // methodology beat claims grounded in a 200-word summary. Cap at 60k
        // chars (≈ 15k tokens) which leaves room for the rest of the prompt
        // plus the JSON-schema response budget.
        const paperContent = body
          ? body.slice(0, 60_000)
          : abstract.slice(0, 6000);
        const paperContentLabel = body
          ? "Full paper body (truncated if long):"
          : "Abstract or summary:";

        const claimsUserContent = [
          `Paper title: ${dna.title}`,
          `Visualization type: ${dna.visualization_type}`,
          `Source provenance: ${provenance}`,
          "",
          paperContentLabel,
          paperContent,
          "",
          "Core algorithm description (from Paper DNA):",
          dna.core_algorithm,
          "",
          "Identify up to 5 INTRINSIC numerical claims that can be verified by running the kernel deterministically. Skip anything that requires external data.",
        ].join("\n");

        const claimsResp = await client.messages.create({
          model: "claude-opus-4-7",
          max_tokens: 4000,
          system: CLAIMS_SYSTEM_PROMPT,
          output_config: {
            effort: "high",
            format: {
              type: "json_schema",
              schema: AUDIT_CLAIMS_SCHEMA,
            },
          },
          messages: [{ role: "user", content: claimsUserContent }],
        });

        const claimsText = claimsResp.content.find(
          (b): b is Anthropic.TextBlock => b.type === "text",
        );
        if (!claimsText) throw new Error("Claims phase returned no text");

        let claimsParsed: unknown;
        try {
          claimsParsed = JSON.parse(claimsText.text);
        } catch (e) {
          throw new Error(`Failed to parse claims JSON: ${(e as Error).message}`);
        }

        const claims = validateClaims(claimsParsed);
        send("claims_extracted", { claims });

        if (claims.length === 0) {
          send("done", {
            harness: null,
            claims: [],
            note: "No verifiable numerical claims found in abstract.",
          });
          controller.close();
          return;
        }

        // ============ PHASE 2: harness generation (streamed) ============
        send("status", { message: "Generating audit harness…" });

        const paramsForPrompt = dna.parameters
          .map((p) => {
            const o = p as Record<string, unknown>;
            return `  ${String(o.name)}: default=${String(o.default_value)} range=[${String(o.min)}, ${String(o.max)}] — ${String(o.description ?? "")}`;
          })
          .join("\n");

        const harnessUserContent = [
          `Paper title: ${dna.title}`,
          `Visualization type: ${dna.visualization_type}`,
          "",
          "Kernel source:",
          "---",
          dna.code_kernel,
          "---",
          "",
          "Parameter spec:",
          paramsForPrompt || "  (none)",
          "",
          "Claims to verify (test each one):",
          JSON.stringify(claims, null, 2),
          "",
          "Generate the runAudit harness module per the contract. Output JS only, no fences, no preamble.",
        ].join("\n");

        const harnessStream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 16000,
          system: HARNESS_SYSTEM_PROMPT,
          messages: [{ role: "user", content: harnessUserContent }],
        });

        let harnessAcc = "";
        for await (const event of harnessStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            harnessAcc += event.delta.text;
            send("harness_delta", {
              text: event.delta.text,
              total: harnessAcc.length,
            });
          }
        }

        // Strip any markdown fences the model may have added despite instructions.
        let harness = harnessAcc.trim();
        const fenceMatch = harness.match(/^```(?:js|javascript|ts|typescript)?\n([\s\S]*?)\n```$/);
        if (fenceMatch) harness = fenceMatch[1];

        send("harness_done", { harness });
        send("done", { harness, claims });
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
