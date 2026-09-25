import { NextResponse, type NextRequest } from "next/server";
import { checkoutSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request";
import { CheckoutError, createCheckoutOrder } from "@/server/orders";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const ip = getClientIp(req.headers);
  if (!rateLimit(`checkout:${ip}`, 8, 10 * 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(json);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
    return NextResponse.json({ error: "Confira os dados informados.", fields }, { status: 422 });
  }

  try {
    const { order } = await createCheckoutOrder(parsed.data, {
      ip,
      userAgent: req.headers.get("user-agent"),
      host: req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
    });
    return NextResponse.json({
      orderNumber: order.orderNumber,
      token: order.accessToken,
      status: order.status,
      hasPix: Boolean(order.pixCopyPaste),
    });
  } catch (err) {
    if (err instanceof CheckoutError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[checkout] erro inesperado", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Não foi possível gerar seu PIX. Tente novamente." }, { status: 500 });
  }
}
