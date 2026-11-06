import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { authorizeApi } from "@/lib/auth/http";
import { revokeCurrentSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authorization = await authorizeApi(request, { csrf: true });
  if (authorization.error) return authorization.error;
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  await revokeCurrentSession();
  await writeAudit({
    actorUserId: authorization.context.user.id,
    action: "auth.session.revoked",
    targetType: "user_account",
    targetOpaqueId: authorization.context.user.id,
    permitted: true,
    requestId,
  });
  return NextResponse.json({ authenticated: false });
}
