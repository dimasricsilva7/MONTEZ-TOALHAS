import { NextResponse, after, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { ensurePix, findOrderByAccess, syncOrder, toPublicOrder } from "@/server/orders";
import { maybeRunJobsOpportunistically } from "@/server/jobs";

export const dynamic = "force-dynamic";

/**
 * Polling de segurança da página PIX. `force=1` corresponde ao botão "Já paguei":
 * apenas antecipa a consulta à BravoPay — nunca marca o pedido como pago.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (!rateLimit(`status:${ip}`, 40, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const sp = req.nextUrl.searchParams;
  let order = await findOrderByAccess(sp.get("pedido"), sp.get("t"));
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const force = sp.get("force") === "1";
  if (order.status === "PENDING_PAYMENT") {
    if (!order.pixCopyPaste && sp.get("retry") === "1") {
      await ensurePix(order.id).catch(() => null); // nova tentativa de gerar o PIX
    } else {
      await syncOrder(order, { minIntervalMs: force ? 3000 : 8000, source: "poll" });
    }
    order = (await findOrderByAccess(sp.get("pedido"), sp.get("t")))!;
  }

  after(() => maybeRunJobsOpportunistically());
  return NextResponse.json(toPublicOrder(order), { headers: { "Cache-Control": "no-store" } });
}
