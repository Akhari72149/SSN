import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { accountRecoveryApprovals, accountRecoveryRequests, auditEvents, authChallenges, authSessions, mfaCredentials, mfaRecoveryCodes, userAccounts } from "@/db/schema";
import { permissions } from "@/db/domain";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/crypto";
import { authorizeApi } from "@/lib/auth/http";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest, context: { params: Promise<{ accountId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.accountManage, csrf: true });
  if (authorization.error) return authorization.error;
  const { accountId } = await context.params;
  if (!UUID_PATTERN.test(accountId)) return NextResponse.json({ error: "Choose a valid account" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const input = body as Record<string, unknown>;
  const action = input.action;
  if (action !== "disable" && action !== "enable" && action !== "unlock" && action !== "archive" && action !== "restore") return NextResponse.json({ error: "Unsupported account action" }, { status: 400 });
  if ((action === "disable" || action === "archive") && accountId === authorization.context.user.id) return NextResponse.json({ error: action === "archive" ? "You cannot archive your own account" : "You cannot disable your own account" }, { status: 400 });
  const archiveReason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (action === "archive" && (archiveReason.length < 10 || archiveReason.length > 500)) return NextResponse.json({ error: "Enter an archive reason of 10–500 characters" }, { status: 400 });
  const now = new Date();
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const result = await getDb().transaction(async (transaction) => {
      const rows = await transaction.execute<{ id: string; status: "invited" | "active" | "locked" | "disabled"; mustChangePassword: boolean; mfaEnrolledAt: Date | null; archivedAt: Date | null }>(sql`select id, status, must_change_password as "mustChangePassword", mfa_enrolled_at as "mfaEnrolledAt", archived_at as "archivedAt" from user_accounts where id=${accountId} for update`);
      const target = rows[0];
      if (!target) throw new Error("account_not_found");
      if (action === "archive") {
        if (target.archivedAt) throw new Error("already_archived");
        await transaction.update(userAccounts).set({ status: "disabled", archivedAt: now, archivedByUserId: authorization.context.user.id, archiveReason, updatedAt: now }).where(eq(userAccounts.id, accountId));
        await transaction.update(authSessions).set({ revokedAt: now }).where(and(eq(authSessions.userId, accountId), isNull(authSessions.revokedAt)));
        await transaction.update(authChallenges).set({ usedAt: now }).where(and(eq(authChallenges.userId, accountId), isNull(authChallenges.usedAt)));
        await transaction.update(accountRecoveryRequests).set({ status: "cancelled" }).where(and(eq(accountRecoveryRequests.targetUserId, accountId), sql`${accountRecoveryRequests.status} in ('pending', 'approved')`));
      } else if (action === "restore") {
        if (!target.archivedAt) throw new Error("not_archived");
        const restoredStatus = target.mustChangePassword || !target.mfaEnrolledAt ? "invited" : "active";
        await transaction.update(userAccounts).set({ status: restoredStatus, archivedAt: null, archivedByUserId: null, archiveReason: null, failedSignInCount: 0, lockedUntil: null, updatedAt: now }).where(eq(userAccounts.id, accountId));
      } else if (target.archivedAt) {
        throw new Error("account_archived");
      } else if (action === "disable") {
        await transaction.update(userAccounts).set({ status: "disabled", updatedAt: now }).where(eq(userAccounts.id, accountId));
        await transaction.update(authSessions).set({ revokedAt: now }).where(and(eq(authSessions.userId, accountId), isNull(authSessions.revokedAt)));
      } else if (action === "enable") {
        const restoredStatus = target.mustChangePassword || !target.mfaEnrolledAt ? "invited" : "active";
        await transaction.update(userAccounts).set({ status: restoredStatus, failedSignInCount: 0, lockedUntil: null, updatedAt: now }).where(eq(userAccounts.id, accountId));
      } else {
        const restoredStatus = target.status === "locked" ? (target.mustChangePassword || !target.mfaEnrolledAt ? "invited" : "active") : target.status;
        await transaction.update(userAccounts).set({ status: restoredStatus, failedSignInCount: 0, lockedUntil: null, updatedAt: now }).where(eq(userAccounts.id, accountId));
      }
      await transaction.insert(auditEvents).values({ actorUserId: authorization.context.user.id, action: `account.${action === "archive" ? "archived" : action === "restore" ? "restored" : action}`, targetType: "user_account", targetOpaqueId: accountId, permitted: true, requestId, metadata: action === "archive" ? { reason: archiveReason, sessionsRevoked: true, pendingRecoveryCancelled: true } : {} });
      return { action };
    });
    return NextResponse.json(result);
  } catch (cause) {
    if (cause instanceof Error && cause.message === "account_not_found") return NextResponse.json({ error: "Account not found" }, { status: 404 });
    if (cause instanceof Error && cause.message === "already_archived") return NextResponse.json({ error: "This account is already archived" }, { status: 409 });
    if (cause instanceof Error && cause.message === "not_archived") return NextResponse.json({ error: "This account is not archived" }, { status: 409 });
    if (cause instanceof Error && cause.message === "account_archived") return NextResponse.json({ error: "Restore this archived account before changing it" }, { status: 409 });
    return NextResponse.json({ error: "The account could not be updated" }, { status: 409 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ accountId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.accountReset, csrf: true });
  if (authorization.error) return authorization.error;
  const { accountId } = await context.params;
  if (!UUID_PATTERN.test(accountId)) return NextResponse.json({ error: "Choose a valid account" }, { status: 400 });
  if (accountId === authorization.context.user.id) return NextResponse.json({ error: "You cannot recover your own account" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const input = body as Record<string, unknown>;
  const action = input.action;
  const now = new Date();
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  if (action === "request_recovery") {
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (reason.length < 10 || reason.length > 500) return NextResponse.json({ error: "Enter a recovery reason of 10–500 characters" }, { status: 400 });
    try {
      const recovery = await getDb().transaction(async (transaction) => {
        const targetRows = await transaction.execute<{ id: string; archivedAt: Date | null }>(sql`select id, archived_at as "archivedAt" from user_accounts where id=${accountId} for update`);
        if (!targetRows[0]) throw new Error("account_not_found");
        if (targetRows[0].archivedAt) throw new Error("account_archived");
        const existing = await transaction.select({ id: accountRecoveryRequests.id }).from(accountRecoveryRequests).where(and(eq(accountRecoveryRequests.targetUserId, accountId), sql`${accountRecoveryRequests.status} in ('pending', 'approved')`, sql`${accountRecoveryRequests.expiresAt} > ${now}`)).limit(1);
        if (existing[0]) throw new Error("recovery_exists");
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const [created] = await transaction.insert(accountRecoveryRequests).values({ targetUserId: accountId, requestedByUserId: authorization.context.user.id, reason, expiresAt }).returning({ id: accountRecoveryRequests.id });
        await transaction.insert(accountRecoveryApprovals).values({ requestId: created.id, approverUserId: authorization.context.user.id, decision: "approve" });
        await transaction.insert(auditEvents).values({ actorUserId: authorization.context.user.id, action: "account.recovery_requested", targetType: "user_account", targetOpaqueId: accountId, permitted: true, requestId, metadata: { recoveryRequestId: created.id, approvalCount: 1 } });
        return { id: created.id, approvalCount: 1, expiresAt };
      });
      return NextResponse.json({ recovery }, { status: 201 });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      if (code === "account_not_found") return NextResponse.json({ error: "Account not found" }, { status: 404 });
      if (code === "account_archived") return NextResponse.json({ error: "Restore this account before starting recovery" }, { status: 409 });
      if (code === "recovery_exists") return NextResponse.json({ error: "A recovery request is already awaiting approval" }, { status: 409 });
      return NextResponse.json({ error: "Account recovery could not be started" }, { status: 409 });
    }
  }

  if (action !== "approve_recovery") return NextResponse.json({ error: "Unsupported recovery action" }, { status: 400 });
  const recoveryRequestId = typeof input.recoveryRequestId === "string" ? input.recoveryRequestId : "";
  if (!UUID_PATTERN.test(recoveryRequestId)) return NextResponse.json({ error: "Choose a valid recovery request" }, { status: 400 });
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  try {
    const result = await getDb().transaction(async (transaction) => {
      const targetRows = await transaction.execute<{ id: string; archivedAt: Date | null }>(sql`select id, archived_at as "archivedAt" from user_accounts where id=${accountId} for update`);
      if (!targetRows[0]) throw new Error("account_not_found");
      if (targetRows[0].archivedAt) throw new Error("account_archived");
      const rows = await transaction.execute<{ id: string; targetUserId: string; status: string; expiresAt: Date }>(sql`select id, target_user_id as "targetUserId", status, expires_at as "expiresAt" from account_recovery_requests where id=${recoveryRequestId} and target_user_id=${accountId} for update`);
      const recovery = rows[0];
      if (!recovery) throw new Error("recovery_not_found");
      if (recovery.status !== "pending" && recovery.status !== "approved") throw new Error("recovery_closed");
      if (new Date(recovery.expiresAt) <= now) throw new Error("recovery_expired");
      const [approval] = await transaction.insert(accountRecoveryApprovals).values({ requestId: recoveryRequestId, approverUserId: authorization.context.user.id, decision: "approve" }).onConflictDoNothing().returning({ userId: accountRecoveryApprovals.approverUserId });
      if (!approval) throw new Error("already_approved");
      const approvals = await transaction.select({ userId: accountRecoveryApprovals.approverUserId }).from(accountRecoveryApprovals).where(and(eq(accountRecoveryApprovals.requestId, recoveryRequestId), eq(accountRecoveryApprovals.decision, "approve")));
      if (approvals.length < 2) return { executed: false, approvalCount: approvals.length };
      await transaction.update(userAccounts).set({ passwordHash, mustChangePassword: true, mfaEnrolledAt: null, status: "invited", failedSignInCount: 0, lockedUntil: null, updatedAt: now }).where(eq(userAccounts.id, accountId));
      await transaction.update(authSessions).set({ revokedAt: now }).where(and(eq(authSessions.userId, accountId), isNull(authSessions.revokedAt)));
      await transaction.update(authChallenges).set({ usedAt: now }).where(and(eq(authChallenges.userId, accountId), isNull(authChallenges.usedAt)));
      await transaction.update(mfaCredentials).set({ revokedAt: now }).where(and(eq(mfaCredentials.userId, accountId), isNull(mfaCredentials.revokedAt)));
      await transaction.update(mfaRecoveryCodes).set({ usedAt: now }).where(and(eq(mfaRecoveryCodes.userId, accountId), isNull(mfaRecoveryCodes.usedAt)));
      await transaction.update(accountRecoveryRequests).set({ status: "executed", executedAt: now }).where(eq(accountRecoveryRequests.id, recoveryRequestId));
      await transaction.insert(auditEvents).values({ actorUserId: authorization.context.user.id, action: "account.recovery_executed", targetType: "user_account", targetOpaqueId: accountId, permitted: true, requestId, metadata: { recoveryRequestId, approvalCount: approvals.length, sessionsRevoked: true, mfaRevoked: true } });
      return { executed: true, approvalCount: approvals.length };
    });
    return NextResponse.json({ ...result, temporaryPassword: result.executed ? temporaryPassword : undefined }, { headers: { "cache-control": "no-store" } });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "";
    if (code === "account_not_found") return NextResponse.json({ error: "Account not found" }, { status: 404 });
    if (code === "account_archived") return NextResponse.json({ error: "Restore this account before approving recovery" }, { status: 409 });
    if (code === "recovery_not_found") return NextResponse.json({ error: "Recovery request not found" }, { status: 404 });
    if (code === "already_approved") return NextResponse.json({ error: "You have already approved this recovery" }, { status: 409 });
    if (code === "recovery_expired") return NextResponse.json({ error: "This recovery request has expired" }, { status: 409 });
    if (code === "recovery_closed") return NextResponse.json({ error: "This recovery request is no longer open" }, { status: 409 });
    return NextResponse.json({ error: "Recovery approval could not be recorded" }, { status: 409 });
  }
}
