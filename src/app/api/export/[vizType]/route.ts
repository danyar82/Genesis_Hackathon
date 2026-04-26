import { buildHtml } from "@/app/_lib/exportHtml";
import { slugify } from "@/app/_lib/slugify";
import type { PaperDna, VizType } from "@/types/paperDna";

export const runtime = "nodejs";

const VALID_VIZ = new Set<VizType>([
  "3d_particles",
  "2d_chart",
  "interactive_graph",
  "data_dashboard",
  "canvas_physics",
  "math_explorer",
]);

function isPaperDna(input: unknown): input is PaperDna {
  if (!input || typeof input !== "object") return false;
  const o = input as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    typeof o.code_kernel === "string" &&
    typeof o.visualization_type === "string" &&
    Array.isArray(o.parameters)
  );
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ vizType: string }> },
) {
  const { vizType } = await ctx.params;
  if (!VALID_VIZ.has(vizType as VizType)) {
    return Response.json(
      { error: `Unknown vizType "${vizType}"` },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isPaperDna(body)) {
    return Response.json(
      { error: "Body must be a PaperDna object" },
      { status: 400 },
    );
  }

  const html = buildHtml(vizType as VizType, body);
  const filename = slugify(body.title);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.html"`,
      "Cache-Control": "no-store",
    },
  });
}
