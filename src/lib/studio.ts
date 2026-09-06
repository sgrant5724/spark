import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";

/**
 * The video studio as an OPTION (the owner's decision, 5 September: "video
 * first-class as a format, optional as a studio"). The CreateUp scripting
 * studio — script canvas and builder, thumbnails, video renders, the
 * production board — shows when a YouTube channel exists AND the switch under
 * Settings is on; hidden otherwise. Nothing is deleted or blocked: a direct
 * URL still works, only the tabs and controls hide.
 *
 * Packaging an article into a short or a render and YouTube as a distribution
 * target are NOT the studio and are never gated by this.
 */
export const STUDIO_KEY = "studio:enabled"; // absent = on; only "false" turns it off

export type StudioState = { channels: number; on: boolean; show: boolean };

export async function studioState(workspaceId: string): Promise<StudioState> {
  const [channels, raw] = await Promise.all([
    db.channel.count({ where: { workspaceId } }),
    getSetting(STUDIO_KEY, workspaceId).catch(() => ""),
  ]);
  const on = raw !== "false";
  return { channels, on, show: channels > 0 && on };
}
