import "server-only";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";

/**
 * Assemble the workspace grounding context injected into every AI prompt:
 * organization profile ("what the client does"), motif directives, keyword
 * strategy, and optionally an SME profile. This is what makes output
 * client-specific instead of generic — and it carries the truthfulness rules.
 */
export async function buildGroundingContext(
  workspaceId: string,
  opts?: { smeProfileId?: string | null },
): Promise<string> {
  const g = await withWorkspace(db, workspaceId, async (tx) => {
    const org = await tx.orgProfile.findUnique({ where: { workspaceId } });
    const motifs = await tx.motif.findMany({
      where: { workspaceId },
      orderBy: { position: "asc" },
    });
    const keywords = await tx.keyword.findMany({
      where: { workspaceId },
      orderBy: [{ tier: "asc" }, { phrase: "asc" }],
      take: 50,
    });
    const sme = opts?.smeProfileId
      ? await tx.smeProfile.findFirst({
          where: { id: opts.smeProfileId, workspaceId },
        })
      : null;
    return { org, motifs, keywords, sme };
  });

  const lines: string[] = [];

  lines.push("## Organization (ground every output in this)");
  if (g.org) {
    if (g.org.description) lines.push(`What they do: ${g.org.description}`);
    if (g.org.industry) lines.push(`Industry: ${g.org.industry}`);
    const services = (g.org.services as Array<{ name: string; blurb?: string }>) ?? [];
    if (services.length)
      lines.push(
        "Services: " + services.map((s) => (s.blurb ? `${s.name} (${s.blurb})` : s.name)).join("; "),
      );
    const audiences = (g.org.audiences as Array<{ name: string; blurb?: string }>) ?? [];
    if (audiences.length)
      lines.push(
        "Audiences: " + audiences.map((a) => (a.blurb ? `${a.name} (${a.blurb})` : a.name)).join("; "),
      );
    if (g.org.differentiators) lines.push(`Differentiators: ${g.org.differentiators}`);
    if (g.org.credentials) lines.push(`Real credentials (only these may be cited): ${g.org.credentials}`);
    if (g.org.toneNotes) lines.push(`Tone guardrails: ${g.org.toneNotes}`);
  } else {
    lines.push("(No organization profile configured — keep output cautious and generic-free; do not guess specifics.)");
  }

  if (g.sme) {
    lines.push("", `## Subject-matter expert: ${g.sme.name}${g.sme.title ? `, ${g.sme.title}` : ""}`);
    const p = (g.sme.profile as Record<string, string>) ?? {};
    for (const [k, v] of Object.entries(p)) if (v) lines.push(`${k}: ${v}`);
  }

  if (g.motifs.length) {
    lines.push("", "## 7 Motifs voice directives");
    for (const m of g.motifs) {
      const d = (m.directive as Record<string, string>) ?? {};
      lines.push(`- ${m.key}: ${d.voice ?? m.name}${d.cta ? ` | CTA: ${d.cta}` : ""}`);
    }
  }

  if (g.keywords.length) {
    lines.push("", "## Keyword strategy (tiers 1-4)");
    lines.push(
      g.keywords
        .map((k) => `T${k.tier} ${k.phrase}${k.audience ? ` [${k.audience}]` : ""}`)
        .join("; "),
    );
  }

  lines.push(
    "",
    "## Hard rules (non-negotiable)",
    "- NEVER fabricate statistics, studies, quotes, citations, or credentials.",
    "- If a claim needs evidence you don't have, phrase it without the claim or mark it [NEEDS SOURCE].",
    "- Semantic heading order: exactly one H1 concept (the title, not in body), body starts at H2, no skipped levels.",
    "- Descriptive link text (never 'click here'). US English.",
  );

  return lines.join("\n");
}
