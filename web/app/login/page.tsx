import { redirect } from "next/navigation";
import Image from "next/image";
import { getCurrentSession } from "@/lib/auth/session";
import { isLiveMode } from "@/lib/auth/config";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  if (isLiveMode() && await getCurrentSession()) redirect(returnTo);

  return <main className="auth-page">
    <section className="auth-card">
      <Image src="/safer-spaces-logo.webp" alt="Safer Spaces" width={276} height={83} priority />
      <p className="eyebrow coral">SECURE OPERATIONS</p>
      <h1>Sign in</h1>
      <p>Use your individual account. A verification code is required after your password.</p>
      {!isLiveMode() && <p className="auth-notice">Authentication is disabled while the application is in synthetic mode.</p>}
      <LoginForm returnTo={returnTo} />
    </section>
  </main>;
}
