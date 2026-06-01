"use client";

import { useRouter } from "next/navigation";
import type { WorkspaceMembership } from "@/lib/auth-helpers";

export function WorkspaceSwitcher({
  memberships,
  currentSlug,
}: {
  memberships: WorkspaceMembership[];
  currentSlug: string;
}) {
  const router = useRouter();

  return (
    <label className="block">
      <span className="sr-only">Switch workspace</span>
      <select
        value={currentSlug}
        onChange={(e) => router.push(`/w/${e.target.value}`)}
        className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white outline-none"
      >
        {memberships.map((m) => (
          <option key={m.workspaceId} value={m.workspaceSlug} className="text-ink">
            {m.workspaceName}
          </option>
        ))}
      </select>
    </label>
  );
}
