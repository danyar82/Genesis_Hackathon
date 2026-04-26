import Anthropic from "@anthropic-ai/sdk";
import type { PaperDna } from "@/types/paperDna";
import { fetchPaperMetadata, sseEvent, SSE_HEADERS } from "../_helpers";

export const runtime = "nodejs";
export const maxDuration = 180;

// Shared meta-rule that overrides the persona of either agent. Both must
// internalize that scientific truth supersedes their assigned role —
// fabricating flaws or fabricating defenses is a harder violation than
// producing a "boring" turn.
const FAIRNESS_CONTRACT = `ABSOLUTE FAIRNESS CONTRACT — supersedes your persona:
- Ground EVERY claim in the supplied evidence: the equations, the kernel source, the parameter ranges, or pure mathematical logic derivable from them. If you cannot point to a specific artifact, do not assert.
- Never hallucinate flaws, results, citations, regimes, or behaviors. Do not invent numerical instabilities, divergences, or failure modes that the kernel does not actually exhibit. Do not attribute claims to the paper that it does not make.
- Truth supersedes role. If the paper is genuinely sound under the evidence available, you MUST say so plainly. If a candidate objection evaporates under scrutiny, drop it. Producing a fair, accurate turn is more valuable than producing a "brutal" or "decisive" one.
- Calibrate confidence to evidence: hedge appropriately ("under the supplied parameter range…", "in the regime tested…") rather than asserting universal failure or universal correctness.`;

const ATTACKER_SYSTEM = `You are AGENT-A, a rigorous adversarial reviewer in a live AI debate. Your job: scrutinize the paper's methodology, stability, assumptions, and reproducibility for GENUINE flaws — not theatrical ones.

${FAIRNESS_CONTRACT}

Engagement rules:
- Probe for real risks visible in the evidence: numerical instability you can trace to a specific kernel line, hidden assumptions made explicit by an equation, parameter regimes the kernel does not cover, ablations the methodology omits, sensitivity issues implied by the parameter ranges.
- If, on careful inspection, the paper's methodology genuinely holds up, SAY SO directly. Concede the strength with specificity (e.g. "the energy-conservation term in eq. (3) is correctly discretized — no drift would accumulate under the stated dt") and either pivot to the deepest remaining honest concern or, if none exists, openly acknowledge what the paper does well. A graceful concession is a successful turn.
- If responding to AGENT-B, engage their specific evidence. If their citation is conclusive, concede it cleanly. Do not repeat earlier critiques. Do not manufacture a fresh objection just to fill the turn — silence on a point you cannot honestly press is preferable to fabrication.

Style:
- Clipped, confident, terminal-style prose. Senior reviewer dictating into a console. Sharp but technically rigorous — no insults, only evidence.
- 90–140 words. No markdown, no headers, no bullet points — flowing argumentative prose only.`;

const DEFENDER_SYSTEM = `You are AGENT-B, a meticulous defender-reviewer in a live AI debate. Your job: defend the paper using direct evidence from its extracted kernel, equations, and parameter space — but only when the defense is honest.

${FAIRNESS_CONTRACT}

Engagement rules:
- Counter AGENT-A's most recent specific objection by citing exact evidence: which equation, which kernel line, which parameter range, which regime. Match their technical depth.
- If AGENT-A's objection has technical merit, ACKNOWLEDGE it cleanly. Bound the regime where the paper's claim still holds, or concede the limitation outright if no such regime exists. Never manufacture defenses for flaws that genuinely exist. Never deflect with rhetoric when the evidence is against you.
- If the paper is unambiguously stable and well-grounded for this objection, say so directly with the cited evidence. A clear, evidence-anchored "the objection does not apply here, because [specific kernel/equation reason]" is the strongest possible defense.

Style:
- Calm, surgical, terminal-style prose. Domain expert closing the case. Never condescending.
- 90–140 words. No markdown, no headers, no bullet points — flowing prose only.`;

type DebateTurn = { agent: "attacker" | "defender"; text: string; round: number };

function buildPaperContext(dna: PaperDna, paperBody?: string): string {
  const params = dna.parameters
    .map(
      (p) =>
        `  - ${p.name} ∈ [${p.min}, ${p.max}], default=${p.default_value}${p.description ? ` (${p.description})` : ""}`,
    )
    .join("\n");
  const eqs = dna.equations
    .map((e, i) => `  (${i + 1}) ${e}`)
    .join("\n");
  // Cap kernel to keep prompt reasonable; both agents see the same evidence.
  const kernel =
    dna.code_kernel.length > 6000
      ? `${dna.code_kernel.slice(0, 6000)}\n// ... (kernel truncated)`
      : dna.code_kernel;
  // Per-turn budget: 50k chars of body × 6 turns × 360 max-tokens output is
  // well within Opus's per-call window. Body is OPTIONAL — when absent, both
  // agents fall back to reasoning from DNA alone (curated examples take this
  // path; their hand-tuned core_algorithm + equations + kernel already encode
  // the methodology densely).
  const bodyExcerpt = paperBody
    ? `\n\nPAPER BODY EXCERPT (verbatim from the source — argue from THIS, not from speculation):\n${paperBody.slice(0, 50_000)}`
    : "";
  return (
    [
      `PAPER: ${dna.title}`,
      `CLASSIFICATION: ${dna.classification}`,
      `VISUALIZATION: ${dna.visualization_type}`,
      "",
      `CORE ALGORITHM:\n${dna.core_algorithm}`,
      "",
      `EQUATIONS:\n${eqs || "  (none extracted)"}`,
      "",
      `PARAMETERS:\n${params || "  (none)"}`,
      "",
      `EXTRACTED KERNEL (the canonical reproduction):`,
      "```js",
      kernel,
      "```",
    ].join("\n") + bodyExcerpt
  );
}

function transcriptBlock(turns: DebateTurn[]): string {
  if (!turns.length) return "(no prior turns — this is the opening salvo)";
  return turns
    .map(
      (t, i) =>
        `[Turn ${i + 1}] ${t.agent === "attacker" ? "AGENT-A (Attacker)" : "AGENT-B (Defender)"}:\n${t.text}`,
    )
    .join("\n\n");
}

function userPromptFor(
  agent: "attacker" | "defender",
  paperContext: string,
  transcript: DebateTurn[],
  round: number,
  totalRounds: number,
): string {
  const role = agent === "attacker" ? "AGENT-A (Attacker)" : "AGENT-B (Defender)";
  const directive =
    agent === "attacker"
      ? round === 1
        ? "Open the debate. If, after honest scrutiny of the evidence, you can identify a genuine flaw, risk, or limitation grounded in the equations, kernel, or parameter space, articulate it with surgical specificity. If the methodology genuinely appears sound, say so explicitly and engage with the strongest aspect of the paper instead — your role is rigor, not theatre."
        : "Engage with the Defender's most recent point. If you can mount a fresh, evidence-backed objection, do so. If the Defender's evidence is conclusive, concede that point cleanly and either raise a different genuine concern or acknowledge a strength of the methodology. Do not repeat earlier critiques. Do not fabricate an objection to fill the turn."
      : "Address AGENT-A's most recent objection using specific evidence from the kernel, equations, or parameter space. If the objection has technical merit, acknowledge it cleanly and bound the regime where the paper's claim still holds — or concede the limitation outright. Never manufacture a defense for a flaw that genuinely exists.";
  return [
    paperContext,
    "",
    `--- DEBATE TRANSCRIPT (round ${round} of ${totalRounds}) ---`,
    transcriptBlock(transcript),
    "--- END TRANSCRIPT ---",
    "",
    `You are ${role}. ${directive}`,
    "Respond now in 90–140 words of flowing prose. No markdown.",
  ].join("\n");
}

type Body = {
  paperDna?: unknown;
  rounds?: unknown;
  /** Optional source URL — when provided, the route re-fetches paper
   * metadata so the agents can argue from the FULL body text rather than
   * just the DNA fields. Failures are non-fatal: the debate proceeds with
   * DNA-only context if the fetch errors out. */
  url?: unknown;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const paperDna = body.paperDna as PaperDna | undefined;
  if (
    !paperDna ||
    typeof paperDna !== "object" ||
    typeof paperDna.title !== "string" ||
    typeof paperDna.code_kernel !== "string"
  ) {
    return Response.json(
      { error: "Missing or invalid 'paperDna' in request body" },
      { status: 400 },
    );
  }

  const requestedRounds =
    typeof body.rounds === "number" && body.rounds >= 1 && body.rounds <= 5
      ? Math.floor(body.rounds)
      : 3;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  const paperUrl = typeof body.url === "string" ? body.url : null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let cancelled = false;
      const send = (event: string, data: unknown) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          cancelled = true;
        }
      };

      // Re-fetch the paper from its source URL so the agents can argue from
      // the FULL body text where available (arXiv HTML render, PMC JATS body,
      // scraped article content). Best-effort — a fetch failure never blocks
      // the debate; agents fall back to DNA-only context.
      let paperBody: string | undefined;
      if (paperUrl) {
        try {
          send("status", {
            message: "Fetching full paper text…",
          });
          const meta = await fetchPaperMetadata(paperUrl);
          paperBody = meta.body;
          send("status", {
            message: paperBody
              ? `Loaded ${paperBody.length.toLocaleString()} chars (${meta.source ?? "source"}).`
              : `Body unavailable (${meta.source ?? "abstract-only"}); arguing from DNA + abstract.`,
            source: meta.source ?? null,
            bodyLength: paperBody?.length ?? 0,
          });
        } catch {
          // Silently degrade — debate proceeds DNA-only.
        }
      }
      const paperContext = buildPaperContext(paperDna, paperBody);

      const streamTurn = async (
        agent: "attacker" | "defender",
        round: number,
        transcript: DebateTurn[],
        turnIndex: number,
      ): Promise<string> => {
        const system = agent === "attacker" ? ATTACKER_SYSTEM : DEFENDER_SYSTEM;
        const userContent = userPromptFor(
          agent,
          paperContext,
          transcript,
          round,
          requestedRounds,
        );

        send("turn_start", { agent, round, turnIndex });

        const claudeStream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 360,
          system,
          messages: [{ role: "user", content: userContent }],
        });

        let acc = "";
        for await (const ev of claudeStream) {
          if (cancelled) break;
          if (
            ev.type === "content_block_delta" &&
            ev.delta.type === "text_delta"
          ) {
            const text = ev.delta.text;
            acc += text;
            send("delta", { agent, text, turnIndex });
          }
        }

        send("turn_end", { agent, round, turnIndex, fullText: acc });
        return acc;
      };

      try {
        send("status", {
          message: "Spawning AGENT-A and AGENT-B…",
          rounds: requestedRounds,
        });

        const transcript: DebateTurn[] = [];
        let turnIndex = 0;

        for (let round = 1; round <= requestedRounds; round++) {
          if (cancelled) break;

          const attackerText = await streamTurn(
            "attacker",
            round,
            transcript,
            turnIndex++,
          );
          transcript.push({ agent: "attacker", text: attackerText, round });
          if (cancelled) break;

          const defenderText = await streamTurn(
            "defender",
            round,
            transcript,
            turnIndex++,
          );
          transcript.push({ agent: "defender", text: defenderText, round });
        }

        send("done", { rounds: requestedRounds, turns: transcript.length });
      } catch (err) {
        const message =
          err instanceof Anthropic.APIError
            ? `Claude API ${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        send("error", { message });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      /* client disconnected — readable stream cleans up via cancelled flag */
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
