import { redirect } from "next/navigation";

// One-Loop step 5: the posting schedule, link tagging and campaigns live under
// Settings → Schedule; the auto-dials under Settings → Automation; approval
// under Settings → People.
export default async function SocialSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const q = ok ? `?ok=${encodeURIComponent(ok)}` : err ? `?err=${encodeURIComponent(err)}` : "";
  redirect(`/setup/schedule${q}`);
}
