import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

/**
 * Batimento das abas abertas (a cada 30 s, só com a aba visível) → "Online agora".
 * Só atualiza sessões já criadas pelo /api/track (que descarta robôs).
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`ping:${getClientIp(req.headers)}`, 20, 60_000)) return new NextResponse(null, { status: 204 });
  const body = (await req.json().catch(() => null)) as { sid?: string; path?: string } | null;
  const sid = body?.sid;
  if (!sid || !/^[A-Za-z0-9_-]{8,64}$/.test(sid)) return new NextResponse(null, { status: 204 });
  const path = typeof body?.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 500) : null;
  await db.analyticsSession
    .updateMany({ where: { id: sid }, data: { lastSeenAt: new Date(), ...(path ? { exitPage: path } : {}) } })
    .catch(() => null);
  return new NextResponse(null, { status: 204 });
}
