import Link from "next/link";

const FIELD_DEFS: Array<{ key: string; label: string; hint: string }> = [
  { key: "experience", label: "Experience", hint: "Years, roles, domains, credentials" },
  { key: "expertise", label: "Areas of expertise", hint: "What this expert is authoritative on" },
  { key: "opinions", label: "Strong opinions / point of view", hint: "Stances the writing should reflect" },
  { key: "caseStudies", label: "Case studies & results", hint: "Real, attributable outcomes (no invented numbers)" },
  { key: "examples", label: "Examples & anecdotes", hint: "Stories the expert tells" },
  { key: "alwaysSay", label: "Always say", hint: "Phrases, framings, must-mentions" },
  { key: "neverSay", label: "Never say", hint: "Off-limits claims, words, or framings" },
];

const inputCls =
  "w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:bg-paper disabled:text-ink/60";
const labelCls = "mb-1 block text-[0.65rem] uppercase tracking-wide text-ink/60";

export function SmeProfileForm({
  slug,
  action,
  id,
  name = "",
  title = "",
  data = {},
  canManage,
}: {
  slug: string;
  action: (formData: FormData) => Promise<void>;
  id?: string;
  name?: string;
  title?: string;
  data?: Record<string, string>;
  canManage: boolean;
}) {
  const disabled = !canManage;
  return (
    <form action={action} className="max-w-3xl space-y-4">
      <input type="hidden" name="slug" value={slug} />
      {id && <input type="hidden" name="id" value={id} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Name *</span>
          <input name="name" defaultValue={name} required disabled={disabled} className={inputCls} />
        </label>
        <label>
          <span className={labelCls}>Title / role</span>
          <input name="title" defaultValue={title} disabled={disabled} className={inputCls} />
        </label>
      </div>

      {FIELD_DEFS.map((f) => (
        <label key={f.key} className="block">
          <span className={labelCls}>{f.label}</span>
          <textarea
            name={f.key}
            defaultValue={data[f.key] ?? ""}
            rows={3}
            disabled={disabled}
            placeholder={f.hint}
            className={inputCls}
          />
        </label>
      ))}

      <div className="flex items-center gap-3 pt-1">
        {canManage && (
          <button
            type="submit"
            className="rounded-lg bg-orange px-4 py-2 font-display text-sm font-semibold text-white"
          >
            Save profile
          </button>
        )}
        <Link href={`/w/${slug}/sme`} className="text-sm text-accent underline">
          {canManage ? "Cancel" : "Back"}
        </Link>
      </div>
    </form>
  );
}
