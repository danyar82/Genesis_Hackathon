import Anthropic from "@anthropic-ai/sdk";
import {
  decodeXmlEntities,
  fetchPaperMetadata,
  sseEvent,
  SSE_HEADERS,
  type PaperMeta,
} from "../_helpers";
import {
  FRONTIER_SYNTHESIS_SCHEMA,
  type FrontierDna,
  type FrontierSearchOrigin,
  type FrontierSource,
} from "@/types/frontier";

export const runtime = "nodejs";
export const maxDuration = 300;

/* -------------------------------------------------------------------------- */
/*                              SYSTEM PROMPT                                 */
/* -------------------------------------------------------------------------- */

const FRONTIER_SYSTEM_PROMPT = `You are GENESIS FRONTIER, a synthesis engine for cutting-edge research. The user provides a natural-language research problem. The server has already searched arXiv and OpenAlex, fetched the most relevant papers, and is now feeding you their titles, abstracts, and (where available) full body text.

Your job: produce ONE unified Paper DNA whose code_kernel implements a HYBRID state-of-the-art approach drawing on the strongest ideas across the source papers. This is not a literature survey. It is a constructive synthesis — pick the best idea from each paper that is relevant to the user's problem, fuse them into a single coherent algorithm, and emit a runnable kernel.

OUTPUT RULES (STRICT):

1. visualization_type: pick ONE of [3d_particles, 2d_chart, interactive_graph, canvas_physics, math_explorer, data_dashboard] that best fits the synthesized algorithm. Default to "2d_chart" when the algorithm produces a numeric trajectory; "math_explorer" for scalar-out functions; "canvas_physics" only when there's a true continuous simulation.

2. code_kernel: a single ES module string. NO external libraries, NO I/O, NO network. Pure JavaScript. Deterministic and terminating; cap iteration counts at 5000. Kernel shapes by visualization_type:
   - 2d_chart / interactive_graph / data_dashboard → export default function(params): Array<Record<string, number>>
   - math_explorer → export default function(params): Record<string, number | string>
   - 3d_particles → export init(count, params), default(positions, dt, t, params)
   - canvas_physics → export init(params), simulate(state, dt, params), draw(ctx, state, frame, params)

3. parameters: every parameter referenced inside code_kernel MUST appear here with a sensible numeric default and a [min, max] range. Names are snake_case. Include 3–8 parameters.

4. equations: 3–6 LaTeX equations. When you fuse update rules from multiple papers, write the unified rule first; then optionally include the original variants labeled in \\quad \\text{(Source N)}.

5. classification: pick the dominant category from CLASSIFICATIONS based on the synthesized algorithm.

6. core_algorithm: 2–4 sentences. State the synthesized approach in active voice — "We adapt X from paper A and combine it with Y from paper B to ..."

7. title: a synthesized title that names the hybrid approach (e.g., "Adaptive Importance-Sampled Hamiltonian Descent for Sparse Inference"). NOT a paper-survey title. NOT prefixed with "A Survey of" or "On the".

8. research_problem: echo back the user's natural-language problem verbatim.

9. synthesis_summary: 2–3 sentences explaining WHAT the hybrid does and WHY it draws on these specific source papers.

10. relevance_notes: an array, one entry per input paper (in the same order as supplied). Each entry has paperIndex (0-based, matching input order), title (echo), and relevance_note (1 short sentence — "Provides the variance-reduction step in eq. 3", "Source of the adaptive learning-rate schedule", etc.). If a fetched paper turned out NOT to inform the synthesis, say so honestly: "Surveyed but not used — focuses on a different regime."

11. Honesty contract: ground every choice in evidence from the supplied papers. If the source set is too thin to produce a credible synthesis, you may emit a kernel based on the SINGLE strongest source rather than fabricate cross-paper fusion. Better one solid paper than three hallucinated ones.

Return ONLY the JSON.`;

/* -------------------------------------------------------------------------- */
/*                            SEARCH HELPERS                                  */
/* -------------------------------------------------------------------------- */

type SearchHit = {
  title: string;
  authors: string[];
  url: string;
  arxiv_id: string | null;
  doi: string | null;
  abstract: string;
  search_origin: FrontierSearchOrigin;
  /** Higher = more relevant. arXiv hits get score by reverse-index; OpenAlex
   * brings its own relevance_score. */
  score: number;
};

async function searchArxiv(query: string, max: number): Promise<SearchHit[]> {
  const apiUrl = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(`all:${query}`)}&sortBy=relevance&sortOrder=descending&start=0&max_results=${max}`;
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": "GENESIS/0.1 (hackathon demo)" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const entries = Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g));
  const hits: SearchHit[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i][1];
    const title = decodeXmlEntities(
      (entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").trim(),
    );
    const abstract = decodeXmlEntities(
      (entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "").trim(),
    );
    const idTag = entry.match(/<id>([^<]+)<\/id>/)?.[1] ?? "";
    const arxivIdMatch = idTag.match(/abs\/([a-z\-]+\/\d+|\d{4}\.\d{4,5})/i);
    const arxivId = arxivIdMatch ? arxivIdMatch[1] : null;
    const url = arxivId
      ? `https://arxiv.org/abs/${arxivId}`
      : idTag.trim();
    const authors = Array.from(
      entry.matchAll(/<author>\s*<name>([^<]+)<\/name>/g),
      (m) => decodeXmlEntities(m[1]),
    );
    if (!title) continue;
    hits.push({
      title,
      authors,
      url,
      arxiv_id: arxivId,
      doi: null,
      abstract,
      search_origin: "arxiv",
      score: max - i, // reverse-rank → first result has highest score
    });
  }
  return hits;
}

type OpenAlexWork = {
  id?: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: Array<{ author?: { display_name?: string } }>;
  relevance_score?: number;
  ids?: { arxiv?: string };
  primary_location?: {
    landing_page_url?: string;
    source?: { display_name?: string };
  };
  open_access?: { oa_url?: string };
};

function reconstructInvertedAbstract(
  inv: Record<string, number[]> | null | undefined,
): string {
  if (!inv) return "";
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(inv)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      if (typeof pos === "number" && Number.isFinite(pos) && pos >= 0) {
        slots[pos] = word;
      }
    }
  }
  return slots.filter(Boolean).join(" ");
}

async function searchOpenAlex(
  query: string,
  max: number,
): Promise<SearchHit[]> {
  const apiUrl = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${max}&sort=relevance_score:desc`;
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": "GENESIS/0.1 (hackathon demo)" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: OpenAlexWork[] };
  const works = data.results ?? [];
  const hits: SearchHit[] = [];
  for (const w of works) {
    const title = (w.title ?? w.display_name ?? "").trim();
    if (!title) continue;
    const abstract = reconstructInvertedAbstract(w.abstract_inverted_index);
    const authors = (w.authorships ?? [])
      .map((a) => a.author?.display_name ?? "")
      .filter((s): s is string => !!s);
    const doiRaw = w.doi ?? null;
    const doi = doiRaw ? doiRaw.replace(/^https?:\/\/doi\.org\//, "") : null;
    // Prefer the publisher landing page or OA URL; fall back to DOI URL.
    const url =
      w.primary_location?.landing_page_url ??
      w.open_access?.oa_url ??
      (doi ? `https://doi.org/${doi}` : (w.id ?? ""));
    const arxivExternal = w.ids?.arxiv ?? null;
    const arxivId = arxivExternal
      ? arxivExternal.replace(/^https?:\/\/arxiv\.org\/abs\//, "")
      : null;
    hits.push({
      title,
      authors,
      url,
      arxiv_id: arxivId,
      doi,
      abstract,
      search_origin: "openalex",
      score: typeof w.relevance_score === "number" ? w.relevance_score : 0,
    });
  }
  return hits;
}

/** Normalize a title for fuzzy de-duplication: lowercase, strip
 * non-alphanumeric, collapse whitespace. */
function titleKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
}

function dedupe(hits: SearchHit[]): SearchHit[] {
  const out: SearchHit[] = [];
  const seenArxiv = new Set<string>();
  const seenDoi = new Set<string>();
  const seenTitle = new Set<string>();
  for (const h of hits) {
    const aKey = h.arxiv_id?.toLowerCase();
    const dKey = h.doi?.toLowerCase();
    const tKey = titleKey(h.title);
    if (aKey && seenArxiv.has(aKey)) continue;
    if (dKey && seenDoi.has(dKey)) continue;
    if (tKey && seenTitle.has(tKey)) continue;
    if (aKey) seenArxiv.add(aKey);
    if (dKey) seenDoi.add(dKey);
    if (tKey) seenTitle.add(tKey);
    out.push(h);
  }
  return out;
}

/** Run both searches in parallel, merge, dedupe, sort by a combined score
 * (arXiv hits get a small bonus because we can grab full HTML). */
async function searchAll(query: string, target: number): Promise<SearchHit[]> {
  const [arxiv, oa] = await Promise.all([
    searchArxiv(query, target).catch(() => [] as SearchHit[]),
    searchOpenAlex(query, target).catch(() => [] as SearchHit[]),
  ]);
  // Normalize OpenAlex scores to roughly arXiv's range.
  const oaMax = Math.max(1, ...oa.map((h) => h.score));
  const oaNormalized = oa.map((h) => ({
    ...h,
    score: (h.score / oaMax) * target + 0.3, // arXiv-priority bonus stays positive
  }));
  const arxivBoosted = arxiv.map((h) => ({ ...h, score: h.score + 0.5 }));
  const merged = dedupe([...arxivBoosted, ...oaNormalized]);
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, target);
}

/* -------------------------------------------------------------------------- */
/*                              ROUTE                                         */
/* -------------------------------------------------------------------------- */

type Body = {
  query?: unknown;
  maxPapers?: unknown;
};

type FetchedPaper = {
  hit: SearchHit;
  meta: PaperMeta | null; // null if fetch failed
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query || query.length < 4) {
    return Response.json(
      { error: "Provide a 'query' of at least 4 characters" },
      { status: 400 },
    );
  }

  const requestedMax =
    typeof body.maxPapers === "number" &&
    body.maxPapers >= 3 &&
    body.maxPapers <= 5
      ? Math.floor(body.maxPapers)
      : 5;

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
      let cancelled = false;
      const send = (event: string, data: unknown) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          cancelled = true;
        }
      };

      try {
        // ---------- Phase 1: Search ----------
        send("status", {
          phase: "searching",
          message: "Scouring global databases…",
        });

        const hits = await searchAll(query, requestedMax);
        if (hits.length === 0) {
          send("error", {
            message:
              "No papers found for that query. Try broadening the keywords or rephrasing.",
          });
          controller.close();
          return;
        }

        send("papers_found", {
          query,
          papers: hits.map((h) => ({
            title: h.title,
            authors: h.authors,
            url: h.url,
            search_origin: h.search_origin,
            arxiv_id: h.arxiv_id,
            doi: h.doi,
          })),
        });

        // ---------- Phase 2: Fetch ----------
        send("status", {
          phase: "reading",
          message: `Reading top ${hits.length} papers…`,
          total: hits.length,
        });

        const fetched: FetchedPaper[] = [];
        for (let i = 0; i < hits.length; i++) {
          if (cancelled) break;
          const hit = hits[i];
          send("paper_fetching", {
            paperIndex: i,
            title: hit.title,
          });
          try {
            const meta = await fetchPaperMetadata(hit.url);
            fetched.push({ hit, meta });
            send("paper_fetched", {
              paperIndex: i,
              title: hit.title,
              source: meta.source ?? "unknown",
              hasBody: Boolean(meta.body),
              bodyLength: meta.body?.length ?? 0,
            });
          } catch (err) {
            // Non-fatal — we still have abstract from the search hit.
            fetched.push({ hit, meta: null });
            send("paper_fetched", {
              paperIndex: i,
              title: hit.title,
              source: "search-only",
              hasBody: false,
              bodyLength: 0,
              warning: (err as Error).message,
            });
          }
        }

        if (cancelled) {
          controller.close();
          return;
        }

        const usable = fetched.filter(
          (f) =>
            (f.meta?.body && f.meta.body.length > 800) ||
            f.hit.abstract.length > 200 ||
            (f.meta?.abstract && f.meta.abstract.length > 200),
        );
        if (usable.length === 0) {
          send("error", {
            message:
              "Found papers but couldn't read enough text from any of them. Try a different query.",
          });
          controller.close();
          return;
        }

        // ---------- Phase 3: Synthesize ----------
        send("status", {
          phase: "synthesizing",
          message: "Synthesizing master solution…",
          sourceCount: usable.length,
        });

        // Per-paper body budget: split the synthesis context evenly across
        // papers so a single 150k-char arXiv HTML doesn't crowd out smaller
        // sources. Cap per paper at 25k chars; total upper bound ≈ 125k.
        const perPaperCap = Math.floor(120_000 / usable.length);

        const userContent = [
          `RESEARCH PROBLEM (verbatim from user): "${query}"`,
          "",
          `${usable.length} source papers retrieved (in relevance order):`,
          "",
          ...usable.flatMap((f, i) => {
            const meta = f.meta;
            const abstract =
              (meta?.abstract && meta.abstract.length > 200
                ? meta.abstract
                : f.hit.abstract) || "(no abstract available)";
            const body =
              meta?.body && meta.body.length > 800
                ? meta.body.slice(0, perPaperCap)
                : null;
            return [
              `=== Paper ${i} ===`,
              `Title: ${f.hit.title}`,
              `Authors: ${f.hit.authors.slice(0, 8).join(", ") || "(unknown)"}`,
              `Source: ${f.hit.search_origin}${f.hit.arxiv_id ? ` (arXiv:${f.hit.arxiv_id})` : ""}${f.hit.doi ? ` (doi:${f.hit.doi})` : ""}`,
              `URL: ${f.hit.url}`,
              `Provenance: ${meta?.source ?? "search-result-only"}`,
              "",
              "Abstract:",
              abstract.slice(0, 4000),
              ...(body
                ? [
                    "",
                    "Body excerpt (truncated):",
                    body,
                    "(end body)",
                  ]
                : []),
              "",
            ];
          }),
          "",
          `Synthesize ONE hybrid Paper DNA per the schema. Echo paperIndex 0..${usable.length - 1} in relevance_notes. Respond with JSON only.`,
        ].join("\n");

        const synthStream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 16000,
          system: FRONTIER_SYSTEM_PROMPT,
          output_config: {
            effort: "high",
            format: {
              type: "json_schema",
              schema: FRONTIER_SYNTHESIS_SCHEMA,
            },
          },
          messages: [{ role: "user", content: userContent }],
        });

        let acc = "";
        for await (const ev of synthStream) {
          if (cancelled) break;
          if (
            ev.type === "content_block_delta" &&
            ev.delta.type === "text_delta"
          ) {
            acc += ev.delta.text;
            send("synthesis_delta", { text: ev.delta.text });
          }
        }

        if (cancelled) {
          controller.close();
          return;
        }

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(acc) as Record<string, unknown>;
        } catch (e) {
          throw new Error(
            `Synthesis JSON parse failed: ${(e as Error).message}`,
          );
        }

        // Build the final FrontierDna by merging Opus's content with the
        // server-known source metadata. Opus only generates relevance_note;
        // the server owns title/url/ids/origin so the user always sees real
        // paper links rather than whatever Opus might paraphrase.
        const relevanceList = Array.isArray(parsed.relevance_notes)
          ? (parsed.relevance_notes as Array<{
              paperIndex?: unknown;
              relevance_note?: unknown;
            }>)
          : [];
        const noteByIndex = new Map<number, string>();
        for (const r of relevanceList) {
          if (
            typeof r.paperIndex === "number" &&
            typeof r.relevance_note === "string"
          ) {
            noteByIndex.set(r.paperIndex, r.relevance_note);
          }
        }

        const sources: FrontierSource[] = usable.map((f, i) => ({
          paperIndex: i,
          title: f.hit.title,
          authors: f.hit.authors,
          url: f.hit.url || null,
          arxiv_id: f.hit.arxiv_id,
          doi: f.hit.doi,
          search_origin: f.hit.search_origin,
          relevance_note:
            noteByIndex.get(i) ?? "Surveyed during synthesis.",
        }));

        const frontierDna: FrontierDna = {
          title: String(parsed.title ?? "Hybrid Synthesis"),
          classification: String(parsed.classification ?? "simulation"),
          core_algorithm: String(parsed.core_algorithm ?? ""),
          equations: Array.isArray(parsed.equations)
            ? (parsed.equations as unknown[]).filter(
                (e): e is string => typeof e === "string",
              )
            : [],
          parameters: Array.isArray(parsed.parameters)
            ? (parsed.parameters as FrontierDna["parameters"])
            : [],
          visualization_type: String(parsed.visualization_type ?? "2d_chart"),
          code_kernel: String(parsed.code_kernel ?? ""),
          research_problem: query,
          synthesis_summary: String(parsed.synthesis_summary ?? ""),
          frontier_sources: sources,
        };

        if (!frontierDna.code_kernel || frontierDna.code_kernel.length < 20) {
          throw new Error(
            "Synthesizer returned an empty or trivial code_kernel.",
          );
        }

        send("done", { frontierDna });
        controller.close();
      } catch (err) {
        const message =
          err instanceof Anthropic.APIError
            ? `Claude API ${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        send("error", { message });
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      /* client disconnect — no special teardown needed */
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
