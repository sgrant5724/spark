import { redirect } from "next/navigation";

// One-Loop step 5: the automation dials live under Settings → Automation.
export default async function AutomationPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const q = ok ? `?ok=${encodeURIComponent(ok)}` : err ? `?err=${encodeURIComponent(err)}` : "";
  redirect(`/setup/automation${q}`);
}
