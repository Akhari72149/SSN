import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { attendanceEvents, auditEvents, shiftAssignments, shifts, staff } from "@/db/schema";
import { permissions } from "@/db/domain";
import { authorizeApi } from "@/lib/auth/http";

export const runtime = "nodejs";
const kinds = new Set(["sign_on", "sign_off", "did_not_attend"] as const);

export async function GET(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.staffRead });
  if (authorization.error) return authorization.error;
  const { eventId } = await context.params;
  const rows = await getDb().select({ id: attendanceEvents.id, staffId: attendanceEvents.staffId, assignmentId: attendanceEvents.assignmentId, kind: attendanceEvents.kind, occurredAt: attendanceEvents.occurredAt, recordedAt: attendanceEvents.recordedAt })
    .from(attendanceEvents).where(eq(attendanceEvents.eventId, eventId)).orderBy(desc(attendanceEvents.occurredAt)).limit(250);
  return NextResponse.json({ attendance: rows });
}

export async function POST(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.attendanceRecord, csrf: true });
  if (authorization.error) return authorization.error;
  const { eventId } = await context.params;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const input = body as Record<string, unknown>;
  const staffId = typeof input.staffId === "string" ? input.staffId : "";
  const assignmentId = typeof input.assignmentId === "string" && input.assignmentId ? input.assignmentId : null;
  const kind = typeof input.kind === "string" && kinds.has(input.kind as "sign_on") ? input.kind as "sign_on" | "sign_off" | "did_not_attend" : null;
  const occurredAt = typeof input.occurredAt === "string" && input.occurredAt ? new Date(input.occurredAt) : new Date();
  if (!staffId || !kind || Number.isNaN(occurredAt.valueOf())) return NextResponse.json({ error: "Staff member and attendance action are required" }, { status: 400 });

  try {
    const created = await getDb().transaction(async (transaction) => {
      const [person] = await transaction.select({ id: staff.id }).from(staff).where(and(eq(staff.id, staffId), eq(staff.eventId, eventId))).limit(1);
      if (!person) throw new Error("staff_not_found");
      if (assignmentId) {
        const [assignment] = await transaction.select({ id: shiftAssignments.id }).from(shiftAssignments)
          .innerJoin(shifts, eq(shifts.id, shiftAssignments.shiftId))
          .where(and(eq(shiftAssignments.id, assignmentId), eq(shiftAssignments.staffId, staffId), eq(shifts.eventId, eventId))).limit(1);
        if (!assignment) throw new Error("assignment_not_found");
      }
      const [record] = await transaction.insert(attendanceEvents).values({ eventId, assignmentId, staffId, kind, occurredAt, actorUserId: authorization.context.user.id }).returning();
      await transaction.insert(auditEvents).values({ actorUserId: authorization.context.user.id, action: `attendance.${kind}`, targetType: "staff", targetOpaqueId: staffId, permitted: true, requestId, metadata: { eventId, attendanceEventId: record.id } });
      return record;
    });
    return NextResponse.json({ attendance: created }, { status: 201 });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "";
    if (code === "staff_not_found") return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    if (code === "assignment_not_found") return NextResponse.json({ error: "Shift assignment not found" }, { status: 404 });
    return NextResponse.json({ error: "Attendance could not be recorded" }, { status: 409 });
  }
}
