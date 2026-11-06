import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { authSessions, userAccounts, userPermissions } from "@/db/schema";
import type { Permission } from "@/db/domain";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  secureCookies,
} from "./config";
import { hashToken, randomToken } from "./crypto";

export type AuthContext = {
  sessionId: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  csrfTokenHash: string;
  permissions: ReadonlySet<string>;
};

export async function getSessionByToken(token: string | undefined): Promise<AuthContext | null> {
  if (!token) return null;
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .select({
      sessionId: authSessions.id,
      csrfTokenHash: authSessions.csrfTokenHash,
      userId: userAccounts.id,
      email: userAccounts.email,
      displayName: userAccounts.displayName,
    })
    .from(authSessions)
    .innerJoin(userAccounts, eq(authSessions.userId, userAccounts.id))
    .where(and(
      eq(authSessions.tokenHash, hashToken(token)),
      isNull(authSessions.revokedAt),
      gt(authSessions.expiresAt, now),
      eq(userAccounts.status, "active"),
    ))
    .limit(1);

  if (!row) return null;

  const grants = await db
    .select({ key: userPermissions.permissionKey })
    .from(userPermissions)
    .where(eq(userPermissions.userId, row.userId));

  return {
    sessionId: row.sessionId,
    user: { id: row.userId, email: row.email, displayName: row.displayName },
    csrfTokenHash: row.csrfTokenHash,
    permissions: new Set(grants.map((grant) => grant.key)),
  };
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  return getSessionByToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requirePageSession(returnTo = "/") {
  const session = await getCurrentSession();
  if (!session) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return session;
}

export function hasPermission(context: AuthContext, permission: Permission) {
  return context.permissions.has(permission);
}

export async function createSession(userId: string) {
  const sessionToken = randomToken();
  const csrfToken = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  await getDb().insert(authSessions).values({
    userId,
    tokenHash: hashToken(sessionToken),
    csrfTokenHash: hashToken(csrfToken),
    mfaVerifiedAt: now,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
  cookieStore.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: secureCookies(),
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionToken) {
    await getDb()
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(eq(authSessions.tokenHash, hashToken(sessionToken)));
  }
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(CSRF_COOKIE);
}
