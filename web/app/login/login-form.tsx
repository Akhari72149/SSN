"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const result = await response.json() as { error?: string; firstLoginRequired?: boolean; passwordChangeRequired?: boolean };
      if (!response.ok) throw new Error(result.error ?? "Sign-in failed");
      if (result.firstLoginRequired) {
        router.push(`/login/setup?returnTo=${encodeURIComponent(returnTo)}&password=${result.passwordChangeRequired ? "1" : "0"}`);
        return;
      }
      router.push(`/login/mfa?returnTo=${encodeURIComponent(returnTo)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="auth-form" onSubmit={submit}>
    <label>Username<input name="username" type="text" autoComplete="username" minLength={3} maxLength={50} pattern="[A-Za-z][A-Za-z0-9._ -]+" autoCapitalize="none" spellCheck={false} required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" minLength={14} required /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary" disabled={submitting}>{submitting ? "Checking…" : "Continue"}</button>
  </form>;
}
