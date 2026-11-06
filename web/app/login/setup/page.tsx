import Image from "next/image";
import SetupForm from "./setup-form";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; password?: string }> }) {
  const params = await searchParams;
  return <main className="auth-page">
    <section className="auth-card setup-card">
      <Image src="/safer-spaces-logo.webp" alt="Safer Spaces" width={276} height={83} priority />
      <p className="eyebrow coral">FIRST SIGN-IN</p>
      <h1>Secure your account</h1>
      <p>Replace the temporary password and connect an authenticator before entering the application.</p>
      <SetupForm returnTo={safeReturnTo(params.returnTo)} passwordRequired={params.password !== "0"} />
    </section>
  </main>;
}
