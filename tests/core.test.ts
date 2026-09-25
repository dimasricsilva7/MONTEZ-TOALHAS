import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildPixBody, signWebhookPayload, statusFromEvent, verifyWebhookSignature, type BravopayWebhookEvent } from "../src/lib/payments/bravopay";
import { isValidCep, isValidCpf, isValidPhone, maskCep, maskCpf, maskPhone } from "../src/utils/validators";
import { computeTotals, formatOrderNumber } from "../src/lib/pricing";
import { classifyChannel, parseUserAgent } from "../src/utils/channel";
import { formatBRL, maskCpfForList } from "../src/utils/format";

const SECRET = "whsec_test_123";
const body = JSON.stringify({ id: "evt_1", type: "transaction.paid", created: 1, data: { id: "tx_1", status: "PAID", amount_cents: 14990 } });

test("webhook: assinatura válida é aceita", () => {
  assert.equal(verifyWebhookSignature(body, signWebhookPayload(body, SECRET), SECRET), true);
});

test("webhook: formato documentado t=...,v1=HMAC(t.rawBody)", () => {
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex");
  assert.equal(verifyWebhookSignature(body, `t=${t},v1=${v1}`, SECRET), true);
});

test("webhook: corpo alterado, segredo errado, sem header ou assinatura malformada são rejeitados", () => {
  const sig = signWebhookPayload(body, SECRET);
  assert.equal(verifyWebhookSignature(body.replace("14990", "1"), sig, SECRET), false);
  assert.equal(verifyWebhookSignature(body, sig, "outro"), false);
  assert.equal(verifyWebhookSignature(body, null, SECRET), false);
  assert.equal(verifyWebhookSignature(body, sig, undefined), false);
  assert.equal(verifyWebhookSignature(body, "v1=abc", SECRET), false);
  assert.equal(verifyWebhookSignature(body, "t=abc,v1=zz", SECRET), false);
});

test("webhook: anti-replay rejeita timestamp fora da tolerância de 5 min", () => {
  const old = Math.floor(Date.now() / 1000) - 301;
  assert.equal(verifyWebhookSignature(body, signWebhookPayload(body, SECRET, old), SECRET), false);
  const recent = Math.floor(Date.now() / 1000) - 120;
  assert.equal(verifyWebhookSignature(body, signWebhookPayload(body, SECRET, recent), SECRET), true);
});

test("webhook: tipo do evento define o status", () => {
  const ev = (type: string): BravopayWebhookEvent => ({ id: "e", type, created: 0, data: { id: "t", status: "PENDING", amount_cents: 1 } });
  assert.equal(statusFromEvent(ev("transaction.paid")), "PAID");
  assert.equal(statusFromEvent(ev("transaction.expired")), "EXPIRED");
  assert.equal(statusFromEvent(ev("transaction.chargeback")), "CHARGEBACK");
  assert.equal(statusFromEvent(ev("transaction.refunded")), "REFUNDED");
  assert.equal(statusFromEvent(ev("transaction.failed")), "FAILED");
});

test("BravoPay: corpo do PIX segue a documentação", () => {
  const b = buildPixBody({
    amountCents: 14990,
    idempotencyKey: "k",
    externalReference: "MONTEZ-2026-000001",
    description: "x".repeat(400),
    customer: { name: "Ana Souza", email: "a@b.com", cpf: "529.982.247-25", phone: "(11) 98765-4321" },
    metadata: { order_id: "o1", empty: "" },
    utm: { source: "facebook", campaign: "c1", fbclid: "fb", gclid: null },
    expiresInSeconds: 10,
  });
  assert.equal(b.method, "pix");
  assert.equal(b.amount_cents, 14990);
  assert.equal(b.description.length, 300);
  assert.equal(b.expires_in, 60); // mínimo documentado
  assert.equal(b.customer.cpf, "52998224725");
  assert.equal(b.customer.phone, "11987654321");
  assert.deepEqual(b.metadata, { order_id: "o1" });
  assert.deepEqual(b.utm, { source: "facebook", campaign: "c1", fbclid: "fb" });
});

test("validadores: CPF, telefone e CEP", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("529.982.247-24"), false);
  assert.equal(isValidPhone("(11) 98765-4321"), true);
  assert.equal(isValidPhone("(11) 3456-7890"), true);
  assert.equal(isValidPhone("(01) 98765-4321"), false);
  assert.equal(isValidCep("01310-100"), true);
  assert.equal(isValidCep("0131"), false);
});

test("máscaras", () => {
  assert.equal(maskCpf("52998224725"), "529.982.247-25");
  assert.equal(maskPhone("11987654321"), "(11) 98765-4321");
  assert.equal(maskCep("01310100"), "01310-100");
  assert.equal(maskCpfForList("52998224725"), "***.982.***-**");
});

test("preços e número do pedido", () => {
  assert.deepEqual(computeTotals([{ unitPriceCents: 14990, quantity: 1 }, { unitPriceCents: 2490, quantity: 2 }], 0), {
    subtotalCents: 19970,
    discountCents: 0,
    shippingCents: 0,
    totalCents: 19970,
  });
  assert.equal(formatOrderNumber(2026, 1), "MONTEZ-2026-000001");
  assert.equal(formatBRL(14990), "R$ 149,90");
});

test("classificação de origem do tráfego", () => {
  assert.equal(classifyChannel({ source: "facebook" }), "facebook");
  assert.equal(classifyChannel({ source: "ig" }), "instagram");
  assert.equal(classifyChannel({ fbclid: "x" }), "facebook");
  assert.equal(classifyChannel({ gclid: "x" }), "google");
  assert.equal(classifyChannel({ ttclid: "x" }), "tiktok");
  assert.equal(classifyChannel({ referrer: "https://www.google.com/" }), "organico");
  assert.equal(classifyChannel({ referrer: "https://l.instagram.com/" }), "instagram");
  assert.equal(classifyChannel({}), "direto");
  assert.equal(classifyChannel({ source: "newsletter" }), "outros");
  assert.equal(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1").device, "mobile");
  assert.equal(parseUserAgent("facebookexternalhit/1.1").isBot, true);
});
