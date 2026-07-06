"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUserId, getUserMemberships } from "@/lib/auth-helpers";
import { identity } from "@/lib/identity";
import { slugify } from "@/lib/checks";
import { provisionWorkspace } from "@/lib/provision";

/**
 * Create a new client workspace. Owner-only: the caller must hold the `owner`
 * role in at least one workspace (the agency owner). The new workspace is fully
 * provisioned with defaults and the creator becomes its owner. Errors surface as
 * an inline banner on /agency via ?error=.
 */
export async function createClientWorkspace(formData: FormData): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?callbackUrl=/agency");

  const memberships = await getUserMemberships(userId);
  const isOwner = memberships.some((m) => m.role === "owner");

  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug = slugify(slugInput || name);

  const fail = (msg: string) => redirect(`/agency?error=${encodeURIComponent(msg)}`);

  if (!isOwner) fail("Only an owner can add a client.");
  if (!name) fail("A client name is required.");
  if (!slug) fail("Enter a name that yields a valid URL slug (letters/numbers).");

  let err: string | null = null;
  try {
    const [wsTaken, orgTaken] = await Promise.all([
      identity.workspace.findUnique({ where: { slug } }),
      identity.organization.findUnique({ where: { slug } }),
    ]);
    if (wsTaken || orgTaken) {
      err = `The URL “/w/${slug}” is already taken — choose a different name or slug.`;
    } else {
      await provisionWorkspace({ name, slug, ownerUserId: userId });
    }
  } catch (e) {
    err = e instanceof Error ? e.message : "Could not create the client. Please try again.";
  }

  if (err) fail(err);
  revalidatePath("/agency");
  redirect(`/w/${slug}`);
}
