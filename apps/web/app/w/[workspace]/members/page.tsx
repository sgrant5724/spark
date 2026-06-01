import { requireMembership } from "@/lib/auth-helpers";
import { identity } from "@/lib/identity";
import { ROLES, can } from "@spark/shared";
import { inviteMember } from "./actions";

export default async function MembersPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { membership } = await requireMembership(params.workspace);
  const canManage = can(membership.role, "users.manage");

  const members = await identity.membership.findMany({
    where: { workspaceId: membership.workspaceId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="px-8 py-8">
      <h1 className="mb-6 font-display text-2xl font-bold text-ink">Members</h1>

      <table className="w-full overflow-hidden rounded-brand border border-lightblue bg-white text-sm">
        <thead>
          <tr className="bg-ink text-left text-white">
            <th className="px-4 py-2.5 font-display font-semibold">Email</th>
            <th className="px-4 py-2.5 font-display font-semibold">Name</th>
            <th className="px-4 py-2.5 font-display font-semibold">Role</th>
            <th className="px-4 py-2.5 font-display font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-t border-paper">
              <td className="px-4 py-2.5">{m.user.email}</td>
              <td className="px-4 py-2.5">{m.user.name ?? "—"}</td>
              <td className="px-4 py-2.5 uppercase tracking-wide text-blue">
                {m.role}
              </td>
              <td className="px-4 py-2.5">
                {m.user.passwordHash || m.user.emailVerified ? (
                  <span className="text-blue">active</span>
                ) : (
                  <span className="text-orange">invited</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {canManage ? (
        <form
          action={inviteMember}
          className="mt-8 max-w-xl rounded-brand border border-lightblue bg-white p-5"
        >
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">
            Invite a member
          </h2>
          <input type="hidden" name="slug" value={params.workspace} />
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-ink/60">
                Email
              </span>
              <input
                type="email"
                name="email"
                required
                className="w-full rounded-lg border border-lightblue px-3 py-2 outline-none focus:border-blue"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-ink/60">
                Role
              </span>
              <select
                name="role"
                defaultValue="editor"
                className="rounded-lg border border-lightblue px-3 py-2 outline-none focus:border-blue"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-orange px-4 py-2 font-display text-sm font-semibold text-white"
            >
              Send invite
            </button>
          </div>
          <p className="mt-3 text-[0.7rem] text-ink/50">
            The invitee sets their own password and MFA — Spark never does it for
            them.
          </p>
        </form>
      ) : (
        <p className="mt-6 text-sm text-ink/60">
          Only owners and admins can invite members.
        </p>
      )}
    </div>
  );
}
