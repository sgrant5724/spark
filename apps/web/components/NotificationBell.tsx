"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { markNotificationsRead } from "@/app/w/[workspace]/notifications-actions";
import { cx } from "@/lib/cx";

export type Note = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: string; // ISO
  readAt: string | null;
};

function describe(type: string, payload: Record<string, unknown> | null): string {
  const title = typeof payload?.title === "string" ? payload.title : "an article";
  switch (type) {
    case "article.published":
      return `Published “${title}”`;
    case "article.awaiting_approval":
      return `“${title}” is awaiting final approval`;
    case "article.rejected":
      return `“${title}” was sent back for changes`;
    case "pipeline.run":
      return `Pipeline run · ${Number(payload?.processed ?? 0)} auto-drafted`;
    default:
      return type.replace(/[._]/g, " ");
  }
}

function rel(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export function NotificationBell({
  slug,
  items,
  unreadCount,
}: {
  slug: string;
  items: Note[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      const fd = new FormData();
      fd.set("slug", slug);
      await markNotificationsRead(fd);
      router.refresh();
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
      >
        <Bell className="h-[1.05rem] w-[1.05rem]" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 font-mono text-[0.55rem] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Notifications"
            className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-brand border border-line bg-surface shadow-lg"
          >
            <div className="border-b border-paper px-3 py-2">
              <p className="font-display text-xs font-semibold uppercase tracking-wide text-ink/60">
                Notifications
              </p>
            </div>
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-ink/40">You&apos;re all caught up.</p>
            ) : (
              <ul className="max-h-[60vh] overflow-y-auto py-1">
                {items.map((n) => (
                  <li
                    key={n.id}
                    className={cx(
                      "flex gap-2 px-3 py-2 text-xs",
                      !n.readAt && "bg-blue/5",
                    )}
                  >
                    <span
                      className={cx(
                        "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                        n.readAt ? "bg-transparent" : "bg-orange",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-ink">{describe(n.type, n.payload)}</span>
                      <span className="text-[0.6rem] text-ink/40">{rel(n.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
