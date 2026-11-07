import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, isNull, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditEvents, events, positions, shiftAssignments, shifts, staff } from "@/db/schema";
import { permissions } from "@/db/domain";
import { authorizeApi } from "@/lib/auth/http";

export const runtime = "nodejs";

function optionalDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

export async function GET(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.staffRead });
  if (authorization.error) return authorization.error;
  const { eventId } = await context.params;
  const from = optionalDate(request.nextUrl.searchParams.get("from"));
  const to = optionalDate(request.nextUrl.searchParams.get("to"));
  const personSearch = request.nextUrl.searchParams.get("person")?.trim().toLocaleLowerCase("en-GB") ?? "";
  if ((request.nextUrl.searchParams.has("from") && !from) || (request.nextUrl.searchParams.has("to") && !to) || (from && to && to <= from)) {
    return NextResponse.json({ error: "Enter a valid shift date range" }, { status: 400 });
  }

  const db = getDb();
  const rangeConditions = [eq(shifts.eventId, eventId)];
  if (from) rangeConditions.push(gt(shifts.endsAt, from));
  if (to) rangeConditions.push(lt(shifts.startsAt, to));
  const [eventRows, positionRows, shiftRows] = await Promise.all([
    db.select({ id: events.id, name: events.name, startsAt: events.startsAt, endsAt: events.endsAt }).from(events).where(eq(events.id, eventId)).limit(1),
    db.select({ id: positions.id, name: positions.name }).from(positions).where(eq(positions.eventId, eventId)).orderBy(asc(positions.name)),
    db.select().from(shifts).where(and(...rangeConditions)).orderBy(asc(shifts.startsAt)),
  ]);
  if (!eventRows[0]) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const assignmentRows = shiftRows.length
    ? await db.select({ id: shiftAssignments.id, shiftId: shiftAssignments.shiftId, staffId: shiftAssignments.staffId, staffName: staff.preferredName })
      .from(shiftAssignments)
      .innerJoin(staff, eq(staff.id, shiftAssignments.staffId))
      .where(and(inArray(shiftAssignments.shiftId, shiftRows.map((shift) => shift.id)), isNull(shiftAssignments.cancelledAt)))
    : [];
  const positionNames = new Map(positionRows.map((position) => [position.id, position.name]));
  const result = shiftRows.map((shift) => ({
    ...shift,
    positionName: shift.positionId ? positionNames.get(shift.positionId) ?? "Unknown position" : "Unpositioned",
    assignments: assignmentRows.filter((item) => item.shiftId === shift.id).map((item) => ({ id: item.id, staffId: item.staffId, staffName: item.staffName })),
  })).filter((shift) => !personSearch || shift.assignments.some((assignment) => assignment.staffName.toLocaleLowerCase("en-GB").includes(personSearch)));
  return NextResponse.json({ event: eventRows[0], positions: positionRows, shifts: result });
}

export async function POST(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.shiftManage, csrf: true });
  if (authorization.error) return authorization.error;
  const { eventId } = await context.params;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const input = body as Record<string, unknown>;
  const action = input.action === "create_position" ? "create_position" : "create_shift";

  if (action === "create_position") {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 120) return NextResponse.json({ error: "Position name is required" }, { status: 400 });
    try {
      const created = await getDb().transaction(async (transaction) => {
        const [event] = await transaction.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1);
        if (!event) throw new Error("event_not_found");
        const [position] = await transaction.insert(positions).values({ eventId, name }).returning({ id: positions.id, name: positions.name });
        await transaction.insert(auditEvents).values({ actorUserId: authorization.context.user.id, action: "position.created", targetType: "position", targetOpaqueId: position.id, permitted: true, requestId, metadata: { eventId } });
        return position;
      });
      return NextResponse.json({ position: created }, { status: 201 });
    } catch (cause) {
      if (cause instanceof Error && cause.message === "event_not_found") return NextResponse.json({ error: "Event not found" }, { status: 404 });
      return NextResponse.json({ error: "That position already exists for this event" }, { status: 409 });
    }
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const positionId = typeof input.positionId === "string" ? input.positionId : "";
  const startsAt = typeof input.startsAt === "string" ? new Date(input.startsAt) : new Date(Number.NaN);
  const endsAt = typeof input.endsAt === "string" ? new Date(input.endsAt) : new Date(Number.NaN);
  const staffIds = Array.isArray(input.staffIds) ? [...new Set(input.staffIds.filter((id): id is string => typeof id === "string"))] : [];
  const quantity = typeof input.quantity === "number" && Number.isInteger(input.quantity) ? input.quantity : Number(input.quantity ?? 1);
  if (!name || name.length > 120 || !positionId || Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf()) || endsAt <= startsAt || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    return NextResponse.json({ error: "Position, shift name, quantity from 1 to 50 and a valid date range are required" }, { status: 400 });
  }
  if (quantity > 1 && staffIds.length > quantity) return NextResponse.json({ error: "For multiple shift slots, select no more people than the number of shifts" }, { status: 400 });

  try {
    const created = await getDb().transaction(async (transaction) => {
      const [event] = await transaction.select({ id: events.id, startsAt: events.startsAt, endsAt: events.endsAt }).from(events).where(eq(events.id, eventId)).limit(1);
      if (!event) throw new Error("event_not_found");
      if (startsAt < event.startsAt || endsAt > event.endsAt) throw new Error("outside_event");
      const [position] = await transaction.select({ id: positions.id, name: positions.name }).from(positions).where(and(eq(positions.id, positionId), eq(positions.eventId, eventId))).limit(1);
      if (!position) throw new Error("invalid_position");
      if (staffIds.length) {
        const validStaff = await transaction.select({ id: staff.id }).from(staff).where(and(eq(staff.eventId, eventId), inArray(staff.id, staffIds)));
        if (validStaff.length !== staffIds.length) throw new Error("invalid_staff");
      }
      const createdShifts = await transaction.insert(shifts).values(Array.from({ length: quantity }, (_, index) => ({ eventId, positionId, name: quantity === 1 ? name : `${name} ${index + 1}`, startsAt, endsAt }))).returning();
      if (staffIds.length) {
        const assignments = quantity === 1
          ? staffIds.map((staffId) => ({ shiftId: createdShifts[0].id, staffId }))
          : staffIds.map((staffId, index) => ({ shiftId: createdShifts[index].id, staffId }));
        await transaction.insert(shiftAssignments).values(assignments);
      }
      await transaction.insert(auditEvents).values(createdShifts.map((shift) => ({ actorUserId: authorization.context.user.id, action: "shift.created", targetType: "shift", targetOpaqueId: shift.id, permitted: true, requestId, metadata: { eventId, positionId, batchQuantity: quantity, assignedStaff: staffIds.length } })));
      return createdShifts.map((shift, index) => ({ ...shift, positionName: position.name, staffIds: quantity === 1 ? staffIds : staffIds[index] ? [staffIds[index]] : [] }));
    });
    return NextResponse.json({ shifts: created }, { status: 201 });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "";
    if (code === "event_not_found") return NextResponse.json({ error: "Event not found" }, { status: 404 });
    if (code === "outside_event") return NextResponse.json({ error: "Shift dates must stay within the event" }, { status: 400 });
    if (code === "invalid_position") return NextResponse.json({ error: "Position must belong to this event" }, { status: 400 });
    if (code === "invalid_staff") return NextResponse.json({ error: "Every assigned person must belong to this event" }, { status: 400 });
    return NextResponse.json({ error: "The shift could not be created" }, { status: 409 });
  }
}
