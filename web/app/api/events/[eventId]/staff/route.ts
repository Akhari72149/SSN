import { randomUUID } from "node:crypto";
import { and, asc, eq, ilike, max, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditEvents, staff } from "@/db/schema";
import { formatStaffCode, permissions } from "@/db/domain";
import { authorizeApi } from "@/lib/auth/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.staffRead });
  if (authorization.error) return authorization.error;
  const { eventId } = await context.params;
  const rows = await getDb().select({
    id: staff.id,
    staffCode: staff.staffCode,
    legalName: staff.legalName,
    preferredName: staff.preferredName,
    staffType: staff.type,
    roleLabel: staff.roleLabel,
    active: staff.active,
  }).from(staff).where(eq(staff.eventId, eventId)).orderBy(asc(staff.preferredName));
  return NextResponse.json({ staff: rows });
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
  const roleLabel = typeof input.roleLabel === "string" ? input.roleLabel.trim() : null;
  const type = input.staffType === "paid" || input.staffType === "volunteer" ? input.staffType : null;
  if (!legalName || !preferredName || !type || legalName.length > 160 || preferredName.length > 160 || (roleLabel?.length ?? 0) > 120) {
    return NextResponse.json({ error: "Legal name, preferred name and staff type are required" }, { status: 400 });
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
