"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Account = { id: string; username: string; displayName: string; email?: string | null; status: string; mustChangePassword: boolean; mfaEnrolledAt: string | null; permissions: string[] };
type PermissionDefinition = { key: string; description: string; sensitive: boolean };
type AccountModal = "create" | "permissions" | "credential" | null;

const demoPermissions: PermissionDefinition[] = [
  { key: "account.manage", description: "Invite, disable and unlock user accounts", sensitive: true },
  { key: "permission.manage", description: "Grant and revoke individual permissions", sensitive: true },
  { key: "staff.read", description: "View the staff register", sensitive: true },
  { key: "staff.manage", description: "Create and update staff records", sensitive: true },
  { key: "shift.manage", description: "Create and assign shifts", sensitive: false },
  { key: "attendance.record", description: "Record attendance", sensitive: false },
  { key: "deployment.manage", description: "Manage deployments", sensitive: false },
  { key: "equipment.manage", description: "Issue and return equipment", sensitive: false },
];

const demoAccounts: Account[] = [
  { id: "demo-joe", username: "joe m", displayName: "Joe M", status: "active", mustChangePassword: false, mfaEnrolledAt: "2026-11-07T10:00:00.000Z", permissions: demoPermissions.map((permission) => permission.key) },
  { id: "demo-madeline", username: "madeline", displayName: "Madeline", status: "invited", mustChangePassword: true, mfaEnrolledAt: null, permissions: ["staff.read", "shift.manage"] },
];

function csrfToken() {
  const part = document.cookie.split("; ").find((cookie) => cookie.startsWith("ssn_csrf="));
  return part ? decodeURIComponent(part.slice("ssn_csrf=".length)) : "";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function accountReadiness(account: Account) {
  if (account.mustChangePassword) return { label: "Awaiting first sign-in", tone: "pending" };
  if (!account.mfaEnrolledAt) return { label: "MFA setup required", tone: "attention" };
  return { label: "Password and MFA ready", tone: "ready" };
}

async function responseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) throw new Error("The server returned an empty response");
  try { return JSON.parse(text) as T; }
  catch { throw new Error("The server returned an unreadable response"); }
}

export default function AccountManager({ demoMode, notify }: { demoMode: boolean; notify: (message: string) => void }) {
  const [accounts, setAccounts] = useState<Account[]>(demoMode ? demoAccounts : []);
  const [catalog, setCatalog] = useState<PermissionDefinition[]>(demoMode ? demoPermissions : []);
  const [canManagePermissions, setCanManagePermissions] = useState(demoMode);
  const [modal, setModal] = useState<AccountModal>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [credential, setCredential] = useState<{ username: string; temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const modalHeadingRef = useRef<HTMLHeadingElement>(null);

  const loadAccounts = useCallback(async () => {
    if (demoMode) return;
    const response = await fetch("/api/accounts");
    const result = await responseJson<{ error?: string; accounts?: Account[]; permissionCatalog?: PermissionDefinition[]; canManagePermissions?: boolean }>(response);
    if (!response.ok) throw new Error(result.error ?? "Accounts could not be loaded");
    setAccounts(result.accounts ?? []);
    setCatalog(result.permissionCatalog ?? []);
    setCanManagePermissions(Boolean(result.canManagePermissions));
  }, [demoMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAccounts().catch((cause) => setError(cause instanceof Error ? cause.message : "Accounts could not be loaded")), 0);
    return () => window.clearTimeout(timer);
  }, [loadAccounts]);

  useEffect(() => {
    if (!modal) return;
    modalHeadingRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setModal(null); setSelectedAccount(null); setCredential(null); setPermissionSearch(""); setError("");
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [modal]);

  const visiblePermissions = useMemo(() => {
    const search = permissionSearch.trim().toLocaleLowerCase("en-GB");
    return search ? catalog.filter((permission) => `${permission.key} ${permission.description}`.toLocaleLowerCase("en-GB").includes(search)) : catalog;
  }, [catalog, permissionSearch]);

  function closeModal() {
    setModal(null);
    setSelectedAccount(null);
    setPermissionSearch("");
    setCopied(false);
    setError("");
    if (modal === "credential") setCredential(null);
  }

  function openPermissions(account: Account) {
    if (!canManagePermissions) { notify("You do not have permission to change account permissions"); return; }
    setSelectedAccount(account);
    setSelectedPermissions(account.permissions);
    setPermissionSearch("");
    setError("");
    setModal("permissions");
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const username = String(form.get("username") ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    const displayName = String(form.get("displayName") ?? "").trim();
    setError(""); setCredential(null); setBusy(true);
    try {
      if (demoMode) {
        if (accounts.some((account) => account.username === username)) throw new Error("That username is already in use");
        const account: Account = { id: crypto.randomUUID(), username, displayName, email: String(form.get("email") ?? "") || null, status: "invited", mustChangePassword: true, mfaEnrolledAt: null, permissions: [] };
        setAccounts((current) => [...current, account]);
        setCredential({ username, temporaryPassword: `Demo-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}-A7!` });
        notify("Demonstration account prepared · nothing was saved");
      } else {
        const response = await fetch("/api/accounts", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ username, displayName, email: form.get("email"), permissions: [] }) });
        const result = await responseJson<{ error?: string; account?: Account; temporaryPassword?: string }>(response);
        if (!response.ok || !result.account || !result.temporaryPassword) throw new Error(result.error ?? "Account could not be created");
        setCredential({ username: result.account.username, temporaryPassword: result.temporaryPassword });
        await loadAccounts();
        notify("Account created");
      }
      formElement.reset();
      setModal("credential");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Account could not be created"); }
    finally { setBusy(false); }
  }

  async function savePermissions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccount) return;
    const permissionKeys = new FormData(event.currentTarget).getAll("permissions").map(String);
    setError(""); setBusy(true);
    try {
      if (demoMode) {
        setAccounts((current) => current.map((account) => account.id === selectedAccount.id ? { ...account, permissions: permissionKeys } : account));
        notify("Demonstration permissions updated · nothing was saved");
      } else {
        const response = await fetch("/api/accounts", { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ accountId: selectedAccount.id, permissions: permissionKeys }) });
        const result = await responseJson<{ error?: string }>(response);
        if (!response.ok) throw new Error(result.error ?? "Permissions could not be updated");
        await loadAccounts();
        notify("Account permissions updated");
      }
      setModal(null); setSelectedAccount(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Permissions could not be updated"); }
    finally { setBusy(false); }
  }

  async function copyCredential() {
    if (!credential) return;
    try {
      await navigator.clipboard.writeText(`Username: ${credential.username}\nTemporary password: ${credential.temporaryPassword}`);
      setCopied(true);
    } catch { setError("Copy was unavailable. Select the details manually."); }
  }

  return <section className="management-shell account-manager">
    <div className="management-heading account-heading"><div><p className="eyebrow coral">SECURE ACCESS</p><h2>Accounts</h2><p>Create sign-ins and control each person’s individual access to Safer Spaces.</p></div><button className="primary compact" type="button" onClick={() => { setError(""); setModal("create"); }}>Create account</button></div>
    <div className="account-overview"><div><strong>{accounts.length}</strong><span>Total accounts</span></div><div><strong>{accounts.filter((account) => account.mfaEnrolledAt).length}</strong><span>MFA enrolled</span></div><div><strong>{accounts.filter((account) => account.mustChangePassword).length}</strong><span>Awaiting first sign-in</span></div></div>
    {error && !modal && <p className="form-error" role="alert">{error}</p>}
    <div className="account-list-heading"><div><h3>User accounts</h3><p>Select an account to review and change its permissions.</p></div>{!canManagePermissions && <span>View only</span>}</div>
    <div className="account-list">{accounts.map((account) => { const readiness = accountReadiness(account); return <button type="button" className="account-row-card" key={account.id} onClick={() => openPermissions(account)} aria-label={`Manage permissions for ${account.displayName}`}><span className="account-avatar">{initials(account.displayName)}</span><span className="account-main"><strong>{account.displayName}</strong><small>@{account.username}{account.email ? ` · ${account.email}` : ""}</small></span><span className={`account-readiness ${readiness.tone}`}><i />{readiness.label}</span><span className="account-permission-count"><b>{account.permissions.length}</b><small>permissions</small></span><span className="account-chevron" aria-hidden="true">›</span></button>; })}{accounts.length === 0 && <div className="account-empty"><strong>No accounts yet</strong><p>Create the first additional account when you are ready.</p></div>}</div>

    {modal === "create" && <div className="form-modal-backdrop account-backdrop"><section className="form-modal account-modal create-account-modal" role="dialog" aria-modal="true" aria-labelledby="create-account-title"><button className="close" type="button" aria-label="Close" onClick={closeModal}>×</button><header className="account-modal-header"><p className="eyebrow">SECURE ACCESS</p><h2 id="create-account-title" ref={modalHeadingRef} tabIndex={-1}>Create a new account</h2><p>We’ll generate a temporary password. The user must replace it and set up MFA on their first sign-in.</p></header><form className="admin-form account-modal-form" onSubmit={createAccount}><label>Username<input name="username" minLength={3} maxLength={50} pattern="[A-Za-z][A-Za-z0-9._ -]+" placeholder="e.g. Joe M" autoComplete="off" required /><small>Used to sign in. Spaces are allowed.</small></label><label>Display name<input name="displayName" maxLength={160} placeholder="Name shown in the app" autoComplete="off" required /></label><label>Email address <span className="optional">Optional</span><input name="email" type="email" placeholder="name@example.com" autoComplete="off" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="account-modal-actions"><button className="secondary" type="button" onClick={closeModal}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Creating…" : "Create secure account"}</button></div></form></section></div>}

    {modal === "credential" && credential && <div className="form-modal-backdrop account-backdrop"><section className="form-modal account-modal credential-modal" role="dialog" aria-modal="true" aria-labelledby="credential-title"><button className="close" type="button" aria-label="Close" onClick={closeModal}>×</button><header className="account-modal-header success"><span className="credential-success" aria-hidden="true">✓</span><p className="eyebrow">ACCOUNT CREATED</p><h2 id="credential-title" ref={modalHeadingRef} tabIndex={-1}>Temporary sign-in details</h2><p>These details are shown only once. Send them to the user securely.</p></header><div className="credential-body"><div className="credential-field"><span>Username</span><code>{credential.username}</code></div><div className="credential-field"><span>Temporary password</span><code>{credential.temporaryPassword}</code></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="credential-warning"><strong>What happens next?</strong><p>On first sign-in, the user must choose a new password and scan a QR code to set up MFA before they can access the system.</p></div><div className="account-modal-actions"><button className="secondary" type="button" onClick={() => void copyCredential()}>{copied ? "Copied ✓" : "Copy details"}</button><button className="primary" type="button" onClick={closeModal}>I’ve saved these details</button></div></div></section></div>}

    {modal === "permissions" && selectedAccount && <div className="form-modal-backdrop account-backdrop"><section className="form-modal account-modal permissions-modal" role="dialog" aria-modal="true" aria-labelledby="permissions-title"><button className="close" type="button" aria-label="Close" onClick={closeModal}>×</button><header className="account-modal-header"><div className="permission-account-identity"><span className="account-avatar">{initials(selectedAccount.displayName)}</span><div><p className="eyebrow">ACCOUNT PERMISSIONS</p><h2 id="permissions-title" ref={modalHeadingRef} tabIndex={-1}>{selectedAccount.displayName}</h2><span>@{selectedAccount.username}</span></div></div></header><form className="admin-form permission-modal-form" onSubmit={savePermissions}><div className="permission-picker-heading"><div><h3>Choose access</h3><p>Changes take effect when the user next refreshes or signs in.</p></div><strong aria-live="polite">{selectedPermissions.length} selected</strong></div><label className="permission-search" htmlFor="permission-search"><span>Search permissions</span><input id="permission-search" type="search" value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="Search by name or description" /></label><div className="permission-choice-list">{visiblePermissions.map((permission) => { const checked = selectedPermissions.includes(permission.key); return <label className={`permission-choice${checked ? " selected" : ""}`} key={permission.key}><input type="checkbox" name="permissions" value={permission.key} checked={checked} onChange={() => setSelectedPermissions((current) => checked ? current.filter((key) => key !== permission.key) : [...current, permission.key])} /><span className="permission-choice-check" aria-hidden="true">✓</span><span><strong>{permission.key}</strong><small>{permission.description}</small></span>{permission.sensitive && <em>Sensitive</em>}</label>; })}{visiblePermissions.length === 0 && <p className="permission-empty">No permissions match that search.</p>}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="account-modal-actions"><button className="secondary" type="button" onClick={closeModal}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Saving…" : `Save ${selectedPermissions.length} permissions`}</button></div></form></section></div>}
  </section>;
}
