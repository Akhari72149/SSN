"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import qrcode from "@/lib/vendor/qrcode-generator.mjs";

type SetupResult = { error?: string; secret?: string; otpUri?: string; recoveryCodes?: string[] };

function AuthenticatorQrCode({ value }: { value: string }) {
  if (!value) return <div className="setup-qr-placeholder" aria-live="polite">Preparing QR code…</div>;
  const code = qrcode(0, "M");
  code.addData(value, "Byte");
  code.make();
  const count = code.getModuleCount();
  const cells: Array<{ row: number; column: number }> = [];
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (code.isDark(row, column)) cells.push({ row, column });
    }
  }
  return <svg className="setup-qr" viewBox={`-4 -4 ${count + 8} ${count + 8}`} role="img" aria-label="Authenticator setup QR code" shapeRendering="crispEdges">
    <rect x="-4" y="-4" width={count + 8} height={count + 8} fill="white" />
    {cells.map(({ row, column }) => <rect key={`${row}-${column}`} x={column} y={row} width="1" height="1" fill="black" />)}
  </svg>;
}

export default function SetupForm({ returnTo, passwordRequired }: { returnTo: string; passwordRequired: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "mfa" | "recovery">(passwordRequired ? "password" : "mfa");
  const [secret, setSecret] = useState("");
  const [otpUri, setOtpUri] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function request(values: Record<string, unknown>) {
    const response = await fetch("/api/auth/first-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
    const result = await response.json() as SetupResult;
    if (!response.ok) throw new Error(result.error ?? "Account setup could not be completed");
    return result;
  }

  useEffect(() => {
    if (passwordRequired) return;
    const timer = window.setTimeout(() => {
      void request({ action: "prepare_mfa" }).then((result) => { setSecret(result.secret ?? ""); setOtpUri(result.otpUri ?? ""); }).catch((cause) => setError(cause.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [passwordRequired]);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password !== String(data.get("confirmPassword") ?? "")) { setError("The new passwords do not match"); setBusy(false); return; }
    try {
      const result = await request({ action: "change_password", newPassword: password });
      setSecret(result.secret ?? ""); setOtpUri(result.otpUri ?? ""); setStep("mfa");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Password could not be changed"); }
    finally { setBusy(false); }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = await request({ action: "verify_mfa", code: data.get("code") });
      setRecoveryCodes(result.recoveryCodes ?? []); setStep("recovery");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Authenticator could not be verified"); }
    finally { setBusy(false); }
  }

  if (step === "password") return <form className="auth-form" onSubmit={changePassword}>
    <label>New password<input name="password" type="password" autoComplete="new-password" minLength={14} required /></label>
    <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={14} required /></label>
    <p className="form-hint">Use at least 14 characters. It must differ from the temporary password.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
  </form>;

  if (step === "mfa") return <form className="auth-form" onSubmit={verifyMfa}>
    <p className="setup-instruction">In Google Authenticator or another authenticator app, choose <strong>Add account</strong> and scan this QR code.</p>
    <AuthenticatorQrCode value={otpUri} />
    <details className="setup-manual"><summary>Can’t scan the QR code?</summary><p className="setup-instruction">Choose “Enter a setup key” in the authenticator app, then enter:</p><code className="setup-secret">{secret || "Preparing setup key…"}</code></details>
    <label>Six-digit verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary" disabled={busy || !secret}>{busy ? "Checking…" : "Verify authenticator"}</button>
  </form>;

  return <section className="recovery-panel"><h2>Save your recovery codes</h2><p>Store these once in a password manager. Each code can be used only once.</p><div className="recovery-codes">{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div><button className="primary" onClick={() => { router.push(returnTo); router.refresh(); }}>I have saved these codes</button></section>;
}
