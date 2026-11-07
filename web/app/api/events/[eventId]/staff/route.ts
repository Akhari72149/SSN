import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ilike, isNull, max, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { attendanceEvents, auditEvents, deployments, equipmentAllocations, equipmentItems, shiftAssignments, shifts, staff } from "@/db/schema";
import { formatStaffCode, isStaffRole, permissions } from "@/db/domain";
import { authorizeApi } from "@/lib/auth/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.staffRead });
  if (authorization.error) return authorization.error;
  const { eventId } = await context.params;
  const db = getDb();
  const rows = await db.select({
    id: staff.id,
    staffCode: staff.staffCode,
    legalName: staff.legalName,
    preferredName: staff.preferredName,
    staffType: staff.type,
    roleLabel: staff.roleLabel,
    active: staff.active,
  }).from(staff).where(eq(staff.eventId, eventId)).orderBy(asc(staff.preferredName));
  const [attendance, activeDeployments, activeEquipment, assignments] = await Promise.all([
    db.select({ staffId: attendanceEvents.staffId, kind: attendanceEvents.kind, occurredAt: attendanceEvents.occurredAt }).from(attendanceEvents).where(eq(attendanceEvents.eventId, eventId)).orderBy(desc(attendanceEvents.occurredAt)),
    db.select({ staffId: deployments.staffId, label: deployments.label }).from(deployments).where(and(eq(deployments.eventId, eventId), isNull(deployments.endsAt))),
    db.select({ staffId: equipmentAllocations.staffId, itemCode: equipmentItems.itemCode, type: equipmentItems.type, colour: equipmentItems.colour, size: equipmentItems.size }).from(equipmentAllocations).innerJoin(equipmentItems, eq(equipmentItems.id, equipmentAllocations.equipmentItemId)).where(and(eq(equipmentAllocations.eventId, eventId), isNull(equipmentAllocations.returnedAt))),
    db.select({ staffId: shiftAssignments.staffId, name: shifts.name, startsAt: shifts.startsAt, endsAt: shifts.endsAt }).from(shiftAssignments).innerJoin(shifts, eq(shifts.id, shiftAssignments.shiftId)).where(and(eq(shifts.eventId, eventId), isNull(shiftAssignments.cancelledAt))).orderBy(asc(shifts.startsAt)),
  ]);
  return NextResponse.json({ staff: rows.map((person) => {
    const latestAttendance = attendance.find((item) => item.staffId === person.id)?.kind ?? null;
    const personDeployments = activeDeployments.filter((item) => item.staffId === person.id).map((item) => item.label);
    const personEquipment = activeEquipment.filter((item) => item.staffId === person.id).map((item) => [item.itemCode, item.type, item.colour, item.size].filter(Boolean).join(" · "));
    const personShift = assignments.find((item) => item.staffId === person.id);
    return { ...person, attendanceState: latestAttendance, deploymentLabels: personDeployments, equipmentLabels: personEquipment, shift: personShift ? { name: personShift.name, startsAt: personShift.startsAt, endsAt: personShift.endsAt } : null };
  }) });
}

export async function POST(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.staffManage, csrf: true });
  if (authorization.error) return authorization.error;
  const { eventId } = await context.params;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const legalName = typeof input.legalName === "string" ? input.legalName.trim() : "";
  const preferredName = typeof input.preferredName === "string" ? input.preferredName.trim() : "";
  const roleLabel = typeof input.roleLabel === "string" ? input.roleLabel.trim() : "";
  const type = input.staffType === "paid" || input.staffType === "volunteer" ? input.staffType : null;
  if (!legalName || !preferredName || !type || !isStaffRole(roleLabel) || legalName.length > 160 || preferredName.length > 160) {
    return NextResponse.json({ error: "Legal name, preferred name, role and staff type are required" }, { status: 400 });
  }

  const db = getDb();
  const duplicates = await db.select({ id: staff.id, staffCode: staff.staffCode, legalName: staff.legalName, preferredName: staff.preferredName })
    .from(staff)
    .where(and(
      eq(staff.eventId, eventId),
      or(ilike(staff.legalName, legalName), ilike(staff.preferredName, preferredName)),
    ))
    .limit(10);
  if (duplicates.length > 0) {
    return NextResponse.json({ error: "A possible matching staff record already exists", matches: duplicates }, { status: 409 });
  }

  try {
    const created = await db.transaction(async (transaction) => {
      const eventRows = await transaction.execute<{ id: string; event_code: string }>(sql`
        select id,event_code from events where id=${eventId} for update
      `);
      const event = eventRows[0];
      if (!event) throw new Error("event_not_found");
      const [numberRow] = await transaction.select({ highest: max(staff.eventStaffNumber) })
        .from(staff)
        .where(eq(staff.eventId, eventId));
      const eventStaffNumber = Number(numberRow?.highest ?? 0) + 1;
      const staffCode = formatStaffCode(event.event_code, eventStaffNumber);
      const [record] = await transaction.insert(staff).values({
        eventId,
        eventStaffNumber,
        staffCode,
        legalName,
        preferredName,
        displayName: preferredName,
        type,
        roleLabel,
      }).returning({
        id: staff.id,
        staffCode: staff.staffCode,
        legalName: staff.legalName,
        preferredName: staff.preferredName,
        staffType: staff.type,
      });
      await transaction.insert(auditEvents).values({
        actorUserId: authorization.context.user.id,
        action: "staff.created",
        targetType: "staff",
        targetOpaqueId: record.id,
        permitted: true,
        requestId,
        metadata: { eventId },
      });
      return record;
    });
    return NextResponse.json({ staff: created }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error && cause.message === "event_not_found"
      ? "Event not found"
      : "The staff record could not be created";
    return NextResponse.json({ error: message }, { status: cause instanceof Error && cause.message === "event_not_found" ? 404 : 409 });
  }
}
