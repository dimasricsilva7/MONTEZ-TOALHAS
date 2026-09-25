import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request";

export const dynamic = "force-dynamic";

const schema = z.object({ orderNumber: z.string().trim().toUpperCase().max(40), email: z.string().trim().toLowerCase().email().max(160) });

/** Rastreio: exige número do pedido + e-mail da compra. Devolve o link seguro do pedido. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const ip = getClientIp(req.headers);
  if (!rateLimit(`lookup:${ip}`, 10, 10 * 60_000)) return NextResponse.json({ error: "Muitas tentativas. Tente mais tarde." }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe o número do pedido e o e-mail." }, { status: 422 });

  const order = await db.order.findUnique({
    where: { orderNumber: parsed.data.orderNumber },
    select: { orderNumber: true, accessToken: true, deletedAt: true, customer: { select: { email: true } } },
  });
  if (!order || order.deletedAt || order.customer.email !== parsed.data.email) {
    return NextResponse.json({ error: "Não encontramos um pedido com esses dados." }, { status: 404 });
  }
  return NextResponse.json({ url: `/pedido-confirmado?pedido=${encodeURIComponent(order.orderNumber!)}&t=${encodeURIComponent(order.accessToken)}` });
}
