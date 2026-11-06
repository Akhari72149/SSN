import { randomUUID } from "node:crypto";
import { asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { permissions, validateEventCode } from "@/db/domain";
import { writeAudit } from "@/lib/audit";
import { authorizeApi } from "@/lib/auth/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authorization = await authorizeApi(request);
  if (authorization.error) return authorization.error;
  const rows = await getDb().select({
    id: events.id,
    eventCode: events.eventCode,
    name: events.name,
    timezone: events.timezone,
    status: events.status,
    startsAt: events.startsAt,
    endsAt: events.endsAt,
  }).from(events).orderBy(asc(events.startsAt));
  return NextResponse.json({ events: rows });
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeApi(request, { permission: permissions.eventManage, csrf: true });
  if (authorization.error) return authorization.error;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const timezone = typeof input.timezone === "string" ? input.timezone.trim() : "Europe/London";
  const startsAt = typeof input.startsAt === "string" ? new Date(input.startsAt) : new Date(Number.NaN);
  const endsAt = typeof input.endsAt === "string" ? new Date(input.endsAt) : new Date(Number.NaN);
  let eventCode: string;
  try {
    eventCode = validateEventCode(typeof input.eventCode === "string" ? input.eventCode : "");
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Invalid event code" }, { status: 400 });
  }
  if (!name || name.length > 160 || !timezone || timezone.length > 80 || Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf()) || endsAt <= startsAt) {
    return NextResponse.json({ error: "Event name, timezone and date range are required" }, { status: 400 });
  }

  try {
    const [created] = await getDb().insert(events).values({
      eventCode,
      name,
      timezone,
      startsAt,
      endsAt,
      createdByUserId: authorization.context.user.id,
    }).returning({ id: events.id, eventCode: events.eventCode, name: events.name });
    await writeAudit({
      actorUserId: authorization.context.user.id,
      action: "event.created",
      targetType: "event",
      targetOpaqueId: created.id,
      permitted: true,
      requestId,
    });
    return NextResponse.json({ event: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The event could not be created; check that its code is unique" }, { status: 409 });
  }
}
