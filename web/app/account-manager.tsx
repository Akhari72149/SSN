"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Account = { id: string; username: string; displayName: string; status: string; mustChangePassword: boolean; mfaEnrolledAt: string | null; permissions: string[] };
type PermissionDefinition = { key: string; description: string; sensitive: boolean };

const demoPermissions: PermissionDefinition[] = [
  { key: "staff.read", description: "View the staff register", sensitive: true },
  { key: "staff.manage", description: "Create and update staff records", sensitive: true },
  { key: "shift.manage", description: "Create and assign shifts", sensitive: false },
  { key: "attendance.record", description: "Record attendance", sensitive: false },
  { key: "deployment.manage", description: "Manage deployments", sensitive: false },
  { key: "equipment.manage", description: "Issue and return equipment", sensitive: false },
];

function csrfToken() {
  const part = document.cookie.split("; ").find((cookie) => cookie.startsWith("ssn_csrf="));
  return part ? decodeURIComponent(part.slice("ssn_csrf=".length)) : "";
}

export default function AccountManager({ demoMode, notify }: { demoMode: boolean; notify: (message: string) => void }) {
  const [accounts, setAccounts] = useState<Account[]>(demoMode ? [{ id: "demo-joe", username: "joe m", displayName: "Joe M", status: "invited", mustChangePassword: true, mfaEnrolledAt: null, permissions: [] }] : []);
  const [catalog, setCatalog] = useState<PermissionDefinition[]>(demoMode ? demoPermissions : []);
  const [credential, setCredential] = useState<{ username: string; temporaryPassword: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadAccounts = useCallback(async () => {
    if (demoMode) return;
    const response = await fetch("/api/accounts");
    const result = await response.json() as { error?: string; accounts?: Account[]; permissionCatalog?: PermissionDefinition[] };
    if (!response.ok) throw new Error(result.error ?? "Accounts could not be loaded");
    setAccounts(result.accounts ?? []); setCatalog(result.permissionCatalog ?? []);
  }, [demoMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAccounts().catch((cause) => setError(cause.message)), 0);
    return () => window.clearTimeout(timer);
  }, [loadAccounts]);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setCredential(null); setBusy(true);
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    const displayName = String(form.get("displayName") ?? "").trim();
    try {
      if (demoMode) {
        const temporaryPassword = `Demo-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}-A7!`;
        setAccounts((current) => current.some((account) => account.username === username) ? current : [...current, { id: crypto.randomUUID(), username, displayName, status: "invited", mustChangePassword: true, mfaEnrolledAt: null, permissions: form.getAll("permissions").map(String) }]);
        setCredential({ username, temporaryPassword });
        notify("Demonstration account prepared · nothing was saved");
      } else {
        const response = await fetch("/api/accounts", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ username, displayName, email: form.get("email"), permissions: form.getAll("permissions") }) });
        const result = await response.json() as { error?: string; account?: Account; temporaryPassword?: string };
        if (!response.ok || !result.account || !result.temporaryPassword) throw new Error(result.error ?? "Account could not be created");
        setCredential({ username: result.account.username, temporaryPassword: result.temporaryPassword });
        await loadAccounts(); notify("Account created");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Account could not be created"); }
    finally { setBusy(false); }
  }

  return <section className="management-shell account-manager">
    <div className="management-heading"><div><p className="eyebrow coral">ACCOUNT ADMINISTRATION</p><h2>User accounts</h2><p>New accounts receive a one-time temporary password and must replace it before setting up MFA.</p></div><span>{accounts.length} accounts</span></div>
    <form className="admin-form form-grid" onSubmit={createAccount}>
      <label>Username<input name="username" defaultValue="Joe M" minLength={3} maxLength={50} pattern="[A-Za-z][A-Za-z0-9._ -]+" required /></label>
      <label>Display name<input name="displayName" defaultValue="Joe M" maxLength={160} required /></label>
      <label>Email address (optional)<input name="email" type="email" /></label>
      <fieldset className="permission-picker"><legend>Individual permissions</legend>{catalog.map((permission) => <label key={permission.key}><input name="permissions" type="checkbox" value={permission.key} aria-label={permission.description} /><span><strong>{permission.key}</strong><small>{permission.description}{permission.sensitive ? " · Sensitive" : ""}</small></span></label>)}</fieldset>
      <button className="primary compact" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
    </form>
    {credential && <div className="temporary-credential" role="status"><strong>Temporary sign-in details — shown once</strong><p>Username: <code>{credential.username}</code></p><p>Password: <code>{credential.temporaryPassword}</code></p><small>Send these securely. The password must be changed on first sign-in.</small></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="record-list"><h3>Accounts</h3>{accounts.map((account) => <div className="record-row" key={account.id}><div><strong>{account.displayName} · {account.username}</strong><small>{account.mustChangePassword ? "Temporary password awaiting change" : account.mfaEnrolledAt ? "Active with MFA" : "MFA setup required"} · {account.permissions.length} permissions</small></div><span className="count">{account.status}</span></div>)}</div>
  </section>;
}
