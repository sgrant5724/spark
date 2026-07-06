"use server";

import { revalidatePath } from "next/cache";
import { IdeaSource, IdeaStatus, Prisma, withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { getLlm } from "@/lib/llm";
import { buildGroundingContext } from "@/lib/grounding";
import { can } from "@spark/shared";

async function requireStrategist(slug: string) {
  const { userId, membership } = await requireMembership(slug);
  if (!can(membership.role, "strategy.manage")) {
    throw new Error("You don't have permission to manage ideas.");
  }
  return { userId, workspaceId: membership.workspaceId };
}

// ---- Manual idea ------------------------------------------------------------
export async function createIdea(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireStrategist(slug);
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required.");
  const tierRaw = parseInt(String(formData.get("tier") ?? ""), 10);

  const created = await withWorkspace(db, workspaceId, (tx) =>
    tx.idea.create({
      data: {
        workspaceId,
        title,
        source: IdeaSource.manual,
        tier: tierRaw >= 1 && tierRaw <= 4 ? tierRaw : null,
        audience: String(formData.get("audience") ?? "").trim() || null,
        status: IdeaStatus.discovered,
        createdBy: userId,
      },
    }),
  );
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "idea.created",
    entityType: "idea",
    entityId: created.id,
    metadata: { title, source: "manual" },
  });
  revalidatePath(`/w/${slug}/ideas`);
}

// ---- AI discovery (grounded in org profile + keywords; no invented metrics) --
export async function discoverIdeas(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireStrategist(slug);

  const grounding = await buildGroundingContext(workspaceId);
  const llm = getLlm();

  const system = [
    "You are Spark's idea-discovery engine, proposing blog topic ideas for the organization below.",
    "Task: propose 6 specific, non-generic topic ideas tuned to this organization's industry, services, audiences, and keyword strategy. Prefer questions real customers ask, timely angles, and gaps the keyword list suggests.",
    "You must NOT invent search volumes, difficulty scores, trend statistics, or any metric. Ideas are suggestions to be validated by humans and real research tools.",
    'Return ONLY a JSON array: [{"title": string, "angle": string, "audience": string, "tier": 1|2|3|4, "suggestedMotifs": {"motifKey": weight}}] — no prose, no code fences.',
    "",
    grounding,
  ].join("\n");

  const raw = await llm.complete({
    system,
    messages: [{ role: "user", content: "Propose the topic ideas now." }],
    maxTokens: 2048,
  });

  type IdeaOut = {
    title?: string;
    angle?: string;
    audience?: string;
    tier?: number;
    suggestedMotifs?: Record<string, number>;
  };
  let ideas: IdeaOut[] = [];
  try {
    const jsonStart = raw.indexOf("[");
    const jsonEnd = raw.lastIndexOf("]");
    ideas = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as IdeaOut[];
  } catch {
    throw new Error(
      "AI discovery returned an unparseable response — try again. (Provider: " + llm.provider + ")",
    );
  }

  let createdCount = 0;
  await withWorkspace(db, workspaceId, async (tx) => {
    for (const i of ideas.slice(0, 10)) {
      const title = (i.title ?? "").trim();
      if (!title) continue;
      // Dedupe against existing ideas by title (case-insensitive).
      const dup = await tx.idea.findFirst({
        where: { workspaceId, title: { equals: title, mode: "insensitive" } },
      });
      if (dup) continue;
      await tx.idea.create({
        data: {
          workspaceId,
          title,
          source: IdeaSource.analytics, // AI-researched; validated by humans
          tier: i.tier && i.tier >= 1 && i.tier <= 4 ? i.tier : null,
          audience: i.audience?.trim() || null,
          suggestedMotifs: (i.suggestedMotifs ?? {}) as Prisma.InputJsonValue,
          status: IdeaStatus.discovered,
          createdBy: userId,
        },
      });
      createdCount++;
    }
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "idea.ai_discovery",
    entityType: "idea",
    metadata: { provider: llm.provider, proposed: ideas.length, created: createdCount },
  });
  revalidatePath(`/w/${slug}/ideas`);
}

// ---- Status transitions ------------------------------------------------------
export async function setIdeaStatus(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const statusRaw = String(formData.get("status"));
  const { userId, workspaceId } = await requireStrategist(slug);
  const status = (Object.values(IdeaStatus) as string[]).includes(statusRaw)
    ? (statusRaw as IdeaStatus)
    : null;
  if (!status) throw new Error("Invalid status.");

  await withWorkspace(db, workspaceId, (tx) =>
    tx.idea.updateMany({ where: { id, workspaceId }, data: { status } }),
  );
  await writeAudit({
    workspaceId,
    actorId: userId,
    action: `idea.${status}`,
    entityType: "idea",
    entityId: id,
  });
  revalidatePath(`/w/${slug}/ideas`);
}

// ---- One-click pipeline run (FR-13, manual-trigger flavor) --------------------
// For each approved idea without an article yet: create the article, generate
// the draft, and park it at draft_review — the human gate. Capped per run to
// bound LLM cost/latency; re-run to process more.
export async function runPipeline(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const { userId, workspaceId } = await requireStrategist(slug);
  const CAP = 2;

  const ideas = await withWorkspace(db, workspaceId, (tx) =>
    tx.idea.findMany({
      where: { workspaceId, status: IdeaStatus.approved, articles: { none: {} } },
      orderBy: { createdAt: "asc" },
      take: CAP,
    }),
  );

  const { generateDraftCore } = await import("@/lib/pipeline");
  let processed = 0;
  for (const idea of ideas) {
    const article = await withWorkspace(db, workspaceId, (tx) =>
      tx.article.create({
        data: {
          workspaceId,
          ideaId: idea.id,
          title: idea.title,
          state: "drafting",
          tier: idea.tier,
          audience: idea.audience,
          motifMix: (idea.suggestedMotifs ?? {}) as Prisma.InputJsonValue,
          createdBy: userId,
          updatedBy: userId,
        },
      }),
    );
    await generateDraftCore(workspaceId, userId, article.id);
    await withWorkspace(db, workspaceId, async (tx) => {
      await tx.article.update({
        where: { id: article.id },
        data: { state: "draft_review", updatedBy: userId },
      });
      await tx.approval.create({
        data: {
          workspaceId,
          articleId: article.id,
          gate: "draft_review",
          reviewerId: null,
          decision: null, // parked at the human gate — awaiting a reviewer
        },
      });
    });
    processed++;
  }

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "pipeline.run",
    entityType: "article",
    metadata: { processed, capped: ideas.length === CAP },
  });
  if (processed > 0) {
    await createNotification({ workspaceId, type: "pipeline.run", payload: { processed } });
  }
  revalidatePath(`/w/${slug}/ideas`);
  revalidatePath(`/w/${slug}/content`);
  revalidatePath(`/w/${slug}/workflow`);
}

// ---- Approve → send to draft (creates the Article) ---------------------------
export async function sendToDraft(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const { userId, workspaceId } = await requireStrategist(slug);

  const articleId = await withWorkspace(db, workspaceId, async (tx) => {
    const idea = await tx.idea.findFirst({ where: { id, workspaceId } });
    if (!idea) throw new Error("Idea not found.");
    await tx.idea.update({ where: { id }, data: { status: IdeaStatus.approved } });
    const article = await tx.article.create({
      data: {
        workspaceId,
        ideaId: idea.id,
        title: idea.title,
        state: "drafting",
        tier: idea.tier,
        audience: idea.audience,
        motifMix: (idea.suggestedMotifs ?? {}) as Prisma.InputJsonValue,
        createdBy: userId,
        updatedBy: userId,
      },
    });
    return article.id;
  });

  await writeAudit({
    workspaceId,
    actorId: userId,
    action: "idea.sent_to_draft",
    entityType: "article",
    entityId: articleId,
    metadata: { ideaId: id },
  });
  revalidatePath(`/w/${slug}/ideas`);
  revalidatePath(`/w/${slug}/content`);
}
