/** Tiny classnames joiner — filters falsy so conditional classes stay readable. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
