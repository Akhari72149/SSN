"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function MfaForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: form.get("code") }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Verification failed");
      router.push(returnTo);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="auth-form" onSubmit={submit}>
    <label>Verification or recovery code<input name="code" inputMode="numeric" autoComplete="one-time-code" required /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary" disabled={submitting}>{submitting ? "Verifying…" : "Sign in"}</button>
  </form>;
}
