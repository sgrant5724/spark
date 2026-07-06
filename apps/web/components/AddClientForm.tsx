"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui";
import { createClientWorkspace } from "@/app/agency/actions";

// Client-side preview slug; the server re-slugifies authoritatively.
const toSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");

/**
 * Owner-only "Add client" form on the Agency Console. Submits to
 * createClientWorkspace, which provisions a fully-configured workspace and makes
 * the creator its owner. Slug auto-derives from the name until edited.
 */
export function AddClientForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [edited, setEdited] = useState(false);
  const effective = edited ? toSlug(slug) : toSlug(name);

  return (
    <form
      action={createClientWorkspace}
      className="rounded-brand border border-lightblue bg-white p-4 shadow-sm"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange text-white" aria-hidden>
          <Building2 className="h-4 w-4" />
        </span>
        <h2 className="font-display text-sm font-semibold text-ink">Add a client</h2>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-[0.6rem] uppercase tracking-wide text-ink/50">Client name</span>
          <input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Nonprofit"
            className="w-full rounded-lg border border-lightblue px-2.5 py-1.5 text-sm text-ink outline-none focus:border-blue"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-[0.6rem] uppercase tracking-wide text-ink/50">URL slug</span>
          <input
            name="slug"
            value={edited ? slug : effective}
            onChange={(e) => {
              setSlug(e.target.value);
              setEdited(true);
            }}
            placeholder="acme-nonprofit"
            className="w-full rounded-lg border border-lightblue px-2.5 py-1.5 font-mono text-sm text-ink outline-none focus:border-blue"
          />
        </label>
        <Button type="submit" disabled={!name.trim()}>
          Add client
        </Button>
      </div>
      <p className="mt-1.5 text-[0.62rem] text-ink/50">
        Creates a fully-configured workspace at{" "}
        <span className="font-mono text-blue">/w/{effective || "…"}</span> — you&apos;ll be its owner.
      </p>
    </form>
  );
}
