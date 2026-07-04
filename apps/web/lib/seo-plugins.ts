/**
 * SEO plugin field mapping (FR-7): one canonical field schema, translated to
 * the workspace's chosen plugin. Squirrly first; Rank Math and Yoast map from
 * the same canonical set so new plugins are cheap to add.
 */

export type CanonicalSeo = {
  title: string | null;
  meta: string | null;
  focusKeyword: string | null;
  canonical: string | null;
  ogTitle: string | null;
  ogDesc: string | null;
};

export type PluginField = { key: string; label: string; value: string };

const MAPPINGS: Record<string, Array<{ key: string; label: string; from: keyof CanonicalSeo }>> = {
  squirrly: [
    { key: "_sq_title", label: "SEO Title", from: "title" },
    { key: "_sq_description", label: "Meta Description", from: "meta" },
    { key: "_sq_keywords", label: "Keywords", from: "focusKeyword" },
    { key: "_sq_canonical", label: "Canonical Link", from: "canonical" },
    { key: "_sq_og_title", label: "Open Graph Title", from: "ogTitle" },
    { key: "_sq_og_description", label: "Open Graph Description", from: "ogDesc" },
  ],
  rank_math: [
    { key: "rank_math_title", label: "SEO Title", from: "title" },
    { key: "rank_math_description", label: "Description", from: "meta" },
    { key: "rank_math_focus_keyword", label: "Focus Keyword", from: "focusKeyword" },
    { key: "rank_math_canonical_url", label: "Canonical URL", from: "canonical" },
    { key: "rank_math_facebook_title", label: "Facebook Title", from: "ogTitle" },
    { key: "rank_math_facebook_description", label: "Facebook Description", from: "ogDesc" },
  ],
  yoast: [
    { key: "_yoast_wpseo_title", label: "SEO Title", from: "title" },
    { key: "_yoast_wpseo_metadesc", label: "Meta Description", from: "meta" },
    { key: "_yoast_wpseo_focuskw", label: "Focus Keyphrase", from: "focusKeyword" },
    { key: "_yoast_wpseo_canonical", label: "Canonical URL", from: "canonical" },
    { key: "_yoast_wpseo_opengraph-title", label: "Facebook Title", from: "ogTitle" },
    { key: "_yoast_wpseo_opengraph-description", label: "Facebook Description", from: "ogDesc" },
  ],
};

/** Translate canonical SEO fields to the plugin's post-meta keys. */
export function mapToPlugin(plugin: string, seo: CanonicalSeo): PluginField[] {
  const mapping = MAPPINGS[plugin] ?? MAPPINGS.squirrly;
  return mapping
    .map((m) => ({ key: m.key, label: m.label, value: seo[m.from] ?? "" }))
    .filter((f) => f.value);
}

/** WP REST `meta` payload for the plugin (used at publish time). */
export function pluginMetaPayload(plugin: string, seo: CanonicalSeo): Record<string, string> {
  return Object.fromEntries(mapToPlugin(plugin, seo).map((f) => [f.key, f.value]));
}
