import { redirect } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  ChartLine,
  FileText,
  GitBranch,
  GraduationCap,
  Image as ImageIcon,
  KeyRound,
  Lightbulb,
  type LucideIcon,
  Settings,
  Share2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { withWorkspace } from "@spark/db";
import { db } from "@/lib/db";
import { identity } from "@/lib/identity";
import { requireMembership } from "@/lib/auth-helpers";
import { can } from "@spark/shared";
import { EmptyState } from "@/components/ui";

const PAGE_SIZE = 50;

/**
 * Category = the action prefix before the first ".". Each maps to an icon +
 * tone so the timeline is scannable without reading every label. "approve" is
 * the one dot-less action (idea approval).
 */
type Category = {
  key: string;
  label: string;
  Icon: LucideIcon;
  tone: "blue" | "bright" | "orange" | "neutral";
};

const CATEGORIES: Category[] = [
  { key: "article", label: "Content", Icon: FileText, tone: "blue" },
  { key: "idea", label: "Ideas", Icon: Lightbulb, tone: "blue" },
  { key: "approve", label: "Approvals", Icon: BadgeCheck, tone: "bright" },
  { key: "pipeline", label: "Pipeline", Icon: GitBranch, tone: "bright" },
  { key: "social", label: "Social", Icon: Share2, tone: "blue" },
  { key: "analytics", label: "Analytics", Icon: ChartLine, tone: "blue" },
  { key: "citation", label: "Citations", Icon: ShieldCheck, tone: "bright" },
  { key: "asset", label: "Assets", Icon: ImageIcon, tone: "neutral" },
  { key: "sme_profile", label: "SME", Icon: GraduationCap, tone: "neutral" },
  { key: "settings", label: "Settings", Icon: Settings, tone: "neutral" },
  { key: "org_profile", label: "Organization", Icon: Building2, tone: "neutral" },
  { key: "connection", label: "Connections", Icon: Settings, tone: "orange" },
  { key: "llm", label: "AI Provider", Icon: KeyRound, tone: "orange" },
  { key: "user", label: "Members", Icon: Users, tone: "neutral" },
  { key: "workspace", label: "Workspace", Icon: Building2, tone: "neutral" },
];

const CATEGORY_BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));

const FALLBACK_CATEGORY: Category = {
  key: "_",
  label: "Other",
  Icon: Settings,
  tone: "neutral",
};

/** The category prefix for an action string ("article.edited" -> "article"). */
function categoryKey(action: string): string {
  return action.includes(".") ? action.slice(0, action.indexOf(".")) : action;
}

function categoryFor(action: string): Category {
  return CATEGORY_BY_KEY.get(categoryKey(action)) ?? FALLBACK_CATEGORY;
}

const TONE_CLASSES: Record<Category["tone"], { tile: string; stripe: string }> = {
  blue: { tile: "bg-blue text-white", stripe: "bg-blue" },
  bright: { tile: "bg-blue-bright text-white", stripe: "bg-blue-bright" },
  orange: { tile: "bg-orange text-white", stripe: "bg-orange" },
  neutral: { tile: "bg-nav text-white", stripe: "bg-lightblue" },
};

/** "article.published_wordpress" -> "Article published wordpress". */
function humanizeAction(action: string): string {
  const words = action.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: { workspace: string };
  searchParams: {
    category?: string;
    entity?: string;
    actor?: string;
    page?: string;
  };
}) {
  const { membership } = await requireMembership(params.workspace);
  // Audit history is oversight-level — owner/admin only.
  if (!can(membership.role, "workspace.manage")) {
    redirect(`/w/${params.workspace}`);
  }
  const workspaceId = membership.workspaceId;

  const page = Math.max(0, Number.parseInt(searchParams.page ?? "0", 10) || 0);
  const categoryFilter = searchParams.category?.trim() || "";
  const entityFilter = searchParams.entity?.trim() || "";
  const actorFilter = searchParams.actor?.trim() || "";

  // Action filter: category is an action prefix. "approve" is the dot-less one.
  const actionWhere =
    categoryFilter === ""
      ? undefined
      : categoryFilter === "approve"
        ? { equals: "approve" }
        : { startsWith: `${categoryFilter}.` };

  const actorWhere =
    actorFilter === ""
      ? undefined
      : actorFilter === "system"
        ? null
        : actorFilter;

  const where = {
    workspaceId,
    ...(actionWhere ? { action: actionWhere } : {}),
    ...(entityFilter ? { entityType: entityFilter } : {}),
    ...(actorWhere !== undefined ? { actorId: actorWhere } : {}),
  };

  const { rows, total, entityTypes, presentCategoryKeys, actorIds } =
    await withWorkspace(db, workspaceId, async (tx) => {
      const [rows, total, entities, actions, actors] = await Promise.all([
        tx.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: page * PAGE_SIZE,
          take: PAGE_SIZE + 1, // +1 sentinel to detect a next page
        }),
        tx.auditLog.count({ where }),
        tx.auditLog.findMany({
          where: { workspaceId },
          distinct: ["entityType"],
          select: { entityType: true },
        }),
        tx.auditLog.findMany({
          where: { workspaceId },
          distinct: ["action"],
          select: { action: true },
        }),
        tx.auditLog.findMany({
          where: { workspaceId },
          distinct: ["actorId"],
          select: { actorId: true },
        }),
      ]);
      return {
        rows,
        total,
        entityTypes: entities.map((e) => e.entityType).sort(),
        presentCategoryKeys: new Set(actions.map((a) => categoryKey(a.action))),
        actorIds: actors.map((a) => a.actorId),
      };
    });

  const hasNextPage = rows.length > PAGE_SIZE;
  const pageRows = hasNextPage ? rows.slice(0, PAGE_SIZE) : rows;

  // Resolve actor display names (actors are workspace members; null = system/AI).
  const realActorIds = actorIds.filter((id): id is string => !!id);
  const actorUsers = realActorIds.length
    ? await identity.user.findMany({
        where: { id: { in: realActorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const actorName = new Map(
    actorUsers.map((u) => [u.id, u.name ?? u.email]),
  );

  // Filter dropdown options: only categories that actually appear in the log.
  const categoryOptions = CATEGORIES.filter((c) =>
    presentCategoryKeys.has(c.key),
  );
  const hasSystemActor = actorIds.some((id) => !id);

  // Group the visible rows by day for a timeline layout.
  const groups: Array<{ day: string; rows: typeof pageRows }> = [];
  for (const row of pageRows) {
    const day = dayLabel(row.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else groups.push({ day, rows: [row] });
  }

  const anyFilter = !!(categoryFilter || entityFilter || actorFilter);
  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = page * PAGE_SIZE + pageRows.length;

  return (
    <div className="px-8 py-8">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/50">
        Oversight
      </div>
      <h1 className="mb-2 bg-gradient-to-r from-nav to-blue-bright bg-clip-text font-display text-2xl font-bold text-transparent">
        Audit log
      </h1>
      <p className="mb-6 max-w-2xl text-sm text-ink/70">
        Every AI action, edit, approval, and configuration change in this
        workspace, newest first. Entries are immutable and RLS-scoped to this
        tenant.
      </p>

      {/* Filter bar — plain GET form, no client JS. */}
      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-brand border border-line bg-surface p-4"
      >
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-ink/60">
            Category
          </span>
          <select
            name="category"
            defaultValue={categoryFilter}
            className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-ink/60">
            Entity type
          </span>
          <select
            name="entity"
            defaultValue={entityFilter}
            className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="">All entities</option>
            {entityTypes.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-ink/60">
            Actor
          </span>
          <select
            name="actor"
            defaultValue={actorFilter}
            className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="">All actors</option>
            {hasSystemActor ? <option value="system">System / AI</option> : null}
            {actorUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="rounded-lg bg-gradient-to-r from-nav to-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Apply
        </button>
        {anyFilter ? (
          <a
            href={`/w/${params.workspace}/audit`}
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink/70 hover:bg-paper"
          >
            Clear
          </a>
        ) : null}
      </form>

      {total === 0 ? (
        <EmptyState
          title={anyFilter ? "No matching entries" : "No activity yet"}
          description={
            anyFilter
              ? "No audit entries match these filters. Try clearing them."
              : "Actions taken in this workspace will appear here as they happen."
          }
        />
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between text-xs text-ink/60">
            <span className="tabular-nums">
              Showing{" "}
              <span className="font-mono text-ink">
                {rangeStart}–{rangeEnd}
              </span>{" "}
              of <span className="font-mono text-ink">{total}</span>
              {anyFilter ? " (filtered)" : ""}
            </span>
          </div>

          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.day}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">
                  {group.day}
                </h2>
                <ul className="overflow-hidden rounded-brand border border-line bg-surface">
                  {group.rows.map((row) => {
                    const cat = categoryFor(row.action);
                    const tone = TONE_CLASSES[cat.tone];
                    const actor = row.actorId
                      ? actorName.get(row.actorId) ?? "Unknown user"
                      : "System / AI";
                    const meta = row.metadata as Record<string, unknown> | null;
                    const hasMeta = meta && Object.keys(meta).length > 0;
                    return (
                      <li
                        key={row.id}
                        className="flex gap-3 border-t border-paper p-3 first:border-t-0"
                      >
                        <span
                          className={`mt-0.5 w-1 shrink-0 self-stretch rounded-full ${tone.stripe}`}
                          aria-hidden
                        />
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.tile}`}
                          aria-hidden
                        >
                          <cat.Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.9} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="font-medium text-ink">
                              {humanizeAction(row.action)}
                            </span>
                            <span className="rounded bg-paper px-1.5 py-0.5 font-mono text-[0.7rem] text-ink/60">
                              {cat.label} · {row.entityType}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-ink/60">
                            <span className="text-ink/80">{actor}</span>
                            {" · "}
                            <time
                              dateTime={row.createdAt.toISOString()}
                              className="font-mono tabular-nums"
                              title={row.createdAt.toISOString()}
                            >
                              {formatTime(row.createdAt)}
                            </time>
                            {row.entityId ? (
                              <>
                                {" · "}
                                <span className="font-mono">
                                  {row.entityId.slice(0, 8)}
                                </span>
                              </>
                            ) : null}
                          </div>
                          {hasMeta ? (
                            <details className="mt-1.5 text-xs">
                              <summary className="cursor-pointer select-none text-accent hover:underline">
                                Details
                              </summary>
                              <pre className="mt-1 overflow-x-auto rounded-lg bg-paper p-2 font-mono text-[0.7rem] leading-relaxed text-ink/80">
                                {JSON.stringify(meta, null, 2)}
                              </pre>
                            </details>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE ? (
            <nav
              className="mt-6 flex items-center justify-between"
              aria-label="Pagination"
            >
              <PageLink
                slug={params.workspace}
                searchParams={searchParams}
                page={page - 1}
                disabled={page === 0}
                label="← Newer"
              />
              <span className="text-xs text-ink/50">Page {page + 1}</span>
              <PageLink
                slug={params.workspace}
                searchParams={searchParams}
                page={page + 1}
                disabled={!hasNextPage}
                label="Older →"
              />
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

function PageLink({
  slug,
  searchParams,
  page,
  disabled,
  label,
}: {
  slug: string;
  searchParams: { category?: string; entity?: string; actor?: string };
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-paper px-4 py-2 text-sm text-ink/30">
        {label}
      </span>
    );
  }
  const qs = new URLSearchParams();
  if (searchParams.category) qs.set("category", searchParams.category);
  if (searchParams.entity) qs.set("entity", searchParams.entity);
  if (searchParams.actor) qs.set("actor", searchParams.actor);
  if (page > 0) qs.set("page", String(page));
  const href = `/w/${slug}/audit${qs.toString() ? `?${qs}` : ""}`;
  return (
    <a
      href={href}
      className="rounded-lg border border-line px-4 py-2 text-sm text-ink/80 hover:bg-paper"
    >
      {label}
    </a>
  );
}
