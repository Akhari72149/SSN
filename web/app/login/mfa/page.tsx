import MfaForm from "./mfa-form";
import Image from "next/image";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  return <main className="auth-page">
    <section className="auth-card">
      <Image src="/safer-spaces-logo.webp" alt="Safer Spaces" width={276} height={83} priority />
      <p className="eyebrow coral">MULTI-FACTOR AUTHENTICATION</p>
      <h1>Enter your code</h1>
      <p>Use the current six-digit code from your authenticator, or one unused recovery code.</p>
      <MfaForm returnTo={returnTo} />
    </section>
  </main>;
}
