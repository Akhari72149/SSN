import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditEvents, equipmentAllocations, equipmentItems, staff } from "@/db/schema";
import { permissions } from "@/db/domain";
import { authorizeApi } from "@/lib/auth/http";

export const runtime = "nodejs";
const itemTypes = new Set(["radio", "earpiece", "tshirt", "jumper", "tracker", "other"]);
const sizes = new Set(["S", "M", "L", "XL", "XXL"]);
const returnConditions = new Set(["available", "damaged", "lost", "retired"]);

export async function GET(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.staffRead });
  if (authorization.error) return authorization.error;
  const { eventId } = await context.params;
  const db = getDb();
  const items = await db.select().from(equipmentItems).where(eq(equipmentItems.eventId, eventId)).orderBy(asc(equipmentItems.itemCode));
  const allocations = await db.select({ id: equipmentAllocations.id, equipmentItemId: equipmentAllocations.equipmentItemId, staffId: equipmentAllocations.staffId, issuedAt: equipmentAllocations.issuedAt })
    .from(equipmentAllocations).where(and(eq(equipmentAllocations.eventId, eventId), isNull(equipmentAllocations.returnedAt)));
  return NextResponse.json({ equipment: items.map((item) => ({ ...item, allocation: allocations.find((allocation) => allocation.equipmentItemId === item.id) ?? null })) });
}

export async function POST(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const authorization = await authorizeApi(request, { permission: permissions.equipmentManage, csrf: true });
  if (authorization.error) return authorization.error;
  const { eventId } = await context.params;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const input = body as Record<string, unknown>;
  const action = input.action;
  const db = getDb();

  if (action === "create") {
    const itemCode = typeof input.itemCode === "string" ? input.itemCode.trim() : "";
    const type = typeof input.type === "string" && itemTypes.has(input.type) ? input.type as "radio" | "earpiece" | "tshirt" | "jumper" | "tracker" | "other" : null;
    const colour = input.colour === "black" || input.colour === "pink" || input.colour === "other" ? input.colour : null;
    const size = typeof input.size === "string" && sizes.has(input.size) ? input.size as "S" | "M" | "L" | "XL" | "XXL" : null;
    if (!itemCode || itemCode.length > 80 || !type || ((type === "tshirt" || type === "jumper") && !size) || (type === "tshirt" && colour !== "black" && colour !== "pink")) {
      return NextResponse.json({ error: "Enter a valid item code, type, colour and size" }, { status: 400 });
    }
    try {
      const created = await db.transaction(async (transaction) => {
        const [record] = await transaction.insert(equipmentItems).values({ eventId, itemCode, type, colour, size }).returning();
        await transaction.insert(auditEvents).values({ actorUserId: authorization.context.user.id, action: "equipment.created", targetType: "equipment", targetOpaqueId: record.id, permitted: true, requestId, metadata: { eventId } });
        return record;
      });
      return NextResponse.json({ equipment: created }, { status: 201 });
    } catch { return NextResponse.json({ error: "Item code already exists or the event is invalid" }, { status: 409 }); }
  }

  if (action === "issue") {
    const equipmentItemId = typeof input.equipmentItemId === "string" ? input.equipmentItemId : "";
    const staffId = typeof input.staffId === "string" ? input.staffId : "";
    if (!equipmentItemId || !staffId) return NextResponse.json({ error: "Equipment and staff member are required" }, { status: 400 });
    try {
      const allocation = await db.transaction(async (transaction) => {
        const itemRows = await transaction.execute<{ id: string; condition: string }>(sql`select id,condition from equipment_items where id=${equipmentItemId} and event_id=${eventId} for update`);
        const item = itemRows[0];
        if (!item || item.condition !== "available") throw new Error("item_unavailable");
        const [person] = await transaction.select({ id: staff.id }).from(staff).where(and(eq(staff.id, staffId), eq(staff.eventId, eventId))).limit(1);
        if (!person) throw new Error("staff_not_found");
        const [record] = await transaction.insert(equipmentAllocations).values({ eventId, equipmentItemId, staffId, issuedByUserId: authorization.context.user.id }).returning();
        await transaction.update(equipmentItems).set({ condition: "issued", rowVersion: sql`${equipmentItems.rowVersion} + 1` }).where(eq(equipmentItems.id, equipmentItemId));
        await transaction.insert(auditEvents).values({ actorUserId: authorization.context.user.id, action: "equipment.issued", targetType: "equipment", targetOpaqueId: equipmentItemId, permitted: true, requestId, metadata: { eventId, staffId, allocationId: record.id } });
        return record;
      });
      return NextResponse.json({ allocation }, { status: 201 });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      return NextResponse.json({ error: code === "staff_not_found" ? "Staff member not found" : "Equipment is already issued or unavailable" }, { status: code === "staff_not_found" ? 404 : 409 });
    }
  }

  if (action === "return") {
    const allocationId = typeof input.allocationId === "string" ? input.allocationId : "";
    const condition = typeof input.condition === "string" && returnConditions.has(input.condition) ? input.condition as "available" | "damaged" | "lost" | "retired" : null;
    const notes = typeof input.notes === "string" ? input.notes.trim() || null : null;
    if (!allocationId || !condition || (notes?.length ?? 0) > 1000) return NextResponse.json({ error: "Allocation and return condition are required" }, { status: 400 });
    const returned = await db.transaction(async (transaction) => {
      const [record] = await transaction.update(equipmentAllocations).set({ returnedAt: new Date(), returnedByUserId: authorization.context.user.id, returnCondition: condition, returnNotes: notes })
        .where(and(eq(equipmentAllocations.id, allocationId), eq(equipmentAllocations.eventId, eventId), isNull(equipmentAllocations.returnedAt))).returning();
      if (!record) return null;
      await transaction.update(equipmentItems).set({ condition, rowVersion: sql`${equipmentItems.rowVersion} + 1` }).where(eq(equipmentItems.id, record.equipmentItemId));
      await transaction.insert(auditEvents).values({ actorUserId: authorization.context.user.id, action: "equipment.returned", targetType: "equipment", targetOpaqueId: record.equipmentItemId, permitted: true, requestId, metadata: { eventId, allocationId, condition } });
      return record;
    });
    if (!returned) return NextResponse.json({ error: "Active equipment allocation not found" }, { status: 404 });
    return NextResponse.json({ allocation: returned });
  }

  return NextResponse.json({ error: "Unsupported equipment action" }, { status: 400 });
}
