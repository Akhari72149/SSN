import { randomUUID } from "node:crypto";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { authChallenges, userAccounts } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  LOCKOUT_DURATION_MS,
  MAX_PASSWORD_FAILURES,
  FIRST_LOGIN_COOKIE,
  FIRST_LOGIN_DURATION_MS,
  MFA_CHALLENGE_COOKIE,
  MFA_CHALLENGE_DURATION_MS,
  isLiveMode,
  secureCookies,
} from "@/lib/auth/config";
import { hashToken, randomToken, verifyPassword } from "@/lib/auth/crypto";
import { isValidUsername, normalizeUsername } from "@/lib/auth/username";

export const runtime = "nodejs";

const DUMMY_PASSWORD_HASH = "scrypt$32768$8$1$jQW76czoRfGwlNxc3dWXaA$zWWPKafpJr2OOkBx-ZRPbn6DY_iqUalsjj-SPOBN9w2FDR_HGTqHAi-s1XKFHaOw816Cz21cdk3TibqsSU_qHQ";

function genericFailure(status = 401) {
  return NextResponse.json({ error: "Sign-in details were not accepted" }, { status });
}

export async function POST(request: NextRequest) {
  if (!isLiveMode()) return NextResponse.json({ error: "Live authentication is disabled" }, { status: 409 });

  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return genericFailure(400);
  }
  const username = typeof (body as { username?: unknown }).username === "string"
    ? normalizeUsername((body as { username: string }).username)
    : "";
  const password = typeof (body as { password?: unknown }).password === "string"
    ? (body as { password: string }).password
    : "";
  if (!isValidUsername(username) || !password || password.length > 256) return genericFailure();

  const db = getDb();
  const [account] = await db
    .select()
    .from(userAccounts)
    .where(eq(userAccounts.username, username))
    .limit(1);

  const now = new Date();
  if (!account) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    return genericFailure();
  }

  if ((account.status !== "active" && account.status !== "invited") || (account.lockedUntil && account.lockedUntil > now) || !account.passwordHash) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    await writeAudit({
      actorUserId: account.id,
      action: "auth.password.rejected",
      targetType: "user_account",
      targetOpaqueId: account.id,
      permitted: false,
      requestId,
      reason: "account_unavailable",
    });
    return genericFailure(account.lockedUntil && account.lockedUntil > now ? 429 : 401);
  }

  const accepted = await verifyPassword(password, account.passwordHash);
  if (!accepted) {
    const failures = account.failedSignInCount + 1;
    await db.update(userAccounts).set({
      failedSignInCount: sql`${userAccounts.failedSignInCount} + 1`,
      lockedUntil: failures >= MAX_PASSWORD_FAILURES
        ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
        : account.lockedUntil,
      updatedAt: now,
    }).where(eq(userAccounts.id, account.id));
    await writeAudit({
      actorUserId: account.id,
      action: "auth.password.rejected",
      targetType: "user_account",
      targetOpaqueId: account.id,
      permitted: false,
      requestId,
      reason: failures >= MAX_PASSWORD_FAILURES ? "temporary_lockout" : "invalid_password",
    });
    return genericFailure(failures >= MAX_PASSWORD_FAILURES ? 429 : 401);
  }

  if (account.mustChangePassword || !account.mfaEnrolledAt) {
    await db.update(userAccounts).set({ failedSignInCount: 0, lockedUntil: null, updatedAt: now }).where(eq(userAccounts.id, account.id));
    const challengeToken = randomToken();
    const expiresAt = new Date(now.getTime() + FIRST_LOGIN_DURATION_MS);
    await db.insert(authChallenges).values({ userId: account.id, tokenHash: hashToken(challengeToken), purpose: "first_login", expiresAt });
    const cookieStore = await cookies();
    cookieStore.set(FIRST_LOGIN_COOKIE, challengeToken, { httpOnly: true, secure: secureCookies(), sameSite: "strict", path: "/", expires: expiresAt });
    await writeAudit({
      actorUserId: account.id,
      action: "auth.password.accepted",
      targetType: "user_account",
      targetOpaqueId: account.id,
      permitted: false,
      requestId,
      reason: account.mustChangePassword ? "password_change_required" : "mfa_enrollment_required",
    });
    return NextResponse.json({ firstLoginRequired: true, passwordChangeRequired: account.mustChangePassword });
  }

  await db.update(userAccounts).set({ failedSignInCount: 0, lockedUntil: null, updatedAt: now }).where(eq(userAccounts.id, account.id));
  await db.delete(authChallenges).where(and(
    eq(authChallenges.userId, account.id),
    isNull(authChallenges.usedAt),
    lt(authChallenges.expiresAt, now),
  ));

  const challengeToken = randomToken();
  const expiresAt = new Date(now.getTime() + MFA_CHALLENGE_DURATION_MS);
  await db.insert(authChallenges).values({
    userId: account.id,
    tokenHash: hashToken(challengeToken),
    purpose: "mfa",
    expiresAt,
  });
  const cookieStore = await cookies();
  cookieStore.set(MFA_CHALLENGE_COOKIE, challengeToken, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
  await writeAudit({
    actorUserId: account.id,
    action: "auth.password.accepted",
    targetType: "user_account",
    targetOpaqueId: account.id,
    permitted: true,
    requestId,
  });
  return NextResponse.json({ mfaRequired: true });
}
