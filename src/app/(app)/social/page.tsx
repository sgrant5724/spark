import { redirect } from "next/navigation";

// One-Loop step 6: the Social overview was a second home for what the Inbox
// (attention items) and the Distribute stage (queue, accounts, published)
// now carry. It redirects; nothing it showed was dropped.
export default async function SocialOverviewPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const q = ok ? `?ok=${encodeURIComponent(ok)}` : err ? `?err=${encodeURIComponent(err)}` : "";
  redirect(`/distribute${q}`);
}
