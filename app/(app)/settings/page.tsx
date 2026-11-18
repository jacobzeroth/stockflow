import {
  changePasswordAction,
  createUserAction,
  deleteEverythingAction,
  loadDemoDataAction,
  toggleUserAction,
  updateWorkspaceAction,
} from "@/app/actions/inventory";
import { requireUser } from "@/lib/auth";
import { listUsers, listProducts } from "@/lib/data";
import { getWorkspace } from "@/lib/workspace";
import { CURRENCIES, currencyLabel } from "@/lib/currency";
import { CardHeader, Flash, PageHeader, day } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string };
}) {
  const user = await requireUser();
  const [users, products, workspace] = await Promise.all([
    listUsers(),
    listProducts(),
    getWorkspace(),
  ]);
  const isOwner = user.role === "owner";

  return (
    <div>
      <PageHeader title="Settings" subtitle="Account, team access and workspace data" />

      <Flash error={searchParams.error} ok={searchParams.ok} />

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white">Your account</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between border-b border-line/60 pb-2">
              <dt className="text-muted">Name</dt>
              <dd className="text-silver">{user.name}</dd>
            </div>
            <div className="flex justify-between border-b border-line/60 pb-2">
              <dt className="text-muted">Email</dt>
              <dd className="text-silver">{user.email}</dd>
            </div>
            <div className="flex justify-between border-b border-line/60 pb-2">
              <dt className="text-muted">Role</dt>
              <dd className="capitalize text-silver">{user.role}</dd>
            </div>
          </dl>

          <h3 className="mt-5 text-sm font-semibold text-white">Change password</h3>
          <form action={changePasswordAction} className="mt-3 space-y-3">
            <div>
              <label className="label" htmlFor="current">
                Current password
              </label>
              <input id="current" name="current" type="password" required className="input" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="password">
                  New password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={10}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="confirm_password">
                  Confirm
                </label>
                <input id="confirm_password" name="confirm_password" type="password" required className="input" />
              </div>
            </div>
            <button className="btn-ghost" type="submit">
              Update password
            </button>
          </form>
        </div>

        <div className="card overflow-hidden">
          <CardHeader title="Team" hint={`${users.length} account${users.length === 1 ? "" : "s"}`} />
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <th className="th">Member</th>
                <th className="th">Role</th>
                <th className="th">Joined</th>
                {isOwner ? <th className="th text-right">Access</th> : null}
              </tr>
            </thead>
            <tbody>
              {users.map((member) => (
                <tr key={member.id} className="border-b border-line/60 last:border-0">
                  <td className="td">
                    <p className="text-white">
                      {member.name}
                      {member.id === user.id ? <span className="ml-2 text-[11px] text-muted">you</span> : null}
                    </p>
                    <p className="text-[11px] text-muted">{member.email}</p>
                    {!member.active ? <p className="text-[11px] text-warn">Deactivated</p> : null}
                  </td>
                  <td className="td capitalize text-muted">{member.role}</td>
                  <td className="td whitespace-nowrap text-muted">{day(member.created_at)}</td>
                  {isOwner ? (
                    <td className="td text-right">
                      {member.id === user.id ? (
                        <span className="text-[11px] text-muted">—</span>
                      ) : (
                        <form action={toggleUserAction}>
                          <input type="hidden" name="id" value={member.id} />
                          <input type="hidden" name="active" value={member.active ? "1" : "0"} />
                          <button className="btn-ghost btn-sm" type="submit">
                            {member.active ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>

          {isOwner ? (
            <form action={createUserAction} className="space-y-3 border-t border-line p-4">
              <h3 className="text-sm font-semibold text-white">Invite a team member</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="name" required className="input" placeholder="Full name" />
                <input name="email" type="email" required className="input" placeholder="Email" />
                <input
                  name="password"
                  type="password"
                  required
                  minLength={10}
                  className="input"
                  placeholder="Temporary password (12+ chars)"
                />
                <select name="role" defaultValue="manager" className="input">
                  <option value="manager">Manager — full stock access</option>
                  <option value="viewer">Viewer — read only</option>
                  <option value="owner">Owner — full access</option>
                </select>
              </div>
              <button className="btn-primary" type="submit">
                Create account
              </button>
              <p className="text-[11px] text-muted">
                Share the password securely. The member can change it after signing in.
              </p>
            </form>
          ) : null}
        </div>
      </div>

      <div className="card mt-5 p-5">
        <h2 className="text-sm font-semibold text-white">Workspace</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">Name</dt>
            <dd className="text-silver">{workspace.name}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">Currency</dt>
            <dd className="text-silver">{currencyLabel(workspace.currency)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">Database</dt>
            <dd className="text-silver">Postgres (server-side)</dd>
          </div>
        </dl>

        {isOwner ? (
          <form
            action={updateWorkspaceAction}
            className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-[1fr_230px_auto] sm:items-end"
          >
            <div>
              <label className="label" htmlFor="workspace-name">
                Workspace name
              </label>
              <input
                id="workspace-name"
                name="name"
                required
                minLength={2}
                maxLength={60}
                defaultValue={workspace.name}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="workspace-currency">
                Currency
              </label>
              <select
                id="workspace-currency"
                name="currency"
                defaultValue={workspace.currency}
                className="input"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-ghost" type="submit">
              Save workspace
            </button>
          </form>
        ) : null}

        {isOwner ? (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            {products.length === 0 ? (
              <form action={loadDemoDataAction}>
                <button className="btn-ghost" type="submit">
                  Load sample catalogue
                </button>
              </form>
            ) : null}
            <form action={deleteEverythingAction} className="flex flex-wrap items-center gap-2">
              <input
                name="confirm"
                className="input w-40"
                placeholder="Type DELETE"
                aria-label="Type DELETE to confirm"
              />
              <button className="btn-danger" type="submit">
                Delete all stock data
              </button>
            </form>
          </div>
        ) : null}
        <p className="mt-3 text-[11px] text-muted">
          Deleting data removes products, suppliers and the full movement ledger. User accounts are
          kept. This cannot be undone.
        </p>
      </div>
    </div>
  );
}
