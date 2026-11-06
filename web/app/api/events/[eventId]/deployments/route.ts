import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditEvents, deployments, staff } from "@/db/schema";
import { permissions } from "@/db/domain";
import { authorizeApi } from "@/lib/auth/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.staffRead });
  if (authorization.error) return authorization.error;
  const { eventId } = await context.params;
  const rows = await getDb().select().from(deployments).where(eq(deployments.eventId, eventId)).orderBy(desc(deployments.startsAt)).limit(250);
  return NextResponse.json({ deployments: rows });
}

export async function POST(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.deploymentManage, csrf: true });
  if (authorization.error) return authorization.error;
  const { eventId } = await context.params;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const input = body as Record<string, unknown>;
  const action = input.action;
  const db = getDb();

  if (action === "start") {
    const staffId = typeof input.staffId === "string" ? input.staffId : "";
    const label = typeof input.label === "string" ? input.label.trim() : "";
    const notes = typeof input.notes === "string" ? input.notes.trim() || null : null;
    const priority = input.priority === "priority" || input.priority === "urgent" ? input.priority : "routine";
    if (!staffId || !label || label.length > 160 || (notes?.length ?? 0) > 2000) return NextResponse.json({ error: "Staff member and deployment label are required" }, { status: 400 });
    try {
      const created = await db.transaction(async (transaction) => {
        const [person] = await transaction.select({ id: staff.id }).from(staff).where(and(eq(staff.id, staffId), eq(staff.eventId, eventId))).limit(1);
        if (!person) throw new Error("staff_not_found");
        const [record] = await transaction.insert(deployments).values({ eventId, staffId, label, notes, priority, changedByUserId: authorization.context.user.id }).returning();
        await transaction.insert(auditEvents).values({ actorUserId: authorization.context.user.id, action: "deployment.started", targetType: "deployment", targetOpaqueId: record.id, permitted: true, requestId, metadata: { eventId, staffId } });
        return record;
      });
      return NextResponse.json({ deployment: created }, { status: 201 });
    } catch (cause) {
      return NextResponse.json({ error: cause instanceof Error && cause.message === "staff_not_found" ? "Staff member not found" : "Deployment could not be created" }, { status: cause instanceof Error && cause.message === "staff_not_found" ? 404 : 409 });
    }
  }

  if (action === "complete") {
    const deploymentId = typeof input.deploymentId === "string" ? input.deploymentId : "";
    if (!deploymentId) return NextResponse.json({ error: "Deployment is required" }, { status: 400 });
    const completed = await db.transaction(async (transaction) => {
      const [record] = await transaction.update(deployments).set({ endsAt: new Date(), changedByUserId: authorization.context.user.id, rowVersion: sql`${deployments.rowVersion} + 1` }).where(and(eq(deployments.id, deploymentId), eq(deployments.eventId, eventId), isNull(deployments.endsAt))).returning();
      if (!record) return null;
      await transaction.insert(auditEvents).values({ actorUserId: authorization.context.user.id, action: "deployment.completed", targetType: "deployment", targetOpaqueId: record.id, permitted: true, requestId, metadata: { eventId } });
      return record;
    });
    if (!completed) return NextResponse.json({ error: "Active deployment not found" }, { status: 404 });
    return NextResponse.json({ deployment: completed });
  }

  return NextResponse.json({ error: "Unsupported deployment action" }, { status: 400 });
}
