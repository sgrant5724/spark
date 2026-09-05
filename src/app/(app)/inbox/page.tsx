import Link from "next/link";
import {
  Sparkles, PenLine, Telescope, MessageCircle, ArrowRight, Bot, TrendingUp,
  AlertTriangle, Info, Check, ChevronRight, CalendarClock, Inbox as InboxIcon,
} from "lucide-react";
import { requireMembership, canAdmin, canEdit } from "@/lib/acl";
import { db } from "@/lib/db";
import { getInboxData } from "@/lib/inbox";
import type { HomeDecision, PipelineStage } from "@/lib/home";
import { autopilotFeed, hasSeriesData, homeStats, postPerformance, weeklySeries } from "@/lib/dashboard-data";
import { AreaChart } from "@/components/charts";
import { networkFor } from "@/lib/social/networks";
import { getPublicUrl } from "@/lib/public-url";
import { SubmitButton } from "@/components/SubmitButton";
import { approveSocialPostAction, requestChangesSocialPostAction } from "@/app/actions/social-workflow";
import { answerFindingAction, dismissFindingAction } from "@/app/actions/blog-findings";
import { deleteCitationAction, verifyCitationAction } from "@/app/actions/blog";
import { approveBlogImageAction } from "@/app/actions/blog-images";

/**
 * Inbox — the landing page (One-Loop redesign, step 2; the owner's decision
 * 2026-09-05: "Inbox is the landing page, Home folds in beneath").
 *
 * Order of the page IS the design:
 *   1. Needs you — every item waiting on a person, one card each, its action
 *      on the card. Approve a post, answer a question, verify a claim, pick an
 *      image, hand over a join link — without going to find the page.
 *   2. Conditions — the category-level things Home used to list (accounts,
 *      slots, analytics) that are still true.
 *   3. The pipeline strip, coming up, engine activity, results, launch points —
 *      Home's content, unchanged, beneath.
 *
 * Everything actionable renders as a server-action form (no hydration needed).
 * Approving a post is ADMIN-only, as on the Approvals page — the card shows
 * the post to an editor but not the buttons.
 */

export default async function InboxPage() {
  const { workspace, membership } = await requireMembership();
  const admin = canAdmin(membership.role);
  const editor = canEdit(membership.role);

  const [inbox, stats, series, perf, feed, channels, origin] = await Promise.all([
    getInboxData(workspace.id, { admin }),
    homeStats(workspace.id),
    weeklySeries(workspace.id, 8),
    postPerformance(workspace.id, 5),
    autopilotFeed(workspace.id, 6),
    db.channel.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "asc" }, take: 6 }),
    getPublicUrl(),
  ]);
  const { home } = inbox;
  const warn = inbox.conditions.filter((d) => d.severity === "warn");
  const info = inbox.conditions.filter((d) => d.severity === "info");
  const hasAnalytics = hasSeriesData(series);
  const { nextSend, timeZone } = home.social;
  const nothing = inbox.total === 0 && warn.length === 0;

  return (
    <div>
      {/* ── Header — a sentence, not a hero ─────────────────────────────── */}
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="font-mono text-[22px] font-bold m-0 flex items-center gap-2">
          <InboxIcon className="w-5 h-5" style={{ color: nothing ? "var(--green-on)" : "var(--amber-on)" }} /> Inbox
        </h1>
        <p className="text-[13px] text-[var(--mute)] m-0">
          {nothing
            ? `Nothing needs you in ${workspace.name}. The engine is running.`
            : `${inbox.total} thing${inbox.total === 1 ? "" : "s"} need${inbox.total === 1 ? "s" : ""} you in ${workspace.name} — everything else is running.`}
        </p>
      </div>

      {nothing && (
        <div className="card text-xs flex items-center gap-2 mb-5" style={{ borderColor: "var(--green)" }}>
          <Check className="w-4 h-4" style={{ color: "var(--green-on)" }} />
          No approvals, questions, claims, images or connections are waiting. Come back when the bell rings.
        </div>
      )}

      {/* ── 1 · Needs you — items ───────────────────────────────────────── */}
      {inbox.socialPosts.length > 0 && (
        <Group title="Posts waiting for approval" hue="violet" count={inbox.socialPosts.length}>
          {inbox.socialPosts.map((p) => (
            <li key={p.id} className="card flex flex-col gap-2">
              <p className="text-sm m-0 whitespace-pre-wrap leading-relaxed">{p.text.length > 320 ? `${p.text.slice(0, 320)}…` : p.text}</p>
              <div className="text-[11px] text-[var(--mute)] flex items-center gap-2 flex-wrap">
                <span>{p.providers.length ? p.providers.map((x) => networkFor(x)?.label ?? x).join(" · ") : "no network chosen yet"}</span>
                {p.submittedBy && <span>· by {p.submittedBy}</span>}
                {p.scheduledAt
                  ? <span>· asked for {p.scheduledAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone })}</span>
                  : <span>· takes the next free slot when approved</span>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {admin ? (
                  <>
                    <form action={approveSocialPostAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <SubmitButton className="btn primary sm" pendingText="Approving…">Approve</SubmitButton>
                    </form>
                    <form action={requestChangesSocialPostAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={p.id} />
                      <input name="note" placeholder="what to change (optional)" className="text-[11px] w-44" aria-label="Note for the author" />
                      <SubmitButton className="btn sm" pendingText="…">Request changes</SubmitButton>
                    </form>
                  </>
                ) : (
                  <span className="text-[11px] text-[var(--mute)]">An admin approves this.</span>
                )}
                <span className="flex-1" />
                <Link href={`/social/${p.id}/edit`} className="btn sm">Open</Link>
              </div>
            </li>
          ))}
        </Group>
      )}

      {inbox.questions.length > 0 && (
        <Group title="Questions only you can answer" hue="amber" count={inbox.questions.length}>
          {inbox.questions.map((q) => (
            <li key={q.findingId} className="card">
              <div className="text-[11px] text-[var(--mute)] mb-1">
                For <Link href={`/blog/${q.postId}?tab=optimize`} className="underline">{q.postTitle}</Link>
              </div>
              <div className="text-sm font-semibold leading-snug">{q.title}</div>
              {q.detail && <p className="text-xs text-[var(--mute)] mt-0.5 mb-0">{q.detail}</p>}
              {editor ? (
                <form action={answerFindingAction} className="mt-2 flex flex-col gap-2">
                  <input type="hidden" name="id" value={q.findingId} />
                  {q.questions.map((qq, i) => (
                    <label key={i} className="text-xs flex flex-col gap-1">
                      <span>{qq.q}</span>
                      <textarea name={`a${i}`} rows={2} className="w-full text-sm" placeholder="In your own words — only what you can stand behind if quoted." />
                    </label>
                  ))}
                  <div className="flex items-center gap-2 flex-wrap">
                    <SubmitButton className="btn primary sm" pendingText="Saving and writing…">Answer</SubmitButton>
                    <span className="text-[10px] text-[var(--mute)]">Saved to the Experts profile — asked once.</span>
                    <span className="flex-1" />
                    <form action={dismissFindingAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={q.findingId} />
                      <input name="reason" placeholder="why? (optional)" className="text-[11px] w-32" aria-label="Reason for dismissing" />
                      <SubmitButton className="btn sm" pendingText="…">Dismiss</SubmitButton>
                    </form>
                  </div>
                </form>
              ) : (
                <p className="text-[11px] text-[var(--mute)] mt-1 mb-0">An editor answers this.</p>
              )}
            </li>
          ))}
        </Group>
      )}

      {inbox.citations.length > 0 && (
        <Group title="Claims with no source" hue="rose" count={inbox.citations.length}>
          {inbox.citations.map((c) => (
            <li key={c.id} className="card">
              <div className="text-[11px] text-[var(--mute)] mb-1">
                In <Link href={`/blog/${c.postId}`} className="underline">{c.postTitle}</Link>
                {c.unsourceable && <span> · live search found nothing that supports it</span>}
              </div>
              <p className="text-sm m-0 leading-relaxed">“{c.claim}”</p>
              {editor && (
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <form action={verifyCitationAction} className="flex items-center gap-1.5 flex-wrap">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="sourceUrl" type="url" required placeholder="https://… a source that actually supports it" className="text-xs min-w-72 flex-1" aria-label="Source URL" />
                    <SubmitButton className="btn primary sm" pendingText="Verifying…">Verify</SubmitButton>
                  </form>
                  <form action={deleteCitationAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton className="btn sm" pendingText="…" title="Remove the claim's citation record — edit the sentence out in the editor too">Drop the claim</SubmitButton>
                  </form>
                  <Link href={`/blog/${c.postId}`} className="btn sm">Open</Link>
                </div>
              )}
            </li>
          ))}
        </Group>
      )}

      {inbox.images.length > 0 && (
        <Group title="Images that need your eye" hue="blue" count={inbox.images.length}>
          {inbox.images.map((img) => (
            <li key={img.id} className="card flex items-start gap-3 flex-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.altText ?? ""} className="w-40 h-24 rounded-lg object-cover border border-[var(--line)] shrink-0" />
              <div className="flex-1 min-w-48">
                <div className="text-[11px] text-[var(--mute)]">
                  {img.role === "og" ? "Open Graph image" : "Featured image"} for <Link href={`/blog/${img.postId}`} className="underline">{img.postTitle}</Link>
                </div>
                <div className="text-xs mt-0.5">
                  {img.rejections >= 2
                    ? `Auto-review rejected ${img.rejections} renders in a row and stopped spending — this is the latest.`
                    : "Waiting for a person to approve it."}
                </div>
                {editor && (
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <form action={approveBlogImageAction}>
                      <input type="hidden" name="id" value={img.id} />
                      <SubmitButton className="btn primary sm" pendingText="…">Approve</SubmitButton>
                    </form>
                    <Link href={`/blog/${img.postId}`} className="btn sm">Pick or upload instead</Link>
                  </div>
                )}
              </div>
            </li>
          ))}
        </Group>
      )}

      {inbox.articles.length > 0 && (
        <Group title="Articles held at review" hue="rose" count={inbox.articles.length}>
          {inbox.articles.map((a) => (
            <li key={a.id} className="card flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-56">
                <Link href={`/blog/${a.id}`} className="text-sm font-semibold hover:underline">{a.title}</Link>
                <div className="text-xs text-[var(--mute)] mt-0.5">
                  {a.failing.length === 0
                    ? "Every required check passes — it advances on the next cycle."
                    : `Held by: ${a.failing.join(" · ")}`}
                  {a.openQuestions > 0 && <span> · {a.openQuestions} question{a.openQuestions === 1 ? "" : "s"} above</span>}
                </div>
              </div>
              <Link href={`/blog/${a.id}`} className="btn sm">Open</Link>
            </li>
          ))}
        </Group>
      )}

      {inbox.invitations.length > 0 && (
        <Group title="Invitations not yet accepted" hue="teal" count={inbox.invitations.length}>
          {inbox.invitations.map((i) => (
            <li key={i.id} className="card">
              <div className="text-sm"><b>{i.email}</b> <span className="font-mono text-[10px] text-[var(--mute)]">{i.role}</span> <span className="text-[11px] text-[var(--mute)]">· expires {i.expiresAt.toLocaleDateString()}</span></div>
              <div className="text-[11px] text-[var(--mute)] mt-1">If the email didn&apos;t arrive, send this link yourself (click to select):</div>
              <code className="block text-[11px] select-all break-all mt-0.5">{origin}/invitations/{i.token}</code>
            </li>
          ))}
        </Group>
      )}

      {/* ── 2 · Conditions — category-level, still true ─────────────────── */}
      {warn.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2 mt-5">
            <AlertTriangle className="w-4 h-4" style={{ color: "var(--amber-on)" }} />
            <h2 className="font-mono font-bold text-sm">Also needs attention</h2>
          </div>
          <div className="flex flex-col gap-2 mb-4">
            {warn.map((d) => <DecisionCard key={`${d.module}-${d.kind}`} item={d} />)}
          </div>
        </>
      )}
      {info.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4" style={{ color: "var(--blue-on)" }} />
            <h2 className="font-mono font-bold text-sm">Worth a look</h2>
          </div>
          <div className="flex flex-col gap-2 mb-4">
            {info.map((d) => <DecisionCard key={`${d.module}-${d.kind}`} item={d} />)}
          </div>
        </>
      )}

      {/* ── 3 · The pipeline strip — Home, folded in beneath ────────────── */}
      <h2 className="font-mono font-bold text-sm mb-2 mt-6">How things are</h2>
      <div className="card mb-6 !p-0 overflow-x-auto">
        <div className="flex items-stretch min-w-[720px]">
          {home.pipeline.map((stage, i) => (
            <PipelineCell key={stage.key} stage={stage} first={i === 0} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
        <section className="card">
          <h2 className="font-mono text-[13px] font-bold mb-2 flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4" style={{ color: "var(--blue-on)" }} /> Coming up
          </h2>
          {nextSend ? (
            <p className="text-xs text-[var(--slate)] m-0">
              Next send <b className="font-mono">{nextSend.label}</b> ({timeZone}) on{" "}
              {nextSend.providers.map((p) => networkFor(p)?.label ?? p).join(" · ")}.{" "}
              <Link href="/social/calendar" className="underline">Calendar</Link>
            </p>
          ) : (
            <p className="text-xs text-[var(--mute)] m-0">
              Nothing scheduled. <Link href="/social/compose" className="underline">Compose a post</Link>{" "}
              or <Link href="/social/calendar" className="underline">queue a draft</Link>.
            </p>
          )}
          <p className="text-[11px] text-[var(--mute)] mt-2 mb-0">
            {home.social.slotsConfigured
              ? `${home.social.freeSlotsAhead} free slot${home.social.freeSlotsAhead === 1 ? "" : "s"} in the next 7 days`
              : "No posting slots configured yet"}
            {" · "}{home.social.counts.scheduled} scheduled{" · "}{home.social.counts.drafts} social draft{home.social.counts.drafts === 1 ? "" : "s"}
          </p>
        </section>

        <section className="card">
          <h2 className="font-mono text-[13px] font-bold mb-2 flex items-center gap-1.5">
            <Bot className="w-4 h-4" style={{ color: "var(--violet-on)" }} /> What the engine did
          </h2>
          {feed.length === 0 ? (
            <p className="text-xs text-[var(--mute)] m-0">
              Idle — turn on autonomy under <Link href="/blog/automation" className="underline">Blog → Automation</Link>{" "}
              and <Link href="/social/settings" className="underline">Social → Settings</Link>.
            </p>
          ) : (
            <ul className="m-0 p-0 text-xs">
              {feed.map((e, i) => (
                <li key={i} className="border-t border-[var(--line)] first:border-t-0 py-1.5 flex items-baseline gap-2">
                  <span className="font-mono text-[9.5px] text-[var(--mute)] w-20 shrink-0">
                    {e.at.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone })}
                  </span>
                  {e.href ? <Link href={e.href} className="flex-1 hover:underline">{e.label}</Link> : <span className="flex-1">{e.label}</span>}
                  {e.tone === "warn" && (
                    <span className="font-mono text-[9px] font-bold px-1.5 rounded-full" style={{ background: "var(--rose-soft)", color: "var(--rose-on)" }}>!</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── 4 · Results — measured numbers only ─────────────────────────── */}
      <section className="card mb-6">
        <div className="flex items-center mb-2">
          <h2 className="font-mono text-[15px] font-bold flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: "var(--blue-soft)", color: "var(--blue-on)" }}>
              <TrendingUp className="w-4 h-4" strokeWidth={2.5} />
            </span>
            Results
          </h2>
          <span className="flex-1" />
          <Link href="/social/performance" className="text-xs font-mono text-[var(--accent)] font-semibold hover:underline mr-3">social →</Link>
          <Link href="/blog/analytics" className="text-xs font-mono text-[var(--accent)] font-semibold hover:underline">blog →</Link>
        </div>
        {hasAnalytics ? (
          <AreaChart points={series.map((p) => ({ label: p.label, value: p.impressions }))} color="var(--blue)" title="Blog impressions — last 8 weeks" />
        ) : (
          <p className="text-sm text-[var(--mute)] py-6 text-center m-0">
            No search analytics yet — numbers appear once snapshots exist under{" "}
            <Link href="/blog/analytics" className="underline">Blog → Analytics</Link>. Charts light up from real data, never invented curves.
          </p>
        )}
        {perf.length > 0 && (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-[var(--mute)]">
                  <th className="py-1.5 px-2 font-mono text-[9px] uppercase tracking-wider border-b-2 border-[var(--line)]">Post</th>
                  <th className="py-1.5 px-2 font-mono text-[9px] uppercase tracking-wider border-b-2 border-[var(--line)] text-right">Pos</th>
                  <th className="py-1.5 px-2 font-mono text-[9px] uppercase tracking-wider border-b-2 border-[var(--line)] text-right">Δ</th>
                  <th className="py-1.5 px-2 font-mono text-[9px] uppercase tracking-wider border-b-2 border-[var(--line)] text-right">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {perf.map((p) => {
                  const delta = p.position != null && p.prevPosition != null ? p.prevPosition - p.position : null;
                  return (
                    <tr key={p.id} className="odd:bg-[var(--zebra)] hover:bg-[var(--blue-soft)] transition-colors">
                      <td className="py-1.5 px-2 border-b border-[var(--line)]">
                        <Link href={`/blog/${p.id}`} className="font-semibold hover:underline">{p.title}</Link>
                      </td>
                      <td className="py-1.5 px-2 border-b border-[var(--line)] text-right font-mono tabular-nums">{p.position?.toFixed(1) ?? "—"}</td>
                      <td className="py-1.5 px-2 border-b border-[var(--line)] text-right font-mono tabular-nums font-bold" style={{ color: delta == null ? "var(--mute)" : delta >= 0 ? "var(--green-on)" : "var(--rose-on)" }}>
                        {delta == null ? "—" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}`}
                      </td>
                      <td className="py-1.5 px-2 border-b border-[var(--line)] text-right font-mono tabular-nums">{p.clicks ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 5 · Start something ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-2">
        <h2 className="font-mono font-bold text-sm m-0">Start something</h2>
        <span className="flex-1" />
        {stats.aiBudgetUsedToday > 0 && (
          <span className="text-[10px] font-mono text-[var(--mute)]">{stats.aiBudgetUsedToday} AI runs today</span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <QuickTile href="/social/compose" label="Write a social post" icon={PenLine} color="var(--green-on)" soft="var(--green-soft)" />
        <QuickTile href="/blog/ideas" label="Add a blog idea" icon={Sparkles} color="var(--amber-on)" soft="var(--amber-soft)" />
        <QuickTile href="/intel" label="Explore Intel" icon={Telescope} color="var(--blue-on)" soft="var(--blue-soft)" />
        <QuickTile href="/assistant" label="Ask the assistant" icon={MessageCircle} color="var(--violet-on)" soft="var(--violet-soft)" />
      </div>

      {channels.length > 0 && (
        <section className="card">
          <div className="flex items-center mb-3">
            <h2 className="font-mono text-[15px] font-bold">Your channels</h2>
            <span className="flex-1" />
            <Link href="/onboarding/channel/new" className="text-xs font-mono text-[var(--accent)] font-semibold hover:underline">+ new channel</Link>
          </div>
          <div className="flex gap-3 flex-wrap">
            {channels.map((c) => (
              <Link key={c.id} href={`/channels/${c.id}`} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[var(--line)] hover:border-[var(--accent)] hover:shadow-md transition group">
                <span className="w-9 h-9 rounded-xl grid place-items-center text-white font-mono font-bold text-sm" style={{ background: c.accentColor ?? "var(--accent)" }}>
                  {c.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className="text-[11px] text-[var(--mute)]">{c.presentationStyle ?? "—"} · {c.defaultLanguage}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--mute)] group-hover:text-[var(--accent)] ml-1" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** A group of item cards with a counted header. Only rendered when non-empty. */
function Group({ title, hue, count, children }: { title: string; hue: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="font-mono font-bold text-sm m-0">{title}</h2>
        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `var(--${hue}-soft)`, color: `var(--${hue}-on)` }}>{count}</span>
      </div>
      <ul className="m-0 p-0 flex flex-col gap-2">{children}</ul>
    </section>
  );
}

function PipelineCell({ stage, first }: { stage: PipelineStage; first: boolean }) {
  const parts = stage.parts.filter((p) => p.n > 0);
  return (
    <div className={"flex-1 min-w-[120px] px-3 py-2.5 relative " + (first ? "" : "border-l border-[var(--line)]")}>
      <div className="flex items-center gap-1">
        {!first && <ChevronRight className="w-3 h-3 text-[var(--mute)] -ml-1.5 flex-shrink-0" aria-hidden />}
        <Link href={stage.href} className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--mute)] font-bold hover:text-[var(--accent)] hover:underline truncate">
          {stage.label}
        </Link>
      </div>
      {stage.total === null ? (
        <div className="font-mono font-bold text-[22px] leading-tight text-[var(--mute)]" title={stage.reason}>—</div>
      ) : (
        <Link href={stage.href} className="font-mono font-bold text-[22px] leading-tight tabular-nums block hover:text-[var(--accent)]">
          {stage.total.toLocaleString("en-GB")}
        </Link>
      )}
      <div className="flex gap-2 flex-wrap min-h-[14px]">
        {parts.length > 1
          ? parts.map((p) => (
              <Link key={p.label} href={p.href} className="text-[10px] text-[var(--mute)] hover:underline">
                {p.n} {p.label}
              </Link>
            ))
          : null}
      </div>
    </div>
  );
}

function DecisionCard({ item }: { item: HomeDecision }) {
  const warn = item.severity === "warn";
  const HUES: Record<HomeDecision["module"], string> = { Social: "violet", Blog: "rose", Engage: "cyan", Setup: "teal" };
  const hue = HUES[item.module] ?? "teal";
  return (
    <div className="card flex items-start gap-2.5" style={{ borderColor: warn ? "var(--amber)" : "var(--line)" }}>
      <span className="mt-0.5 flex-shrink-0">
        {warn
          ? <AlertTriangle className="w-4 h-4" style={{ color: "var(--amber-on)" }} />
          : <Info className="w-4 h-4" style={{ color: "var(--blue-on)" }} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
          {item.title}
          <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider" style={{ background: `var(--${hue}-soft)`, color: `var(--${hue}-on)` }}>
            {item.module}
          </span>
        </div>
        <div className="text-xs text-[var(--mute)] leading-relaxed">{item.detail}</div>
      </div>
      <Link href={item.href} className="btn sm flex-shrink-0">{item.cta}</Link>
    </div>
  );
}

function QuickTile({ href, label, icon: Icon, color, soft }: { href: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; color: string; soft: string }) {
  return (
    <Link href={href} className="card flex items-center gap-3 hover:shadow-lg transition group" style={{ borderColor: "var(--line)" }}>
      <span className="w-11 h-11 rounded-xl grid place-items-center group-hover:scale-105 transition" style={{ background: soft, color }}>
        <Icon className="w-5 h-5" strokeWidth={2.25} />
      </span>
      <div className="flex-1">
        <div className="font-semibold text-sm leading-tight">{label}</div>
        <div className="text-[11px] text-[var(--mute)] flex items-center gap-1">go <ArrowRight className="w-3 h-3" /></div>
      </div>
    </Link>
  );
}
