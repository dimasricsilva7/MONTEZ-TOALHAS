/**
 * Teste ponta a ponta do fluxo de pagamento contra um servidor rodando
 * (padrão http://localhost:3000) em BRAVOPAY_MODE=mock.
 * NUNCA gera cobrança real: aborta se o servidor não estiver em modo mock.
 *   npx tsx scripts/e2e-payment.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { signWebhookPayload } from "../src/lib/payments/bravopay";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SECRET = process.env.BRAVOPAY_WEBHOOK_SECRET!;
const db = new PrismaClient();
let failures = 0;
const check = (cond: unknown, msg: string) => {
  console.log(`${cond ? "✔" : "✘"} ${msg}`);
  if (!cond) failures++;
};
const headers = { "Content-Type": "application/json", Origin: BASE };

async function main() {
  if (process.env.BRAVOPAY_MODE !== "mock") throw new Error("Abortado: BRAVOPAY_MODE precisa ser mock para este teste.");
  const product = await db.product.findUniqueOrThrow({ where: { slug: "montez-m6" }, include: { variants: { include: { color: true } } } });
  const variant = product.variants.find((v) => v.color.slug === "verde-oliva")!;
  const bump = await db.orderBump.findFirstOrThrow({ where: { active: true } });
  const token = `e2e${Date.now()}abcdefghijkl`;
  const body = {
    checkoutToken: token,
    customer: { name: "Teste Automatizado", email: "e2e+montez@example.com", cpf: "529.982.247-25", phone: "(11) 98765-4321" },
    address: { cep: "01310-100", street: "Avenida Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo", state: "SP" },
    items: [{ productId: product.id, colorId: variant.colorId, quantity: 1 }],
    bumpIds: [bump.id],
    paymentEventId: `api_${token}`,
    context: {
      sessionId: `sess${Date.now()}`,
      visitorId: `vis${Date.now()}`,
      attribution: {
        first: { source: "facebook", medium: "cpc", campaign: "campanha1", content: "criativo1" },
        last: { source: "facebook", medium: "cpc", campaign: "campanha1", content: "criativo1" },
        fbclid: "fbclid_teste",
        landingPage: "/?utm_source=facebook&utm_campaign=campanha1&utm_content=criativo1",
      },
    },
  };

  // 1. Criação + idempotência (duplo clique simultâneo)
  const [r1, r2] = await Promise.all([
    fetch(`${BASE}/api/checkout`, { method: "POST", headers, body: JSON.stringify(body) }),
    fetch(`${BASE}/api/checkout`, { method: "POST", headers, body: JSON.stringify(body) }),
  ]);
  const d1 = (await r1.json()) as { orderNumber: string; token: string };
  const d2 = (await r2.json()) as { orderNumber: string; token: string };
  check(r1.ok && r2.ok, `checkout respondeu 200 (${r1.status}/${r2.status})`);
  check(d1.orderNumber === d2.orderNumber, `duplo clique gerou o mesmo pedido (${d1.orderNumber})`);
  check(/^MONTEZ-\d{4}-\d{6}$/.test(d1.orderNumber), "formato do número do pedido");
  check((await db.order.count({ where: { checkoutToken: token } })) === 1, "apenas 1 pedido no banco");

  const order = await db.order.findUniqueOrThrow({ where: { orderNumber: d1.orderNumber }, include: { items: true } });
  check(order.totalCents === product.priceCents + bump.priceCents, `total = kit + bump (${order.totalCents})`);
  check(order.status === "PENDING_PAYMENT" && !!order.pixCopyPaste, "status PENDING_PAYMENT com PIX gerado");
  check(order.utmSource === "facebook" && order.utmCampaign === "campanha1" && order.utmContent === "criativo1", "UTMs salvas no pedido");
  check(order.firstTouchSource === "facebook" && order.channel === "facebook", "first-touch e canal");
  check(order.items.some((i) => i.kind === "ORDER_BUMP"), "order bump registrado como item");
  check((await db.emailEvent.count({ where: { orderId: order.id, type: "PIX_RECOVERY", status: "SCHEDULED" } })) === 1, "recuperação de PIX agendada");

  // 2. Validação server-side
  const bad = await fetch(`${BASE}/api/checkout`, { method: "POST", headers, body: JSON.stringify({ ...body, checkoutToken: `x${token}`, customer: { ...body.customer, cpf: "111.111.111-11" } }) });
  check(bad.status === 422, `CPF inválido rejeitado (${bad.status})`);
  const cross = await fetch(`${BASE}/api/checkout`, { method: "POST", headers: { ...headers, Origin: "https://evil.example" }, body: JSON.stringify(body) });
  check(cross.status === 403, `origem cruzada bloqueada (${cross.status})`);

  // 3. Status (polling) sem token e com token
  const noAuth = await fetch(`${BASE}/api/orders/status?pedido=${d1.orderNumber}&t=errado_errado_errado`);
  check(noAuth.status === 404, "status exige token de acesso");
  const st = (await (await fetch(`${BASE}/api/orders/status?pedido=${d1.orderNumber}&t=${d1.token}&force=1`)).json()) as { status: string };
  check(st.status === "PENDING_PAYMENT", "'Já paguei' não marca como pago");

  // 4. Webhook — assinatura inválida
  const tx = { id: order.bravopayTransactionId, status: "PAID", amount_cents: order.totalCents, fee_cents: 120, net_cents: order.totalCents - 120, external_reference: order.externalReference, paid_at: new Date().toISOString() };
  const evt = { id: `evt_e2e_${Date.now()}`, type: "transaction.paid", created: Math.floor(Date.now() / 1000), data: tx };
  const raw = JSON.stringify(evt);
  const forged = await fetch(`${BASE}/api/webhooks/bravopay`, { method: "POST", headers: { "Content-Type": "application/json", "BravoPay-Signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}` }, body: raw });
  check(forged.status === 401, `assinatura falsa rejeitada (${forged.status})`);
  const unsigned = await fetch(`${BASE}/api/webhooks/bravopay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw });
  check(unsigned.status === 401, `webhook sem assinatura rejeitado (${unsigned.status})`);
  const old = await fetch(`${BASE}/api/webhooks/bravopay`, { method: "POST", headers: { "Content-Type": "application/json", "X-Bravopay-Signature": signWebhookPayload(raw, SECRET, Math.floor(Date.now() / 1000) - 3600) }, body: raw });
  check(old.status === 401, `replay com timestamp antigo rejeitado (${old.status})`);
  check((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status === "PENDING_PAYMENT", "pedido continua pendente após webhooks inválidos");

  // 5. Webhook válido + duplicado
  const ok = await fetch(`${BASE}/api/webhooks/bravopay`, { method: "POST", headers: { "Content-Type": "application/json", "BravoPay-Signature": signWebhookPayload(raw, SECRET) }, body: raw });
  check(ok.status === 200, `webhook válido aceito (${ok.status})`);
  const dup = await fetch(`${BASE}/api/webhooks/bravopay`, { method: "POST", headers: { "Content-Type": "application/json", "X-Bravopay-Signature": signWebhookPayload(raw, SECRET) }, body: raw });
  const dupBody = (await dup.json()) as { duplicate?: boolean };
  check(dup.status === 200 && dupBody.duplicate === true, "webhook duplicado ignorado (idempotência)");

  const paid = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  check(paid.status === "PAID" && paid.paymentStatus === "PAID" && !!paid.paidAt, "pedido marcado como PAID com paid_at");
  check(paid.feeCents === 120 && paid.netCents === order.totalCents - 120, "taxa e valor líquido registrados");
  check(!!paid.stockCommittedAt && !!paid.purchaseTrackedAt, "estoque baixado e Purchase registrado uma vez");
  check((await db.emailEvent.count({ where: { orderId: order.id, type: "PIX_RECOVERY", status: "CANCELLED" } })) === 1, "recuperação cancelada após pagamento");
  check((await db.emailEvent.count({ where: { orderId: order.id, type: "PURCHASE_CONFIRMATION", status: "SCHEDULED" } })) === 1, "confirmação agendada (~15 min)");
  check((await db.analyticsEvent.count({ where: { orderId: order.id, name: "purchase" } })) === 1, "evento purchase único no analytics");
  check((await db.webhookEvent.findUniqueOrThrow({ where: { eventId: evt.id } })).status === "PROCESSED", "webhook_events PROCESSED");

  // 6. Não regride: webhook "expired" depois de pago
  const exp = { ...evt, id: `${evt.id}_exp`, type: "transaction.expired", data: { ...tx, status: "EXPIRED" } };
  const rawExp = JSON.stringify(exp);
  await fetch(`${BASE}/api/webhooks/bravopay`, { method: "POST", headers: { "Content-Type": "application/json", "BravoPay-Signature": signWebhookPayload(rawExp, SECRET) }, body: rawExp });
  check((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status === "PAID", "pedido pago não volta para expirado");

  // 7. Página de sucesso / status
  const st2 = (await (await fetch(`${BASE}/api/orders/status?pedido=${d1.orderNumber}&t=${d1.token}`)).json()) as { status: string; pixCopyPaste: string | null };
  check(st2.status === "PAID" && st2.pixCopyPaste === null, "status público PAID sem expor código PIX");
  const success = await fetch(`${BASE}/checkout/sucesso?pedido=${d1.orderNumber}&t=${d1.token}`);
  check(success.status === 200, "página de sucesso carrega");

  // 8. Cron protegido
  const cronNo = await fetch(`${BASE}/api/cron/all`);
  check(cronNo.status === 401, "cron sem segredo bloqueado");
  const cronOk = await fetch(`${BASE}/api/cron/all`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  check(cronOk.status === 200, "cron com segredo executa");

  console.log(failures ? `\n${failures} verificação(ões) falharam` : "\nTodas as verificações passaram.");
  process.exitCode = failures ? 1 : 0;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
