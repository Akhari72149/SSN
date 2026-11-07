"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Recovery = { id: string; reason: string; requestedAt: string; expiresAt: string; requestedBy: string; approvalCount: number; viewerApproved: boolean };
type Account = { id: string; username: string; displayName: string; email?: string | null; status: string; mustChangePassword: boolean; mfaEnrolledAt: string | null; failedSignInCount?: number; lockedUntil?: string | null; lastSignInAt?: string | null; isCurrentUser?: boolean; archivedAt?: string | null; archivedBy?: string | null; archiveReason?: string | null; recovery?: Recovery | null; permissions: string[] };
type PermissionDefinition = { key: string; description: string; sensitive: boolean };
type AccountModal = "create" | "permissions" | "credential" | "archive" | null;

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
  if (account.archivedAt) return { label: "Archived", tone: "archived" };
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
  const [canResetAccounts, setCanResetAccounts] = useState(demoMode);
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState<AccountModal>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [accountTab, setAccountTab] = useState<"overview" | "permissions">("overview");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [credential, setCredential] = useState<{ username: string; temporaryPassword: string; kind: "created" | "recovered" } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const modalHeadingRef = useRef<HTMLHeadingElement>(null);

  const loadAccounts = useCallback(async () => {
    if (demoMode) return;
    const response = await fetch("/api/accounts");
    const result = await responseJson<{ error?: string; accounts?: Account[]; permissionCatalog?: PermissionDefinition[]; canManagePermissions?: boolean; canResetAccounts?: boolean }>(response);
    if (!response.ok) throw new Error(result.error ?? "Accounts could not be loaded");
    setAccounts(result.accounts ?? []);
    setCatalog(result.permissionCatalog ?? []);
    setCanManagePermissions(Boolean(result.canManagePermissions));
    setCanResetAccounts(Boolean(result.canResetAccounts));
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
  const visibleAccounts = useMemo(() => accounts.filter((account) => showArchived ? Boolean(account.archivedAt) : !account.archivedAt), [accounts, showArchived]);

  function closeModal() {
    setModal(null);
    setSelectedAccount(null);
    setPermissionSearch("");
    setCopied(false);
    setError("");
    if (modal === "credential") setCredential(null);
  }

  function openPermissions(account: Account) {
    setSelectedAccount(account);
    setSelectedPermissions(account.permissions);
    setAccountTab("overview");
    setPermissionSearch("");
    setError("");
    setModal("permissions");
  }

  function openArchive(account: Account) {
    setSelectedAccount(account);
    setError("");
    setModal("archive");
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
        setCredential({ username, temporaryPassword: `Demo-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}-A7!`, kind: "created" });
        notify("Demonstration account prepared · nothing was saved");
      } else {
        const response = await fetch("/api/accounts", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ username, displayName, email: form.get("email"), permissions: [] }) });
        const result = await responseJson<{ error?: string; account?: Account; temporaryPassword?: string }>(response);
        if (!response.ok || !result.account || !result.temporaryPassword) throw new Error(result.error ?? "Account could not be created");
        setCredential({ username: result.account.username, temporaryPassword: result.temporaryPassword, kind: "created" });
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

  async function performAccountAction(action: "disable" | "enable" | "unlock" | "archive" | "restore", reason?: string) {
    if (!selectedAccount) return;
    setError(""); setBusy(true);
    try {
      if (demoMode) {
        setAccounts((current) => current.map((account) => account.id === selectedAccount.id ? {
          ...account,
          status: action === "disable" || action === "archive" ? "disabled" : action === "enable" || action === "restore" ? (account.mustChangePassword || !account.mfaEnrolledAt ? "invited" : "active") : account.status,
          failedSignInCount: action === "unlock" || action === "enable" || action === "restore" ? 0 : account.failedSignInCount,
          lockedUntil: action === "unlock" || action === "enable" || action === "restore" ? null : account.lockedUntil,
          archivedAt: action === "archive" ? new Date().toISOString() : action === "restore" ? null : account.archivedAt,
          archivedBy: action === "archive" ? "You" : action === "restore" ? null : account.archivedBy,
          archiveReason: action === "archive" ? reason ?? "Demonstration archive" : action === "restore" ? null : account.archiveReason,
        } : account));
        notify(`Demonstration account ${action} completed · nothing was saved`);
      } else {
        const response = await fetch(`/api/accounts/${selectedAccount.id}`, { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ action, reason }) });
        const result = await responseJson<{ error?: string }>(response);
        if (!response.ok) throw new Error(result.error ?? "The account could not be updated");
        await loadAccounts();
        notify(action === "disable" ? "Account disabled" : action === "enable" ? "Account enabled" : action === "unlock" ? "Account unlocked" : action === "archive" ? "Account archived" : "Account restored");
      }
      setModal(null); setSelectedAccount(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The account could not be updated"); }
    finally { setBusy(false); }
  }

  async function archiveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("archiveReason") ?? "").trim();
    await performAccountAction("archive", reason);
  }

  async function startRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccount) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    setError(""); setBusy(true);
    try {
      if (demoMode) {
        const recovery: Recovery = { id: crypto.randomUUID(), reason, requestedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(), requestedBy: "You", approvalCount: 1, viewerApproved: true };
        setAccounts((current) => current.map((account) => account.id === selectedAccount.id ? { ...account, recovery } : account));
        notify("Demonstration recovery started · one more approval required");
      } else {
        const response = await fetch(`/api/accounts/${selectedAccount.id}`, { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ action: "request_recovery", reason }) });
        const result = await responseJson<{ error?: string }>(response);
        if (!response.ok) throw new Error(result.error ?? "Account recovery could not be started");
        await loadAccounts();
        notify("Recovery started · one more approval required");
      }
      setModal(null); setSelectedAccount(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Account recovery could not be started"); }
    finally { setBusy(false); }
  }

  async function approveRecovery() {
    if (!selectedAccount?.recovery) return;
    setError(""); setBusy(true);
    try {
      if (demoMode) {
        setCredential({ username: selectedAccount.username, temporaryPassword: `Demo-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}-R8!`, kind: "recovered" });
        notify("Demonstration recovery approved · nothing was saved");
      } else {
        const response = await fetch(`/api/accounts/${selectedAccount.id}`, { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken() }, body: JSON.stringify({ action: "approve_recovery", recoveryRequestId: selectedAccount.recovery.id }) });
        const result = await responseJson<{ error?: string; executed?: boolean; temporaryPassword?: string }>(response);
        if (!response.ok) throw new Error(result.error ?? "Recovery approval could not be recorded");
        if (!result.executed || !result.temporaryPassword) throw new Error("The recovery is still awaiting another approval");
        setCredential({ username: selectedAccount.username, temporaryPassword: result.temporaryPassword, kind: "recovered" });
        await loadAccounts();
        notify("Recovery completed · temporary password issued");
      }
      setModal("credential"); setSelectedAccount(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Recovery approval could not be recorded"); }
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
    <div className="account-overview"><div><strong>{accounts.filter((account) => !account.archivedAt).length}</strong><span>Current accounts</span></div><div><strong>{accounts.filter((account) => account.mfaEnrolledAt && !account.archivedAt).length}</strong><span>MFA enrolled</span></div><div><strong>{accounts.filter((account) => account.archivedAt).length}</strong><span>Archived</span></div></div>
    {error && !modal && <p className="form-error" role="alert">{error}</p>}
    <div className="account-list-heading"><div><h3>{showArchived ? "Archived accounts" : "User accounts"}</h3><p>{showArchived ? "Archived accounts cannot sign in but retain their full history." : "Select an account to review its security, recovery and permissions."}</p></div><div className="account-list-filters"><button type="button" className={!showArchived ? "active" : ""} onClick={() => setShowArchived(false)}>Current</button><button type="button" className={showArchived ? "active" : ""} onClick={() => setShowArchived(true)}>Archived <span>{accounts.filter((account) => account.archivedAt).length}</span></button></div></div>
    <div className="account-list">{visibleAccounts.map((account) => { const readiness = accountReadiness(account); return <div className="account-row-shell" key={account.id}><button type="button" className={`account-row-card${account.status === "disabled" || account.archivedAt ? " disabled" : ""}`} onClick={() => account.archivedAt ? openArchive(account) : openPermissions(account)} aria-label={`Manage account for ${account.displayName}`}><span className="account-avatar">{initials(account.displayName)}</span><span className="account-main"><strong>{account.displayName}{account.isCurrentUser ? " · You" : ""}</strong><small>@{account.username}{account.email ? ` · ${account.email}` : ""}</small></span><span className={`account-readiness ${readiness.tone}`}><i />{account.archivedAt ? "Archived" : account.status === "disabled" ? "Account disabled" : account.recovery ? `Recovery ${account.recovery.approvalCount}/2 approved` : readiness.label}</span><span className="account-permission-count"><b>{account.permissions.length}</b><small>permissions</small></span><span className="account-chevron" aria-hidden="true">›</span></button><button type="button" className={account.archivedAt ? "restore-row-action" : "archive-row-action"} disabled={account.isCurrentUser} title={account.isCurrentUser ? "You cannot archive your own account" : undefined} onClick={() => openArchive(account)}>{account.archivedAt ? "Restore" : "Archive"}</button></div>; })}{visibleAccounts.length === 0 && <div className="account-empty"><strong>{showArchived ? "No archived accounts" : "No current accounts"}</strong><p>{showArchived ? "Archived accounts will appear here." : "Create the first additional account when you are ready."}</p></div>}</div>

    {modal === "create" && <div className="form-modal-backdrop account-backdrop"><section className="form-modal account-modal create-account-modal" role="dialog" aria-modal="true" aria-labelledby="create-account-title"><button className="close" type="button" aria-label="Close" onClick={closeModal}>×</button><header className="account-modal-header"><p className="eyebrow">SECURE ACCESS</p><h2 id="create-account-title" ref={modalHeadingRef} tabIndex={-1}>Create a new account</h2><p>We’ll generate a temporary password. The user must replace it and set up MFA on their first sign-in.</p></header><form className="admin-form account-modal-form" onSubmit={createAccount}><label>Username<input name="username" minLength={3} maxLength={50} pattern="[A-Za-z][A-Za-z0-9._ -]+" placeholder="e.g. Joe M" autoComplete="off" required /><small>Used to sign in. Spaces are allowed.</small></label><label>Display name<input name="displayName" maxLength={160} placeholder="Name shown in the app" autoComplete="off" required /></label><label>Email address <span className="optional">Optional</span><input name="email" type="email" placeholder="name@example.com" autoComplete="off" /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="account-modal-actions"><button className="secondary" type="button" onClick={closeModal}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Creating…" : "Create secure account"}</button></div></form></section></div>}

    {modal === "credential" && credential && <div className="form-modal-backdrop account-backdrop"><section className="form-modal account-modal credential-modal" role="dialog" aria-modal="true" aria-labelledby="credential-title"><button className="close" type="button" aria-label="Close" onClick={closeModal}>×</button><header className="account-modal-header success"><span className="credential-success" aria-hidden="true">✓</span><p className="eyebrow">{credential.kind === "recovered" ? "RECOVERY COMPLETED" : "ACCOUNT CREATED"}</p><h2 id="credential-title" ref={modalHeadingRef} tabIndex={-1}>Temporary sign-in details</h2><p>These details are shown only once. Send them to the user securely.</p></header><div className="credential-body"><div className="credential-field"><span>Username</span><code>{credential.username}</code></div><div className="credential-field"><span>Temporary password</span><code>{credential.temporaryPassword}</code></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="credential-warning"><strong>What happens next?</strong><p>{credential.kind === "recovered" ? "All previous sessions and MFA credentials have been revoked. " : ""}On first sign-in, the user must choose a new password and scan a QR code to set up MFA before they can access the system.</p></div><div className="account-modal-actions"><button className="secondary" type="button" onClick={() => void copyCredential()}>{copied ? "Copied ✓" : "Copy details"}</button><button className="primary" type="button" onClick={closeModal}>I’ve saved these details</button></div></div></section></div>}

    {modal === "archive" && selectedAccount && <div className="form-modal-backdrop account-backdrop"><section className="form-modal account-modal archive-account-modal" role="dialog" aria-modal="true" aria-labelledby="archive-title"><button className="close" type="button" aria-label="Close" onClick={closeModal}>×</button><header className={`account-modal-header${selectedAccount.archivedAt ? " archived" : " danger"}`}><p className="eyebrow">{selectedAccount.archivedAt ? "ARCHIVED ACCOUNT" : "ARCHIVE ACCOUNT"}</p><h2 id="archive-title" ref={modalHeadingRef} tabIndex={-1}>{selectedAccount.archivedAt ? `Restore ${selectedAccount.displayName}?` : `Archive ${selectedAccount.displayName}?`}</h2><p>{selectedAccount.archivedAt ? "Restoring returns the account to normal use with its existing permissions." : "Archiving immediately blocks sign-in but preserves permissions, audit history and linked operational records."}</p></header>{selectedAccount.archivedAt ? <div className="archive-modal-body"><dl className="archive-details"><div><dt>Archived</dt><dd>{new Date(selectedAccount.archivedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</dd></div><div><dt>Archived by</dt><dd>{selectedAccount.archivedBy ?? "Authorised user"}</dd></div><div><dt>Reason</dt><dd>{selectedAccount.archiveReason}</dd></div></dl>{error && <p className="form-error" role="alert">{error}</p>}<div className="account-modal-actions"><button className="secondary" type="button" onClick={closeModal}>Cancel</button><button className="primary" type="button" disabled={busy} onClick={() => void performAccountAction("restore")}>{busy ? "Restoring…" : "Restore account"}</button></div></div> : <form className="archive-modal-body archive-confirm-form" onSubmit={archiveAccount}><label>Reason for archiving<textarea name="archiveReason" minLength={10} maxLength={500} placeholder="Explain why this account is being archived" required /></label><label className="archive-confirm-check"><input type="checkbox" required /><span>I understand this account will be signed out and unable to sign in.</span></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="account-modal-actions"><button className="secondary" type="button" onClick={closeModal}>Keep account</button><button className="danger-primary" disabled={busy || selectedAccount.isCurrentUser}>{busy ? "Archiving…" : "Archive account"}</button></div></form>}</section></div>}

    {modal === "permissions" && selectedAccount && <div className="form-modal-backdrop account-backdrop"><section className="form-modal account-modal permissions-modal" role="dialog" aria-modal="true" aria-labelledby="permissions-title"><button className="close" type="button" aria-label="Close" onClick={closeModal}>×</button><header className="account-modal-header"><div className="permission-account-identity"><span className="account-avatar">{initials(selectedAccount.displayName)}</span><div><p className="eyebrow">MANAGE ACCOUNT</p><h2 id="permissions-title" ref={modalHeadingRef} tabIndex={-1}>{selectedAccount.displayName}</h2><span>@{selectedAccount.username}{selectedAccount.isCurrentUser ? " · Your account" : ""}</span></div></div></header><nav className="account-detail-tabs" aria-label="Account management sections"><button type="button" className={accountTab === "overview" ? "active" : ""} onClick={() => { setAccountTab("overview"); setError(""); }}>Account & recovery</button><button type="button" className={accountTab === "permissions" ? "active" : ""} onClick={() => { setAccountTab("permissions"); setError(""); }} disabled={!canManagePermissions}>Permissions <span>{selectedAccount.permissions.length}</span></button></nav>{accountTab === "overview" ? <div className="account-detail-body"><div className="account-security-grid"><div><span>Status</span><strong className="capitalize">{selectedAccount.status}</strong></div><div><span>Last sign-in</span><strong>{selectedAccount.lastSignInAt ? new Date(selectedAccount.lastSignInAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"}</strong></div><div><span>MFA</span><strong>{selectedAccount.mfaEnrolledAt ? "Enrolled" : "Not enrolled"}</strong></div><div><span>Failed sign-ins</span><strong>{selectedAccount.failedSignInCount ?? 0}</strong></div></div><section className="account-actions-card"><div><h3>Account access</h3><p>Disable access, restore an account or clear a temporary lockout.</p></div><div className="account-action-buttons">{selectedAccount.status === "disabled" ? <button className="secondary" type="button" disabled={busy} onClick={() => void performAccountAction("enable")}>Enable account</button> : <button className="danger-secondary" type="button" disabled={busy || selectedAccount.isCurrentUser} title={selectedAccount.isCurrentUser ? "You cannot disable your own account" : undefined} onClick={() => void performAccountAction("disable")}>Disable account</button>}{Boolean(selectedAccount.lockedUntil || selectedAccount.failedSignInCount) && <button className="secondary" type="button" disabled={busy} onClick={() => void performAccountAction("unlock")}>Unlock account</button>}</div></section><section className="recovery-card"><div className="recovery-card-heading"><div><p className="eyebrow coral">TWO-PERSON RECOVERY</p><h3>Password and MFA recovery</h3></div>{selectedAccount.recovery && <strong>{selectedAccount.recovery.approvalCount}/2 approved</strong>}</div>{selectedAccount.isCurrentUser ? <p className="recovery-note">For security, you cannot start or approve recovery for your own account.</p> : !canResetAccounts ? <p className="recovery-note">You do not have permission to start or approve account recovery.</p> : selectedAccount.recovery ? <div className="pending-recovery"><dl><div><dt>Requested by</dt><dd>{selectedAccount.recovery.requestedBy}</dd></div><div><dt>Reason</dt><dd>{selectedAccount.recovery.reason}</dd></div><div><dt>Expires</dt><dd>{new Date(selectedAccount.recovery.expiresAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</dd></div></dl><button className="primary" type="button" disabled={busy || selectedAccount.recovery.viewerApproved} onClick={() => void approveRecovery()}>{selectedAccount.recovery.viewerApproved ? "Your approval is recorded" : busy ? "Approving…" : "Give second approval"}</button></div> : <form className="recovery-request-form" onSubmit={startRecovery}><label>Reason for recovery<textarea name="reason" minLength={10} maxLength={500} placeholder="Explain why this account needs to be recovered" required /></label><small>Starting recovery records your approval. A different authorised user must provide the second approval.</small><button className="primary" disabled={busy}>{busy ? "Starting…" : "Start recovery request"}</button></form>}</section>{error && <p className="form-error" role="alert">{error}</p>}<div className="account-detail-footer"><button className="secondary" type="button" onClick={closeModal}>Close</button></div></div> : <form className="admin-form permission-modal-form" onSubmit={savePermissions}><div className="permission-picker-heading"><div><h3>Choose access</h3><p>Changes take effect when the user next refreshes or signs in.</p></div><strong aria-live="polite">{selectedPermissions.length} selected</strong></div><label className="permission-search" htmlFor="permission-search"><span>Search permissions</span><input id="permission-search" type="search" value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="Search by name or description" /></label><div className="permission-choice-list">{visiblePermissions.map((permission) => { const checked = selectedPermissions.includes(permission.key); return <label className={`permission-choice${checked ? " selected" : ""}`} key={permission.key}><input type="checkbox" name="permissions" value={permission.key} checked={checked} onChange={() => setSelectedPermissions((current) => checked ? current.filter((key) => key !== permission.key) : [...current, permission.key])} /><span className="permission-choice-check" aria-hidden="true">✓</span><span><strong>{permission.key}</strong><small>{permission.description}</small></span>{permission.sensitive && <em>Sensitive</em>}</label>; })}{visiblePermissions.length === 0 && <p className="permission-empty">No permissions match that search.</p>}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="account-modal-actions"><button className="secondary" type="button" onClick={closeModal}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Saving…" : `Save ${selectedPermissions.length} permissions`}</button></div></form>}</section></div>}
  </section>;
}
