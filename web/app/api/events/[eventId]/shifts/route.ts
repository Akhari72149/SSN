import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditEvents, events, shiftAssignments, shifts, staff } from "@/db/schema";
import { permissions } from "@/db/domain";
import { authorizeApi } from "@/lib/auth/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.staffRead });
  if (authorization.error) return authorization.error;
  const { eventId } = await context.params;
  const db = getDb();
  const shiftRows = await db.select().from(shifts).where(eq(shifts.eventId, eventId)).orderBy(asc(shifts.startsAt));
  const assignmentRows = shiftRows.length
    ? await db.select({ id: shiftAssignments.id, shiftId: shiftAssignments.shiftId, staffId: shiftAssignments.staffId, cancelledAt: shiftAssignments.cancelledAt })
      .from(shiftAssignments).where(inArray(shiftAssignments.shiftId, shiftRows.map((shift) => shift.id)))
    : [];
  return NextResponse.json({ shifts: shiftRows.map((shift) => ({ ...shift, staffIds: assignmentRows.filter((item) => item.shiftId === shift.id && !item.cancelledAt).map((item) => item.staffId) })) });
}

export async function POST(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.shiftManage, csrf: true });
  if (authorization.error) return authorization.error;
  const { eventId } = await context.params;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const startsAt = typeof input.startsAt === "string" ? new Date(input.startsAt) : new Date(Number.NaN);
  const endsAt = typeof input.endsAt === "string" ? new Date(input.endsAt) : new Date(Number.NaN);
  const staffIds = Array.isArray(input.staffIds) ? [...new Set(input.staffIds.filter((id): id is string => typeof id === "string"))] : [];
  if (!name || name.length > 120 || Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf()) || endsAt <= startsAt) {
    return NextResponse.json({ error: "Shift name and a valid date range are required" }, { status: 400 });
  }

  try {
    const created = await getDb().transaction(async (transaction) => {
      const [event] = await transaction.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1);
      if (!event) throw new Error("event_not_found");
      if (staffIds.length) {
        const validStaff = await transaction.select({ id: staff.id }).from(staff).where(and(eq(staff.eventId, eventId), inArray(staff.id, staffIds)));
        if (validStaff.length !== staffIds.length) throw new Error("invalid_staff");
      }
      const [shift] = await transaction.insert(shifts).values({ eventId, name, startsAt, endsAt }).returning();
      if (staffIds.length) await transaction.insert(shiftAssignments).values(staffIds.map((staffId) => ({ shiftId: shift.id, staffId })));
      await transaction.insert(auditEvents).values({ actorUserId: authorization.context.user.id, action: "shift.created", targetType: "shift", targetOpaqueId: shift.id, permitted: true, requestId, metadata: { eventId, assignedStaff: staffIds.length } });
      return { ...shift, staffIds };
    });
    return NextResponse.json({ shift: created }, { status: 201 });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "";
    if (code === "event_not_found") return NextResponse.json({ error: "Event not found" }, { status: 404 });
    if (code === "invalid_staff") return NextResponse.json({ error: "Every assigned person must belong to this event" }, { status: 400 });
    return NextResponse.json({ error: "The shift could not be created" }, { status: 409 });
  }
}
