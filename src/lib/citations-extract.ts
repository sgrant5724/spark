/**
 * The claim behind each [NEEDS SOURCE] marker in a body: the sentence that
 * precedes it. Shared by the drafting core (rows at draft time) and
 * auto-review (rows for orphan markers), so a marker can never exist that
 * neither can turn into a workable citation row.
 *
 * ⚠ The previous regex, `([^.!?]*[.!?]?)\s*\[NEEDS SOURCE\]`, stopped at the
 * sentence's own full stop, so a sentence ending in a closing quote —
 * `…donor-advised fund." [NEEDS SOURCE]` — yielded a claim of `"`, which the
 * length filter dropped: no row, no search, no Inbox card, and the article
 * was held for good (LSI, 2026-09-04 → 06). A boundary here is terminal
 * punctuation, then any closing quotes or brackets, then whitespace.
 */
export const NEEDS_SOURCE = "[NEEDS SOURCE]";

export function claimsFromMarkers(plainText: string, max = 3): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /\[NEEDS SOURCE\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(plainText))) {
    // Earlier markers are not part of any claim — strip them before looking
    // for the sentence boundary, or the second of two markers would carry the
    // first one's text.
    const before = plainText.slice(Math.max(0, m.index - 600), m.index).replace(/\[NEEDS SOURCE\]/g, " ").replace(/\s+/g, " ").trimEnd();
    const boundaries = [...before.matchAll(/[.!?]["'”’)\]]*\s+/g)];
    const last = boundaries.length ? boundaries[boundaries.length - 1] : null;
    let claim = before;
    if (last && last.index !== undefined) {
      const candidate = before.slice(last.index + last[0].length).trim();
      // A marker right after a stray quote or fragment: keep the previous
      // sentence too rather than drop the marker on the floor.
      claim = candidate.length > 8 ? candidate : before;
    }
    claim = claim.trim().slice(-300);
    if (claim.length <= 8) continue;
    const key = claim.toLowerCase().slice(-60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(claim);
    if (out.length >= max) break;
  }
  return out;
}
