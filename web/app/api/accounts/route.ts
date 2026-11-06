import { randomUUID } from "node:crypto";
import { asc, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditEvents, permissionDefinitions, userAccounts, userPermissions } from "@/db/schema";
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
  const [accounts, grants, catalog] = await Promise.all([
    db.select({ id: userAccounts.id, username: userAccounts.username, displayName: userAccounts.displayName, email: userAccounts.email, status: userAccounts.status, mustChangePassword: userAccounts.mustChangePassword, mfaEnrolledAt: userAccounts.mfaEnrolledAt }).from(userAccounts).orderBy(asc(userAccounts.username)),
    db.select({ userId: userPermissions.userId, permissionKey: userPermissions.permissionKey }).from(userPermissions),
    db.select().from(permissionDefinitions).orderBy(asc(permissionDefinitions.key)),
  ]);
  return NextResponse.json({ accounts: accounts.map((account) => ({ ...account, permissions: grants.filter((grant) => grant.userId === account.id).map((grant) => grant.permissionKey) })), permissionCatalog: hasPermission(authorization.context, permissions.permissionManage) ? catalog : [] }, { headers: { "cache-control": "no-store" } });
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
