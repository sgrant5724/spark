import { NextRequest, NextResponse } from "next/server";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

/**
 * Brand-styled SVG infographic generated from the article's structure (title +
 * key H2 sections). Served on demand — no binary storage; downloadable and
 * embeddable in WordPress as an image. Accessible: <title>/<desc> + role.
 */

const BRAND = {
  nav: "#0A3A56",
  blue: "#0D5A84",
  orange: "#C4571C",
  yellow: "#F8CF40",
  lightblue: "#B1D4E0",
  paper: "#EFF3FA",
  ink: "#343433",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { workspace: string; id: string } },
) {
  const { membership } = await requireMembership(params.workspace);

  const data = await withWorkspace(db, membership.workspaceId, async (tx) => {
    const article = await tx.article.findFirst({
      where: { id: params.id, workspaceId: membership.workspaceId },
    });
    const brand = await tx.brandKit.findUnique({
      where: { workspaceId: membership.workspaceId },
    });
    const org = await tx.orgProfile.findUnique({
      where: { workspaceId: membership.workspaceId },
    });
    const ws = await tx.workspace.findFirst({
      where: { id: membership.workspaceId },
    });
    return { article, brand, org, ws };
  });
  if (!data.article) return new NextResponse("Not found", { status: 404 });

  // Key points = first 5 H2 headings (excluding boilerplate sections).
  const skip = /sources|mindset|conclusion|about/i;
  const points = [...(data.article.body ?? "").matchAll(/<h2[^>]*>(.*?)<\/h2>/gis)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter((t) => t && !skip.test(t))
    .slice(0, 5);

  const W = 1200;
  const headerH = 210;
  const rowH = 118;
  const footerH = 90;
  const H = headerH + Math.max(points.length, 1) * rowH + footerH;
  const accents = [BRAND.orange, BRAND.yellow, BRAND.blue, BRAND.lightblue, BRAND.orange];

  const titleLines = wrap(data.article.title, 42);
  const brandName = data.ws?.name ?? "Spark";
  const credit = (data.brand?.footerCredit as string) || brandName;

  const rows = points.length
    ? points
        .map((p, i) => {
          const y = headerH + i * rowH;
          const lines = wrap(p, 58);
          return `
  <g transform="translate(60, ${y})">
    <circle cx="34" cy="${rowH / 2 - 10}" r="26" fill="${accents[i % accents.length]}"/>
    <text x="34" y="${rowH / 2 - 1}" text-anchor="middle" font-size="24" font-weight="700" fill="#fff" font-family="Quicksand, sans-serif">${i + 1}</text>
    ${lines
      .map(
        (l, j) =>
          `<text x="92" y="${rowH / 2 - 18 + j * 28}" font-size="24" fill="${BRAND.ink}" font-family="Quicksand, sans-serif">${esc(l)}</text>`,
      )
      .join("")}
    <line x1="92" y1="${rowH - 26}" x2="${W - 120}" y2="${rowH - 26}" stroke="${BRAND.lightblue}" stroke-width="1"/>
  </g>`;
        })
        .join("")
    : `<text x="60" y="${headerH + 60}" font-size="24" fill="${BRAND.ink}" font-family="Quicksand, sans-serif">Generate the draft first — key sections become the infographic.</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="ig-title ig-desc">
  <title id="ig-title">${esc(data.article.title)} — key takeaways</title>
  <desc id="ig-desc">Infographic listing the key points of the article "${esc(data.article.title)}" by ${esc(brandName)}.</desc>
  <rect width="${W}" height="${H}" fill="${BRAND.paper}"/>
  <rect width="${W}" height="${headerH}" fill="${BRAND.nav}"/>
  <rect x="0" y="${headerH - 8}" width="${W}" height="8" fill="${BRAND.orange}"/>
  <g transform="translate(60, 58)">
    <rect width="46" height="46" rx="12" fill="${BRAND.orange}"/>
    <rect x="10.5" y="10.5" width="25" height="25" rx="6" fill="${BRAND.nav}"/>
    <text x="62" y="32" font-size="20" letter-spacing="4" fill="${BRAND.lightblue}" font-family="Quicksand, sans-serif">${esc(brandName.toUpperCase())}</text>
  </g>
  ${titleLines
    .map(
      (l, i) =>
        `<text x="60" y="${132 + i * 36}" font-size="32" font-weight="700" fill="#fff" font-family="Quicksand, sans-serif">${esc(l)}</text>`,
    )
    .join("")}
  ${rows}
  <rect y="${H - footerH}" width="${W}" height="${footerH}" fill="${BRAND.nav}"/>
  <text x="60" y="${H - footerH / 2 + 6}" font-size="20" fill="${BRAND.lightblue}" font-family="Quicksand, sans-serif">${esc(credit)}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "private, max-age=60",
    },
  });
}
