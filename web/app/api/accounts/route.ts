import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { accountRecoveryApprovals, accountRecoveryRequests, auditEvents, authSessions, permissionDefinitions, userAccounts, userPermissions } from "@/db/schema";
import { permissions } from "@/db/domain";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/crypto";
import { authorizeApi } from "@/lib/auth/http";
import { hasPermission } from "@/lib/auth/session";
import { isValidUsername, normalizeUsername } from "@/lib/auth/username";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authorization = await authorizeApi(request, { permission: permissions.accountManage });
  if (authorization.error) return authorization.error;
  const db = getDb();
  const now = new Date();
  const [accounts, grants, catalog, sessions, recoveries, recoveryApprovals] = await Promise.all([
    db.select({ id: userAccounts.id, username: userAccounts.username, displayName: userAccounts.displayName, email: userAccounts.email, status: userAccounts.status, mustChangePassword: userAccounts.mustChangePassword, mfaEnrolledAt: userAccounts.mfaEnrolledAt, failedSignInCount: userAccounts.failedSignInCount, lockedUntil: userAccounts.lockedUntil, archivedAt: userAccounts.archivedAt, archivedByUserId: userAccounts.archivedByUserId, archiveReason: userAccounts.archiveReason, updatedAt: userAccounts.updatedAt }).from(userAccounts).orderBy(asc(userAccounts.username)),
    db.select({ userId: userPermissions.userId, permissionKey: userPermissions.permissionKey }).from(userPermissions),
    db.select().from(permissionDefinitions).orderBy(asc(permissionDefinitions.key)),
    db.select({ userId: authSessions.userId, createdAt: authSessions.createdAt }).from(authSessions).orderBy(asc(authSessions.createdAt)),
    db.select().from(accountRecoveryRequests).where(and(inArray(accountRecoveryRequests.status, ["pending", "approved"]), gt(accountRecoveryRequests.expiresAt, now))),
    db.select().from(accountRecoveryApprovals).where(eq(accountRecoveryApprovals.decision, "approve")),
  ]);
  const accountNames = new Map(accounts.map((account) => [account.id, account.displayName]));
  const lastSignIns = new Map<string, Date>();
  for (const session of sessions) lastSignIns.set(session.userId, session.createdAt);
  return NextResponse.json({
    accounts: accounts.map((account) => {
      const recovery = recoveries.find((item) => item.targetUserId === account.id);
      const approvals = recovery ? recoveryApprovals.filter((item) => item.requestId === recovery.id) : [];
      return {
        ...account,
        isCurrentUser: account.id === authorization.context.user.id,
        archivedBy: account.archivedByUserId ? accountNames.get(account.archivedByUserId) ?? "Authorised user" : null,
        lastSignInAt: lastSignIns.get(account.id) ?? null,
        permissions: grants.filter((grant) => grant.userId === account.id).map((grant) => grant.permissionKey),
        recovery: recovery ? { id: recovery.id, reason: recovery.reason, requestedAt: recovery.requestedAt, expiresAt: recovery.expiresAt, requestedBy: accountNames.get(recovery.requestedByUserId) ?? "Authorised user", approvalCount: approvals.length, viewerApproved: approvals.some((item) => item.approverUserId === authorization.context.user.id) } : null,
      };
    }),
    permissionCatalog: hasPermission(authorization.context, permissions.permissionManage) ? catalog : [],
    canManagePermissions: hasPermission(authorization.context, permissions.permissionManage),
    canResetAccounts: hasPermission(authorization.context, permissions.accountReset),
  }, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const authorization = await authorizeApi(request, { permission: permissions.permissionManage, csrf: true });
  if (authorization.error) return authorization.error;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const input = body as Record<string, unknown>;
  const accountId = typeof input.accountId === "string" ? input.accountId : "";
  const requestedPermissions = Array.isArray(input.permissions) ? [...new Set(input.permissions.filter((key): key is string => typeof key === "string"))] : [];
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) return NextResponse.json({ error: "Choose a valid account" }, { status: 400 });
  if (accountId === authorization.context.user.id && (!requestedPermissions.includes(permissions.accountManage) || !requestedPermissions.includes(permissions.permissionManage))) {
    return NextResponse.json({ error: "You cannot remove your own account or permission management access" }, { status: 400 });
  }

  try {
    const updated = await getDb().transaction(async (transaction) => {
      const targetRows = await transaction.execute<{ id: string }>(sql`select id from user_accounts where id=${accountId} for update`);
      if (!targetRows[0]) throw new Error("account_not_found");
      if (requestedPermissions.length) {
        const valid = await transaction.select({ key: permissionDefinitions.key }).from(permissionDefinitions).where(inArray(permissionDefinitions.key, requestedPermissions));
        if (valid.length !== requestedPermissions.length) throw new Error("invalid_permission");
      }
      const previous = await transaction.select({ key: userPermissions.permissionKey }).from(userPermissions).where(eq(userPermissions.userId, accountId));
      await transaction.delete(userPermissions).where(eq(userPermissions.userId, accountId));
      if (requestedPermissions.length) {
        await transaction.insert(userPermissions).values(requestedPermissions.map((permissionKey) => ({ userId: accountId, permissionKey, grantedByUserId: authorization.context.user.id })));
      }
      const previousKeys = new Set(previous.map((item) => item.key));
      await transaction.insert(auditEvents).values({ actorUserId: authorization.context.user.id, action: "account.permissions_updated", targetType: "user_account", targetOpaqueId: accountId, permitted: true, requestId, metadata: { added: requestedPermissions.filter((key) => !previousKeys.has(key)), removed: previous.map((item) => item.key).filter((key) => !requestedPermissions.includes(key)), permissionCount: requestedPermissions.length } });
      return { accountId, permissions: requestedPermissions };
    });
    return NextResponse.json(updated, { headers: { "cache-control": "no-store" } });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "";
    if (code === "account_not_found") return NextResponse.json({ error: "Account not found" }, { status: 404 });
    if (code === "invalid_permission") return NextResponse.json({ error: "One or more permissions are invalid" }, { status: 400 });
    return NextResponse.json({ error: "Account permissions could not be updated" }, { status: 409 });
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeApi(request, { permission: permissions.accountManage, csrf: true });
  if (authorization.error) return authorization.error;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const input = body as Record<string, unknown>;
  const username = normalizeUsername(typeof input.username === "string" ? input.username : "");
  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
  const email = typeof input.email === "string" && input.email.trim() ? input.email.trim().toLowerCase() : null;
  const requestedPermissions = Array.isArray(input.permissions) ? [...new Set(input.permissions.filter((key): key is string => typeof key === "string"))] : [];
  if (!isValidUsername(username) || !displayName || displayName.length > 160 || (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) {
    return NextResponse.json({ error: "Enter a valid username, display name and optional email address" }, { status: 400 });
  }
  if (requestedPermissions.length && !hasPermission(authorization.context, permissions.permissionManage)) return NextResponse.json({ error: "Permission denied for assigning permissions" }, { status: 403 });

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  try {
    const account = await getDb().transaction(async (transaction) => {
      if (requestedPermissions.length) {
        const valid = await transaction.select({ key: permissionDefinitions.key }).from(permissionDefinitions).where(inArray(permissionDefinitions.key, requestedPermissions));
        if (valid.length !== requestedPermissions.length) throw new Error("invalid_permission");
      }
      const [created] = await transaction.insert(userAccounts).values({ username, displayName, email, passwordHash, status: "invited", mustChangePassword: true }).returning({ id: userAccounts.id, username: userAccounts.username, displayName: userAccounts.displayName, status: userAccounts.status });
      if (requestedPermissions.length) await transaction.insert(userPermissions).values(requestedPermissions.map((permissionKey) => ({ userId: created.id, permissionKey, grantedByUserId: authorization.context.user.id })));
      await transaction.insert(auditEvents).values({ actorUserId: authorization.context.user.id, action: "account.created", targetType: "user_account", targetOpaqueId: created.id, permitted: true, requestId, metadata: { permissionCount: requestedPermissions.length, temporaryPasswordIssued: true } });
      return created;
    });
    return NextResponse.json({ account, temporaryPassword }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "invalid_permission") return NextResponse.json({ error: "One or more permissions are invalid" }, { status: 400 });
    return NextResponse.json({ error: "That username or email address is already in use" }, { status: 409 });
  }
}
