import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditEvents, authChallenges, mfaCredentials, mfaRecoveryCodes, userAccounts } from "@/db/schema";
import { FIRST_LOGIN_COOKIE, isLiveMode } from "@/lib/auth/config";
import { decryptSecret, encryptSecret, hashPassword, hashRecoveryCode, hashToken, randomToken, verifyPassword } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/auth/totp";

export const runtime = "nodejs";

function rejected(status = 401) {
  return NextResponse.json({ error: "The first-login session is no longer valid" }, { status });
}

export async function POST(request: NextRequest) {
  if (!isLiveMode()) return NextResponse.json({ error: "Live authentication is disabled" }, { status: 409 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const cookieStore = await cookies();
  const token = cookieStore.get(FIRST_LOGIN_COOKIE)?.value;
  if (!token) return rejected();
  let body: unknown;
  try { body = await request.json(); } catch { return rejected(400); }
  const input = body as Record<string, unknown>;
  const action = input.action;
  const db = getDb();
  const now = new Date();
  const [challenge] = await db.select({ id: authChallenges.id, userId: authChallenges.userId, attempts: authChallenges.attempts, username: userAccounts.username, passwordHash: userAccounts.passwordHash, mustChangePassword: userAccounts.mustChangePassword })
    .from(authChallenges).innerJoin(userAccounts, eq(userAccounts.id, authChallenges.userId))
    .where(and(eq(authChallenges.tokenHash, hashToken(token)), eq(authChallenges.purpose, "first_login"), isNull(authChallenges.usedAt), gt(authChallenges.expiresAt, now), lt(authChallenges.attempts, 5))).limit(1);
  if (!challenge) return rejected();

  if (action === "change_password") {
    const newPassword = typeof input.newPassword === "string" ? input.newPassword : "";
    if (newPassword.length < 14 || newPassword.length > 256) return NextResponse.json({ error: "Use a new password of at least 14 characters" }, { status: 400 });
    if (challenge.passwordHash && await verifyPassword(newPassword, challenge.passwordHash)) return NextResponse.json({ error: "Your new password must be different from the temporary password" }, { status: 400 });
    await db.update(userAccounts).set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, updatedAt: now }).where(eq(userAccounts.id, challenge.userId));
  } else if (action !== "prepare_mfa" && action !== "verify_mfa") {
    return NextResponse.json({ error: "Unsupported first-login action" }, { status: 400 });
  }

  if (action === "change_password" || action === "prepare_mfa") {
    const [account] = await db.select({ mustChangePassword: userAccounts.mustChangePassword }).from(userAccounts).where(eq(userAccounts.id, challenge.userId)).limit(1);
    if (!account || account.mustChangePassword) return NextResponse.json({ error: "Change the temporary password first" }, { status: 409 });
    let [credential] = await db.select({ secretCiphertext: mfaCredentials.secretCiphertext }).from(mfaCredentials)
      .where(and(eq(mfaCredentials.userId, challenge.userId), eq(mfaCredentials.method, "totp"), isNull(mfaCredentials.revokedAt))).limit(1);
    if (!credential?.secretCiphertext) {
      const secret = generateTotpSecret();
      [credential] = await db.insert(mfaCredentials).values({ userId: challenge.userId, method: "totp", label: "Primary authenticator", secretCiphertext: encryptSecret(secret), keyVersion: 1 }).returning({ secretCiphertext: mfaCredentials.secretCiphertext });
    }
    const secret = decryptSecret(credential.secretCiphertext!);
    return NextResponse.json({ mfaSetupRequired: true, secret, otpUri: totpUri({ secret, accountName: challenge.username }) }, { headers: { "cache-control": "no-store" } });
  }

  const code = typeof input.code === "string" ? input.code.trim() : "";
  const [credential] = await db.select({ id: mfaCredentials.id, secretCiphertext: mfaCredentials.secretCiphertext }).from(mfaCredentials)
    .where(and(eq(mfaCredentials.userId, challenge.userId), eq(mfaCredentials.method, "totp"), isNull(mfaCredentials.revokedAt))).limit(1);
  if (!credential?.secretCiphertext || !verifyTotp(decryptSecret(credential.secretCiphertext), code)) {
    await db.update(authChallenges).set({ attempts: sql`${authChallenges.attempts} + 1` }).where(eq(authChallenges.id, challenge.id));
    return NextResponse.json({ error: "The authenticator code was not accepted" }, { status: challenge.attempts + 1 >= 5 ? 429 : 401 });
  }

  const recoveryCodes = Array.from({ length: 10 }, () => {
    const value = randomToken(9).toUpperCase();
    return `${value.slice(0, 6)}-${value.slice(6, 12)}`;
  });
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  await db.transaction(async (transaction) => {
    const [claimed] = await transaction.update(authChallenges).set({ usedAt: now }).where(and(eq(authChallenges.id, challenge.id), isNull(authChallenges.usedAt))).returning({ id: authChallenges.id });
    if (!claimed) throw new Error("challenge_claimed");
    await transaction.update(userAccounts).set({ status: "active", mustChangePassword: false, mfaEnrolledAt: now, updatedAt: now }).where(eq(userAccounts.id, challenge.userId));
    await transaction.update(mfaCredentials).set({ enabledAt: now, lastUsedAt: now }).where(eq(mfaCredentials.id, credential.id));
    await transaction.insert(mfaRecoveryCodes).values(recoveryCodes.map((recoveryCode) => ({ userId: challenge.userId, codeHash: hashRecoveryCode(recoveryCode) })));
    await transaction.insert(auditEvents).values({ actorUserId: challenge.userId, action: "auth.first_login.completed", targetType: "user_account", targetOpaqueId: challenge.userId, permitted: true, requestId });
  });
  await createSession(challenge.userId);
  cookieStore.delete(FIRST_LOGIN_COOKIE);
  return NextResponse.json({ authenticated: true, recoveryCodes }, { headers: { "cache-control": "no-store" } });
}
