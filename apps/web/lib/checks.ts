/**
 * Automated pre-checks (FR-9 / FR-10 "anti-slop"): pure functions over the
 * article's HTML body. These run before human gates; failures block the
 * transition out of SEO + A11y review.
 */

export type CheckResult = { id: string; label: string; pass: boolean; detail?: string };

const GENERIC_LINK_TEXT = ["click here", "here", "read more", "learn more", "this link", "link"];

export function runA11yChecks(body: string | null, title: string): CheckResult[] {
  const html = body ?? "";
  const results: CheckResult[] = [];

  // 1. No H1 in body — the title is the single H1.
  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  results.push({
    id: "single-h1",
    label: "Exactly one H1 (the title; none in body)",
    pass: h1Count === 0 && title.trim().length > 0,
    detail: h1Count > 0 ? `${h1Count} <h1> found in body` : undefined,
  });

  // 2. Heading order: body starts at H2, no skipped levels.
  const headings = [...html.matchAll(/<h([2-6])[\s>]/gi)].map((m) => parseInt(m[1], 10));
  let orderOk = true;
  let detail: string | undefined;
  if (headings.length === 0 && html.trim()) {
    orderOk = false;
    detail = "No section headings (H2+) found";
  } else {
    if (headings[0] !== 2 && headings.length > 0) {
      orderOk = false;
      detail = `First heading is H${headings[0]}, expected H2`;
    }
    for (let i = 1; i < headings.length && orderOk; i++) {
      if (headings[i] > headings[i - 1] + 1) {
        orderOk = false;
        detail = `H${headings[i - 1]} jumps to H${headings[i]}`;
      }
    }
  }
  results.push({
    id: "heading-order",
    label: "Heading order valid (starts at H2, no skips)",
    pass: orderOk,
    detail,
  });

  // 3. Images have alt attributes (empty alt allowed for decorative).
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const missingAlt = imgs.filter((tag) => !/\balt\s*=/i.test(tag)).length;
  results.push({
    id: "img-alt",
    label: "All images carry alt text (or explicit empty alt)",
    pass: missingAlt === 0,
    detail: missingAlt ? `${missingAlt} image(s) missing alt` : undefined,
  });

  // 4. Descriptive link text.
  const links = [...html.matchAll(/<a\b[^>]*>(.*?)<\/a>/gis)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").trim().toLowerCase(),
  );
  const generic = links.filter((t) => GENERIC_LINK_TEXT.includes(t));
  results.push({
    id: "link-text",
    label: "Link text is descriptive (no “click here”)",
    pass: generic.length === 0,
    detail: generic.length ? `${generic.length} generic link(s)` : undefined,
  });

  // 5. Body exists at all.
  results.push({
    id: "has-body",
    label: "Draft has content",
    pass: html.replace(/<[^>]+>/g, "").trim().length > 200,
    detail: html ? undefined : "Body is empty",
  });

  return results;
}

// ---- SEO derivation (FR-7) — deterministic; no invented data ----------------

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 75)
    .replace(/-$/, "");
}

export function firstParagraphText(body: string | null): string {
  if (!body) return "";
  const m = body.match(/<p[\s>][^]*?<\/p>/i);
  const text = (m ? m[0] : body).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text;
}

/** Trim to a max length at a word boundary without cutting mid-word. */
export function clampText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ")).trim() + "…";
}

export function seoTitle(title: string, siteName?: string): string {
  const suffix = siteName ? ` | ${siteName}` : "";
  const budget = 60 - suffix.length;
  return clampText(title, Math.max(20, budget)) + suffix;
}
