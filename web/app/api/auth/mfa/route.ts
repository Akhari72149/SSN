import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  authChallenges,
  mfaCredentials,
  mfaRecoveryCodes,
  userAccounts,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { MFA_CHALLENGE_COOKIE, isLiveMode } from "@/lib/auth/config";
import { decryptSecret, hashRecoveryCode, hashToken } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/totp";

export const runtime = "nodejs";

function rejected(status = 401) {
  return NextResponse.json({ error: "The verification code was not accepted" }, { status });
}

export async function POST(request: NextRequest) {
  if (!isLiveMode()) return NextResponse.json({ error: "Live authentication is disabled" }, { status: 409 });
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const cookieStore = await cookies();
  const challengeToken = cookieStore.get(MFA_CHALLENGE_COOKIE)?.value;
  if (!challengeToken) return rejected();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return rejected(400);
  }
  const code = typeof (body as { code?: unknown }).code === "string"
    ? (body as { code: string }).code.trim()
    : "";
  if (!code || code.length > 32) return rejected();

  const db = getDb();
  const now = new Date();
  const [challenge] = await db
    .select({
      id: authChallenges.id,
      userId: authChallenges.userId,
      attempts: authChallenges.attempts,
    })
    .from(authChallenges)
    .innerJoin(userAccounts, eq(authChallenges.userId, userAccounts.id))
    .where(and(
      eq(authChallenges.tokenHash, hashToken(challengeToken)),
      isNull(authChallenges.usedAt),
      gt(authChallenges.expiresAt, now),
      lt(authChallenges.attempts, 5),
      eq(userAccounts.status, "active"),
    ))
    .limit(1);
  if (!challenge) return rejected();

  let accepted = false;
  let usedRecoveryCodeId: string | null = null;
  if (/^\d{6}$/.test(code.replace(/\s/g, ""))) {
    const [credential] = await db
      .select({ id: mfaCredentials.id, secretCiphertext: mfaCredentials.secretCiphertext })
      .from(mfaCredentials)
      .where(and(
        eq(mfaCredentials.userId, challenge.userId),
        eq(mfaCredentials.method, "totp"),
        isNull(mfaCredentials.revokedAt),
      ))
      .limit(1);
    accepted = Boolean(credential?.secretCiphertext && verifyTotp(decryptSecret(credential.secretCiphertext), code));
    if (accepted && credential) {
      await db.update(mfaCredentials).set({ lastUsedAt: now }).where(eq(mfaCredentials.id, credential.id));
    }
  } else {
    const [recovery] = await db
      .select({ id: mfaRecoveryCodes.id })
      .from(mfaRecoveryCodes)
      .where(and(
        eq(mfaRecoveryCodes.userId, challenge.userId),
        eq(mfaRecoveryCodes.codeHash, hashRecoveryCode(code)),
        isNull(mfaRecoveryCodes.usedAt),
      ))
      .limit(1);
    accepted = Boolean(recovery);
    usedRecoveryCodeId = recovery?.id ?? null;
  }

  if (!accepted) {
    await db.update(authChallenges)
      .set({ attempts: sql`${authChallenges.attempts} + 1` })
      .where(eq(authChallenges.id, challenge.id));
    await writeAudit({
      actorUserId: challenge.userId,
      action: "auth.mfa.rejected",
      targetType: "user_account",
      targetOpaqueId: challenge.userId,
      permitted: false,
      requestId,
      reason: challenge.attempts + 1 >= 5 ? "challenge_exhausted" : "invalid_code",
    });
    return rejected(challenge.attempts + 1 >= 5 ? 429 : 401);
  }

  const [claimed] = await db.update(authChallenges)
    .set({ usedAt: now })
    .where(and(eq(authChallenges.id, challenge.id), isNull(authChallenges.usedAt)))
    .returning({ id: authChallenges.id });
  if (!claimed) return rejected();
  if (usedRecoveryCodeId) {
    await db.update(mfaRecoveryCodes).set({ usedAt: now }).where(eq(mfaRecoveryCodes.id, usedRecoveryCodeId));
  }
  await createSession(challenge.userId);
  cookieStore.delete(MFA_CHALLENGE_COOKIE);
  await writeAudit({
    actorUserId: challenge.userId,
    action: "auth.session.created",
    targetType: "user_account",
    targetOpaqueId: challenge.userId,
    permitted: true,
    requestId,
    metadata: { recoveryCode: Boolean(usedRecoveryCodeId) },
  });
  return NextResponse.json({ authenticated: true });
}
