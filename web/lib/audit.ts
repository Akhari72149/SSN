import { getDb } from "@/db";
import { auditEvents } from "@/db/schema";

export async function writeAudit(input: {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetOpaqueId?: string | null;
  permitted: boolean;
  requestId: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await getDb().insert(auditEvents).values({
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    targetType: input.targetType,
    targetOpaqueId: input.targetOpaqueId ?? null,
    permitted: input.permitted,
    requestId: input.requestId,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
}
