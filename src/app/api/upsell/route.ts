import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request";
import { CheckoutError, createUpsellOrder, findOrderByAccess } from "@/server/orders";
import { trackServerEvent } from "@/lib/analytics";

export const dynamic = "force-dynamic";

const schema = z.object({ pedido: z.string().max(40), t: z.string().max(80), upsellId: z.string().max(40), action: z.enum(["accept", "decline"]) });

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const ip = getClientIp(req.headers);
  if (!rateLimit(`upsell:${ip}`, 10, 10 * 60_000)) return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  const parent = await findOrderByAccess(parsed.data.pedido, parsed.data.t);
  if (!parent) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  if (parsed.data.action === "decline") {
    await trackServerEvent(parent, "upsell_decline", { props: { upsellId: parsed.data.upsellId } });
    return NextResponse.json({ ok: true });
  }

  try {
    const order = await createUpsellOrder(parent.id, parsed.data.upsellId, { ip, userAgent: req.headers.get("user-agent"), host: req.headers.get("host") });
    await trackServerEvent(parent, "upsell_accept", { valueCents: order.totalCents, props: { upsellId: parsed.data.upsellId } });
    return NextResponse.json({ orderNumber: order.orderNumber, token: order.accessToken });
  } catch (err) {
    if (err instanceof CheckoutError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Não foi possível gerar seu PIX. Tente novamente." }, { status: 500 });
  }
}
