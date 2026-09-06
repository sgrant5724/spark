"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/acl";
import { CHANNEL_COOKIE } from "@/lib/channel";

/** Persist the active-channel cookie. Called from the channel switcher form. */
export async function setActiveChannelAction(formData: FormData) {
  const channelId = String(formData.get("channelId") ?? "");
  const { workspace } = await requireMembership();
  const channel = await db.channel.findFirst({
    where: { id: channelId, workspaceId: workspace.id },
  });
  if (!channel) return;
  const jar = await cookies();
  jar.set(CHANNEL_COOKIE, channel.id, { httpOnly: true, sameSite: "lax", path: "/" });
}

/**
 * Switch the active channel AND land on the same sub-page of the chosen one —
 * the channel pages' own switcher (One-Loop step 6; the header one is gone).
 * `to` is computed client-side from the current path; only a channel path is
 * honoured, so a stray value cannot redirect anywhere else.
 */
export async function switchChannelAction(formData: FormData) {
  await setActiveChannelAction(formData);
  const to = String(formData.get("to") ?? "");
  if (/^\/channels\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_/-]*)?$/.test(to)) redirect(to);
}
