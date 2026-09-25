import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashIp } from "@/lib/crypto";
import { getClientIp } from "@/lib/request";

export async function audit(
  adminId: string | null,
  action: string,
  entity?: string | null,
  entityId?: string | null,
  details?: Record<string, unknown>
) {
  let ipHash: string | null = null;
  try {
    ipHash = hashIp(getClientIp(await headers()));
  } catch {
    // fora de um request (jobs)
  }
  await db.auditLog
    .create({
      data: { adminId, action, entity: entity ?? null, entityId: entityId ?? null, details: (details ?? undefined) as Prisma.InputJsonValue, ipHash },
    })
    .catch((e) => console.error("[audit] falha ao registrar", action, e));
}
