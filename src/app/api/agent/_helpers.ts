export type PaperMetaSource =
  | "arxiv-html"
  | "arxiv-abstract"
  | "pmc-fulltext"
  | "pmc-abstract"
  | "pubmed"
  | "openalex"
  | "generic-html";

export type PaperMeta = {
  title: string;
  abstract: string;
  categories: string[];
  authors: string[];
  /** Full machine-readable body text when the host provides it. Capped per
   * fetcher (arXiv/PMC: 150k, generic: 80k). Absent for abstract-only sources. */
  body?: string;
  /** Provenance tag — lets downstream prompts adjust phrasing and lets us log
   * which path was actually taken without parsing logs. */
  source?: PaperMetaSource;
};

export type PubmedSource = "pubmed" | "pmc";

export const CLASSIFICATIONS = [
  "simulation",
  "optimization",
  "statistical_model",
  "neural_network",
  "physics_engine",
  "economic_model",
  "mathematical_proof",
  "data_visualization",
] as const;

export const VISUALIZATION_TYPES = [
  "3d_particles",
  "2d_chart",
  "interactive_graph",
  "canvas_physics",
  "math_explorer",
  "data_dashboard",
] as const;

export const PAPER_DNA_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    classification: { type: "string", enum: CLASSIFICATIONS },
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
        required: ["name", "description", "default_value", "min", "max", "type"],
        additionalProperties: false,
      },
    },
    visualization_type: { type: "string", enum: VISUALIZATION_TYPES },
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
  additionalProperties: false,
} as const;

export function extractArxivId(url: string): string | null {
  const trimmed = url.trim();
  const match = trimmed.match(
    /arxiv\.org\/(?:abs|pdf|html)\/([a-z\-]+\/\d+|\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?/i,
  );
  if (match) return match[1];
  if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(trimmed)) {
    return trimmed.replace(/v\d+$/, "");
  }
  return null;
}

export function extractPubmedId(
  url: string,
): { id: string; db: PubmedSource } | null {
  const trimmed = url.trim();

  // PMC: pmc.ncbi.nlm.nih.gov/articles/PMC<digits> | ncbi.nlm.nih.gov/pmc/articles/PMC<digits>
  // Also catches bare `/PMC<digits>` anywhere in the path.
  const pmcHost =
    trimmed.match(
      /(?:pmc\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov\/pmc)\/articles\/(PMC\d+)/i,
    ) ?? trimmed.match(/\/(PMC\d+)(?:\b|\/)/i);
  if (pmcHost) return { id: pmcHost[1].toUpperCase(), db: "pmc" };

  // PubMed: pubmed.ncbi.nlm.nih.gov/<PMID> | ncbi.nlm.nih.gov/pubmed/<PMID>
  const pm =
    trimmed.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i) ??
    trimmed.match(/ncbi\.nlm\.nih\.gov\/pubmed\/(\d+)/i);
  if (pm) return { id: pm[1], db: "pubmed" };

  return null;
}

export function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function stripInnerTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Strip HTML chrome (script/style/nav/footer/header) and extract the main
 * content text from an article-like HTML document. Used by both the arXiv
 * ar5iv renderer and the generic publisher fallback.
 *
 * - Prefers <article> > <main> > <div role="main"> > <body>.
 * - Replaces <math>...</math> blocks with " [math] " so MathML doesn't flood
 *   the context window with attributes — readers (LLMs) recover semantics
 *   from surrounding prose.
 * - Returns trimmed, whitespace-collapsed text capped at the supplied limit.
 */
function extractBodyTextFromHtml(html: string, charCap: number): string {
  let h = html;
  // Strip noisy blocks first — order matters less than completeness.
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, " ");
  h = h.replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  h = h.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");
  h = h.replace(/<nav\b[\s\S]*?<\/nav>/gi, " ");
  h = h.replace(/<footer\b[\s\S]*?<\/footer>/gi, " ");
  h = h.replace(/<header\b[\s\S]*?<\/header>/gi, " ");
  h = h.replace(/<aside\b[\s\S]*?<\/aside>/gi, " ");
  // Collapse math + figures so we keep prose readable.
  h = h.replace(/<math\b[\s\S]*?<\/math>/gi, " [math] ");
  h = h.replace(/<svg\b[\s\S]*?<\/svg>/gi, " ");
  h = h.replace(/<figure\b[\s\S]*?<\/figure>/gi, " [figure] ");
  h = h.replace(/<table\b[\s\S]*?<\/table>/gi, " [table] ");

  const pickFirst = (...patterns: RegExp[]): string | null => {
    for (const re of patterns) {
      const m = h.match(re);
      if (m && m[1] && m[1].length > 200) return m[1];
    }
    return null;
  };

  const main =
    pickFirst(
      /<article\b[^>]*>([\s\S]*?)<\/article>/i,
      /<main\b[^>]*>([\s\S]*?)<\/main>/i,
      /<div\b[^>]*\brole=["']main["'][^>]*>([\s\S]*?)<\/div>/i,
      /<body\b[^>]*>([\s\S]*?)<\/body>/i,
    ) ?? h;

  const text = decodeXmlEntities(stripInnerTags(main));
  return text.length > charCap ? text.slice(0, charCap) : text;
}

/** Extract a DOI from the URL or an HTML body. Best-effort; returns null
 * when no DOI is detectable. */
function extractDoi(html: string, url: string): string | null {
  const fromUrl = url.match(
    /(?:doi\.org\/|\/doi\/(?:abs\/|full\/|epdf\/|pdf\/)?)(10\.\d{4,9}\/[^\s"#?&<>]+)/i,
  );
  if (fromUrl) return fromUrl[1].replace(/[).,;]+$/, "");

  const meta = extractMetaContent(html, [
    "citation_doi",
    "dc.identifier",
    "DC.Identifier",
    "prism.doi",
  ]);
  if (meta) {
    const m = meta.match(/(10\.\d{4,9}\/[^\s"#?&<>]+)/);
    if (m) return m[1].replace(/[).,;]+$/, "");
  }

  // Also try a bare DOI anywhere in the HTML head.
  const head = html.slice(0, 50_000);
  const bare = head.match(/\b(10\.\d{4,9}\/[^\s"#?&<>]{4,})\b/);
  if (bare) return bare[1].replace(/[).,;]+$/, "");
  return null;
}

/** Reconstruct OpenAlex's `abstract_inverted_index` (word → positions[]) into
 * a regular abstract string. */
function reconstructInvertedAbstract(
  inv: Record<string, number[]> | null | undefined,
): string {
  if (!inv || typeof inv !== "object") return "";
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

/** OpenAlex fallback — returns abstract + title for paywalled papers when a
 * DOI is detectable. No body, since OpenAlex doesn't host full text. */
async function fetchOpenAlexByDoi(doi: string): Promise<PaperMeta | null> {
  try {
    const apiUrl = `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`;
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "GENESIS/0.1 (hackathon demo)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      abstract_inverted_index?: Record<string, number[]>;
      authorships?: Array<{ author?: { display_name?: string } }>;
      concepts?: Array<{ display_name?: string }>;
    };
    const title = (data.title ?? "").trim() || `DOI ${doi}`;
    const abstract = reconstructInvertedAbstract(data.abstract_inverted_index);
    const authors = Array.isArray(data.authorships)
      ? data.authorships
          .map((a) => a.author?.display_name ?? "")
          .filter((s): s is string => !!s)
      : [];
    const categories = Array.isArray(data.concepts)
      ? data.concepts
          .map((c) => c.display_name ?? "")
          .filter((s): s is string => !!s)
          .slice(0, 5)
      : [];
    if (!abstract && !title) return null;
    return { title, abstract, authors, categories, source: "openalex" };
  } catch {
    return null;
  }
}

/** Try arXiv's ar5iv-style HTML render. Throws on failure so the caller can
 * fall back to the Atom API abstract path. */
async function fetchArxivHtml(id: string): Promise<PaperMeta> {
  const url = `https://arxiv.org/html/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "GENESIS/0.1 (hackathon demo)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`arXiv HTML returned ${res.status} for ${id}`);
  }
  const raw = await res.text();
  const html = raw.length > 1_500_000 ? raw.slice(0, 1_500_000) : raw;

  // arXiv serves a "no HTML available" page for some older papers — detect
  // the marker text or a tiny body and treat as failure.
  if (
    /no html (?:version|render|available)/i.test(html) ||
    /HTML is not available/i.test(html)
  ) {
    throw new Error(`arXiv HTML not available for ${id}`);
  }

  const body = extractBodyTextFromHtml(html, 150_000);
  if (body.length < 800) {
    throw new Error(`arXiv HTML body too short for ${id} (likely no render)`);
  }

  // Title: prefer citation_title meta, fall back to <title>.
  const titleMeta = extractMetaContent(html, ["citation_title", "og:title"]);
  let title = titleMeta?.trim() ?? "";
  if (!title) {
    const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    title = tm
      ? decodeXmlEntities(stripInnerTags(tm[1]))
          // arXiv title format: "[2310.12345] Real Title Here"
          .replace(/^\[\s*[a-z0-9./-]+\s*\]\s*/i, "")
          .slice(0, 300)
      : `arXiv ${id}`;
  }

  // Authors: arXiv HTML embeds repeated <meta name="citation_author"> tags.
  const authors: string[] = [];
  for (const m of html.matchAll(
    /<meta\b[^>]*?(?:name|property)=["']citation_author["'][^>]*?content=["']([^"']+)["'][^>]*>/gi,
  )) {
    authors.push(decodeXmlEntities(m[1]));
  }

  // Abstract: try citation_abstract meta, else extract a short head excerpt.
  const abstractMeta = extractMetaContent(html, [
    "citation_abstract",
    "og:description",
    "description",
  ]);
  const abstract = (abstractMeta ?? body.slice(0, 4000)).trim();

  // Categories: arXiv puts them in citation_arxiv_id / citation_categories;
  // not always reliable, so we ship empty and let the consumer fall through.
  return {
    title,
    abstract,
    authors,
    categories: [],
    body,
    source: "arxiv-html",
  };
}

async function fetchArxivAtom(id: string): Promise<PaperMeta> {
  const apiUrl = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`;
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": "GENESIS/0.1 (hackathon demo)" },
  });
  if (!res.ok) {
    throw new Error(`arXiv API returned ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();

  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (!entryMatch) {
    throw new Error(`No paper found for arXiv ID "${id}"`);
  }
  const entry = entryMatch[1];

  const title = decodeXmlEntities(
    entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "Untitled",
  );
  const abstract = decodeXmlEntities(
    entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "",
  );
  const categories = Array.from(
    entry.matchAll(/<category term="([^"]+)"/g),
    (m) => m[1],
  );
  const authors = Array.from(
    entry.matchAll(/<author>\s*<name>([^<]+)<\/name>/g),
    (m) => decodeXmlEntities(m[1]),
  );

  return {
    title,
    abstract,
    categories,
    authors,
    source: "arxiv-abstract",
  };
}

/**
 * arXiv dispatcher — try the ar5iv HTML render first (gives full body), fall
 * back to the Atom API on any failure (gives abstract-only). The Atom path
 * also has the canonical title/categories/authors which the HTML scrape
 * sometimes misses, so when HTML succeeds we still merge in any missing
 * fields the Atom call could have provided. To keep the happy path fast we
 * only hit Atom when HTML actually failed OR when HTML returned without
 * authors/categories.
 */
async function fetchArxivMetadata(id: string): Promise<PaperMeta> {
  try {
    const html = await fetchArxivHtml(id);
    if (html.authors.length === 0 || !html.categories.length) {
      try {
        const atom = await fetchArxivAtom(id);
        return {
          ...html,
          title: html.title || atom.title,
          authors: html.authors.length ? html.authors : atom.authors,
          categories: html.categories.length
            ? html.categories
            : atom.categories,
        };
      } catch {
        return html;
      }
    }
    return html;
  } catch {
    return fetchArxivAtom(id);
  }
}

function parsePubmedXml(xml: string, fallbackId: string): PaperMeta {
  const titleMatch = xml.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/);
  const title = titleMatch
    ? decodeXmlEntities(stripInnerTags(titleMatch[1]))
    : `PubMed ${fallbackId}`;

  const absMatches = Array.from(
    xml.matchAll(
      /<AbstractText(?:\s+[^>]*Label="([^"]*)")?[^>]*>([\s\S]*?)<\/AbstractText>/g,
    ),
  );
  const abstract = absMatches.length
    ? absMatches
        .map((m) => {
          const label = m[1]?.trim();
          const body = decodeXmlEntities(stripInnerTags(m[2]));
          return label ? `${label}: ${body}` : body;
        })
        .join(" ")
        .trim()
    : "";

  const authors: string[] = [];
  for (const m of xml.matchAll(/<Author[^>]*>([\s\S]*?)<\/Author>/g)) {
    const block = m[1];
    const lname = block.match(/<LastName>([^<]+)<\/LastName>/)?.[1];
    const fname = block.match(/<ForeName>([^<]+)<\/ForeName>/)?.[1];
    if (lname) {
      authors.push(
        decodeXmlEntities([fname, lname].filter(Boolean).join(" ")),
      );
    }
  }

  const categories: string[] = [];
  const journalTitle = xml.match(
    /<Journal>[\s\S]*?<Title>([^<]+)<\/Title>/,
  )?.[1];
  if (journalTitle) categories.push(decodeXmlEntities(journalTitle));
  const meshMatches = Array.from(
    xml.matchAll(/<DescriptorName[^>]*>([^<]+)<\/DescriptorName>/g),
  );
  for (const m of meshMatches.slice(0, 5)) {
    categories.push(decodeXmlEntities(m[1]));
  }

  return { title, abstract, authors, categories, source: "pubmed" };
}

function parsePmcXml(xml: string, fallbackId: string): PaperMeta {
  const titleMatch = xml.match(
    /<article-title[^>]*>([\s\S]*?)<\/article-title>/,
  );
  const title = titleMatch
    ? decodeXmlEntities(stripInnerTags(titleMatch[1]))
    : `PMC ${fallbackId}`;

  const absMatch = xml.match(/<abstract[^>]*>([\s\S]*?)<\/abstract>/);
  const abstract = absMatch
    ? decodeXmlEntities(stripInnerTags(absMatch[1])).slice(0, 8000)
    : "";

  // Full body extraction. JATS XML wraps the methods/results/discussion text
  // in <body>...</body>. Strip nested figures/tables/refs that bloat tokens
  // without adding methodological signal.
  const bodyMatch = xml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/);
  let body: string | undefined;
  if (bodyMatch) {
    let raw = bodyMatch[1];
    raw = raw.replace(/<fig\b[\s\S]*?<\/fig>/gi, " [figure] ");
    raw = raw.replace(/<table-wrap\b[\s\S]*?<\/table-wrap>/gi, " [table] ");
    raw = raw.replace(/<ref-list\b[\s\S]*?<\/ref-list>/gi, " ");
    raw = raw.replace(/<xref\b[^>]*>([\s\S]*?)<\/xref>/gi, "$1");
    const cleaned = decodeXmlEntities(stripInnerTags(raw));
    if (cleaned.length > 800) {
      body = cleaned.length > 150_000 ? cleaned.slice(0, 150_000) : cleaned;
    }
  }

  const authors: string[] = [];
  const contribBlocks = Array.from(
    xml.matchAll(
      /<contrib\b[^>]*contrib-type=["']author["'][^>]*>([\s\S]*?)<\/contrib>/g,
    ),
  );
  const blocks = contribBlocks.length
    ? contribBlocks
    : Array.from(xml.matchAll(/<contrib\b[^>]*>([\s\S]*?)<\/contrib>/g));
  for (const m of blocks) {
    const surname = m[1].match(/<surname>([^<]+)<\/surname>/)?.[1];
    const given = m[1].match(/<given-names>([^<]+)<\/given-names>/)?.[1];
    if (surname) {
      authors.push(
        decodeXmlEntities([given, surname].filter(Boolean).join(" ")),
      );
    }
  }

  const categories: string[] = [];
  const journal = xml.match(/<journal-title[^>]*>([^<]+)<\/journal-title>/)?.[1];
  if (journal) categories.push(decodeXmlEntities(journal));
  const subjectMatches = Array.from(
    xml.matchAll(/<subject[^>]*>([^<]+)<\/subject>/g),
  );
  for (const m of subjectMatches.slice(0, 5)) {
    categories.push(decodeXmlEntities(m[1]));
  }

  return {
    title,
    abstract,
    authors,
    categories,
    body,
    source: body ? "pmc-fulltext" : "pmc-abstract",
  };
}

async function fetchPubmedMetadata(
  id: string,
  db: PubmedSource,
): Promise<PaperMeta> {
  const cleanId = db === "pmc" ? id.replace(/^PMC/i, "") : id;
  const apiUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=${db}&id=${encodeURIComponent(cleanId)}&retmode=xml`;
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": "GENESIS/0.1 (hackathon demo)" },
  });
  if (!res.ok) {
    throw new Error(
      `NCBI ${db} API returned ${res.status} ${res.statusText}`,
    );
  }
  const xml = await res.text();

  if (!xml.trim()) {
    throw new Error(`NCBI returned empty response for ${db} id "${id}"`);
  }

  return db === "pubmed" ? parsePubmedXml(xml, id) : parsePmcXml(xml, id);
}

function extractMetaContent(html: string, names: string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Try: name="X" content="Y"
    const forward = new RegExp(
      `<meta\\b[^>]*?(?:name|property)=["']${escaped}["'][^>]*?content=["']([\\s\\S]*?)["'][^>]*>`,
      "i",
    );
    // Try: content="Y" name="X"  (attribute order flipped)
    const reversed = new RegExp(
      `<meta\\b[^>]*?content=["']([\\s\\S]*?)["'][^>]*?(?:name|property)=["']${escaped}["'][^>]*>`,
      "i",
    );
    const m = html.match(forward) ?? html.match(reversed);
    if (m?.[1]) return decodeXmlEntities(m[1]);
  }
  return null;
}

/**
 * SSRF guard — reject URLs that point at private / link-local / loopback
 * address space before we let the server fetch them. Without this, a user
 * could submit `http://127.0.0.1:5432`, `http://10.x.x.x`, or AWS instance
 * metadata (`http://169.254.169.254/...`) and have the server enumerate
 * internal services on their behalf.
 *
 * Note: this is a hostname-shape check, not a DNS resolution check. A
 * determined attacker could register a public hostname that resolves to
 * 127.0.0.1 (DNS rebinding). For a hackathon-tier service this layer is
 * sufficient; production deployments should add resolution-time rechecks.
 */
function rejectPrivateHosts(parsed: URL): void {
  const host = parsed.hostname.toLowerCase();
  // Loopback + special "this host" names.
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::" ||
    host === "::1" ||
    host.endsWith(".localhost")
  ) {
    throw new Error("Refusing to fetch a loopback address");
  }
  // IPv4 private + link-local + carrier-grade NAT + multicast + broadcast.
  if (
    /^10\./.test(host) ||
    /^127\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||
    /^(22[4-9]|23\d)\./.test(host) ||
    host === "255.255.255.255"
  ) {
    throw new Error("Refusing to fetch a private/reserved IPv4 range");
  }
  // IPv6 unique-local + link-local. Brackets are stripped from URL.hostname.
  if (
    /^f[cd][0-9a-f]{2}:/i.test(host) || // fc00::/7 unique-local
    /^fe[89ab][0-9a-f]:/i.test(host) // fe80::/10 link-local
  ) {
    throw new Error("Refusing to fetch a private IPv6 range");
  }
}

async function fetchGenericPaper(url: string): Promise<PaperMeta> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Could not parse URL: ${url}`);
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }
  rejectPrivateHosts(parsed);

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; GENESIS/0.1; +https://example.com/genesis)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
    // Match the timeouts on fetchArxivHtml (15s) and fetchOpenAlexByDoi (10s)
    // so a slow publisher can't hold a route worker for the full maxDuration.
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Fetch ${parsed.host} returned ${res.status}`);
  }

  const raw = await res.text();
  // Cap at 500 KB so pathological pages don't blow up memory.
  const html = raw.length > 500_000 ? raw.slice(0, 500_000) : raw;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? decodeXmlEntities(stripInnerTags(titleMatch[1])).slice(0, 300)
    : parsed.hostname;

  const abstract =
    extractMetaContent(html, [
      "citation_abstract",
      "og:description",
      "twitter:description",
      "description",
    ])?.slice(0, 4000) ?? "";

  const authors: string[] = [];
  for (const m of html.matchAll(
    /<meta\b[^>]*?(?:name|property)=["']citation_author["'][^>]*?content=["']([^"']+)["'][^>]*>/gi,
  )) {
    authors.push(decodeXmlEntities(m[1]));
  }

  const categories: string[] = [];
  const journal = extractMetaContent(html, ["citation_journal_title"]);
  if (journal) categories.push(journal);
  const siteName = extractMetaContent(html, ["og:site_name"]);
  if (siteName && !categories.includes(siteName)) categories.push(siteName);

  // Body extraction — try the same article > main > body chain we use for
  // arXiv. Publisher pages often have nav/promo cruft we can't strip
  // perfectly, so cap smaller (80k) than the arXiv/PMC paths.
  const bodyText = extractBodyTextFromHtml(html, 80_000);
  const body = bodyText.length > 1500 ? bodyText : undefined;

  if (!title && !abstract) {
    throw new Error(
      `Could not extract paper metadata from ${parsed.host} (no title or description meta)`,
    );
  }

  // OpenAlex paywall fallback — when the page surfaced almost no usable text
  // (closed publishers like Elsevier/Wiley/Oxford serve thin pages to
  // unauthenticated clients), try to recover a real abstract via DOI.
  const looksThin = !body && (abstract.length < 600);
  if (looksThin) {
    const doi = extractDoi(html, url);
    if (doi) {
      const fromOpenAlex = await fetchOpenAlexByDoi(doi);
      if (fromOpenAlex && (fromOpenAlex.abstract || fromOpenAlex.title)) {
        return {
          title: fromOpenAlex.title || title,
          abstract: fromOpenAlex.abstract || abstract,
          authors: fromOpenAlex.authors.length ? fromOpenAlex.authors : authors,
          categories: fromOpenAlex.categories.length
            ? fromOpenAlex.categories
            : categories,
          source: "openalex",
        };
      }
    }
  }

  return { title, abstract, authors, categories, body, source: "generic-html" };
}

/**
 * Unified paper-metadata fetcher.
 *
 * Dispatches based on the URL/identifier:
 *   1. arXiv (incl. bare IDs like "1412.6980")   → arXiv Atom API
 *   2. PubMed / PMC NCBI URLs                     → NCBI EFetch
 *   3. Any other http(s) URL                      → HTML <title> + <meta> fallback
 *
 * Throws with a clear message on malformed input or upstream failures.
 */
export async function fetchPaperMetadata(input: string): Promise<PaperMeta> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty URL");

  const arxivId = extractArxivId(trimmed);
  if (arxivId) return fetchArxivMetadata(arxivId);

  const pubmed = extractPubmedId(trimmed);
  if (pubmed) return fetchPubmedMetadata(pubmed.id, pubmed.db);

  return fetchGenericPaper(trimmed);
}

export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;
