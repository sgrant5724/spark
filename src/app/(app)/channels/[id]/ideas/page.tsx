import { redirect } from "next/navigation";

// One-Loop step 4: a channel's video-idea library merged into the one Ideas
// board. Old links land on the board filtered to this channel; the idea
// detail page beneath (/channels/<id>/ideas/<ideaId>) is unchanged.
export default async function ChannelIdeasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/ideas?channel=${id}`);
}
