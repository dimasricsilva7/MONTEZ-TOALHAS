import "server-only";
import { Prisma, type Order, type OrderStatus, type PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { hashIp, randomToken, safeEqual } from "@/lib/crypto";
import {
  BravopayError,
  createPixTransaction,
  getTransaction,
  type BravopayStatus,
  type BravopayTransaction,
} from "@/lib/payments/bravopay";
import { computeTotals, formatOrderNumber } from "@/lib/pricing";
import { classifyChannel } from "@/utils/channel";
import { linkSessionToCustomer, trackCheckout, trackPurchase, trackServerEvent } from "@/lib/analytics";
import { sendCapiEvent, fbcFromClickId } from "@/lib/meta/capi";
import { cancelScheduled, scheduleConfirmation, scheduleRecovery } from "@/lib/email";
import { getSettingsFresh, settingInt } from "@/server/content";
import type { CheckoutInput } from "@/lib/validation";
import type { ClientContext } from "@/types/tracking";
import type { PublicOrder } from "@/types/order";

export type { PublicOrder };

export class CheckoutError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

// ───────────────────────── Log de eventos do pedido ─────────────────────────

/** Remove campos sensíveis antes de persistir logs (LGPD: nada de CPF/telefone em logs). */
function sanitize(data: unknown): Prisma.InputJsonValue | undefined {
  if (data == null) return undefined;
  const SENSITIVE = /^(cpf|phone|document|customer|access_token|authorization|api_key)$/i;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, SENSITIVE.test(k) ? "[redacted]" : walk(val)]));
    }
    return v;
  };
  return walk(data) as Prisma.InputJsonValue;
}

export async function logOrderEvent(orderId: string | null, type: string, message: string, data?: unknown, status?: string) {
  await db.paymentEvent
    .create({ data: { orderId, type, message: message.slice(0, 500), status: status ?? null, data: sanitize(data) } })
    .catch((e) => console.error("[order-event] falha ao registrar", type, e instanceof Error ? e.message : e));
}

// ───────────────────────── Checkout ─────────────────────────

type RequestMeta = { ip: string; userAgent: string | null; host: string | null };

const cut = (v: string | null | undefined, n = 200) => (v ? String(v).slice(0, n) : null);

function attributionFields(ctx: ClientContext | undefined, host: string | null) {
  const a = ctx?.attribution ?? {};
  const first = a.first ?? null;
  const last = a.last ?? a.first ?? null;
  const channel = classifyChannel({
    source: last?.source,
    medium: last?.medium,
    fbclid: a.fbclid,
    gclid: a.gclid,
    ttclid: a.ttclid,
    referrer: a.referrer,
    siteHost: host,
  });
  return {
    utmSource: cut(last?.source),
    utmMedium: cut(last?.medium),
    utmCampaign: cut(last?.campaign),
    utmContent: cut(last?.content),
    utmTerm: cut(last?.term),
    firstTouchSource: cut(first?.source),
    firstTouchMedium: cut(first?.medium),
    firstTouchCampaign: cut(first?.campaign),
    firstTouchContent: cut(first?.content),
    firstTouchTerm: cut(first?.term),
    lastTouchSource: cut(last?.source),
    lastTouchMedium: cut(last?.medium),
    lastTouchCampaign: cut(last?.campaign),
    lastTouchContent: cut(last?.content),
    lastTouchTerm: cut(last?.term),
    fbclid: cut(a.fbclid, 500),
    gclid: cut(a.gclid, 500),
    ttclid: cut(a.ttclid, 500),
    fbp: cut(ctx?.fbp),
    fbc: cut(ctx?.fbc, 500),
    landingPage: cut(a.landingPage, 500),
    referrer: cut(a.referrer, 500),
    sessionId: cut(ctx?.sessionId, 64),
    visitorId: cut(ctx?.visitorId, 64),
    channel,
  };
}

/**
 * Cria o pedido (PENDING_PAYMENT) e gera o PIX. Idempotente por checkoutToken:
 * um duplo clique (ou retry de rede) devolve o mesmo pedido em vez de criar outro.
 */
export async function createCheckoutOrder(input: CheckoutInput, meta: RequestMeta) {
  const existing = await db.order.findUnique({ where: { checkoutToken: input.checkoutToken } });
  if (existing) {
    if (existing.pixCopyPaste || existing.status !== "PENDING_PAYMENT") return { order: existing, reused: true };
    return { order: await ensurePix(existing.id), reused: true };
  }

  // Resolve produtos/variantes/cores — preços SEMPRE do banco, nunca do navegador.
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await db.product.findMany({
    where: { id: { in: productIds }, active: true },
    include: { variants: { include: { color: true } } },
  });
  const settings = await getSettingsFresh();

  const lines = input.items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new CheckoutError("Um dos produtos do carrinho não está mais disponível.");
    const variant = product.variants.find((v) => v.colorId === item.colorId && v.active && v.color.active);
    if (!variant) throw new CheckoutError(`A cor escolhida para ${product.commercialName} não está disponível.`);
    if (!product.allowBackorder && variant.stockQuantity < item.quantity) {
      throw new CheckoutError(`${product.commercialName} na cor ${variant.color.commercialName} está sem estoque suficiente.`);
    }
    return { product, variant, quantity: item.quantity, unitPriceCents: product.priceCents };
  });

  const bumps = input.bumpIds.length
    ? await db.orderBump.findMany({ where: { id: { in: input.bumpIds }, active: true } })
    : [];
  const bumpColor = lines[0].variant.color;

  const priced = [
    ...lines.map((l) => ({ unitPriceCents: l.unitPriceCents, quantity: l.quantity })),
    ...bumps.map((b) => ({ unitPriceCents: b.priceCents, quantity: 1 })),
  ];
  const shippingCents = Math.max(0, settingInt(settings, "shipping_flat_cents", 0));
  const totals = computeTotals(priced, shippingCents);
  if (totals.totalCents < 500) throw new CheckoutError("Valor mínimo do pedido não atingido.");

  const attr = attributionFields(input.context, meta.host);
  const shippingAddress = {
    cep: input.address.cep,
    street: input.address.street,
    number: input.address.number,
    complement: input.address.complement || null,
    district: input.address.district,
    city: input.address.city,
    state: input.address.state,
  };

  let order: Order;
  try {
    order = await db.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { email: input.customer.email },
        update: { name: input.customer.name, cpf: input.customer.cpf, phone: input.customer.phone },
        create: input.customer,
      });
      const address = await tx.address.create({ data: { customerId: customer.id, ...shippingAddress } });
      const created = await tx.order.create({
        data: {
          customerId: customer.id,
          addressId: address.id,
          shippingAddress,
          ...totals,
          checkoutToken: input.checkoutToken,
          accessToken: randomToken(24),
          userAgent: cut(meta.userAgent, 300),
          ipHash: hashIp(meta.ip),
          ...attr,
          items: {
            create: [
              ...lines.map((l) => ({
                kind: "PRODUCT" as const,
                productId: l.product.id,
                variantId: l.variant.id,
                productNameSnapshot: `${l.product.name} — ${l.product.commercialName}`,
                sku: l.variant.sku,
                variantLabel: `${l.product.pieceCount} peças`,
                colorName: l.variant.color.commercialName,
                colorHex: l.variant.color.hex,
                quantity: l.quantity,
                unitPriceCents: l.unitPriceCents,
                totalPriceCents: l.unitPriceCents * l.quantity,
                metadata: { pieces: l.product.pieces, composition: l.product.composition } as Prisma.InputJsonValue,
              })),
              ...bumps.map((b) => ({
                kind: "ORDER_BUMP" as const,
                productNameSnapshot: b.title.replace(/^\+\s*/, ""),
                sku: `${b.sku}-${bumpColor.slug.toUpperCase()}`,
                variantLabel: "Order bump",
                colorName: bumpColor.commercialName,
                colorHex: bumpColor.hex,
                quantity: 1,
                unitPriceCents: b.priceCents,
                totalPriceCents: b.priceCents,
                metadata: { bumpId: b.id } as Prisma.InputJsonValue,
              })),
            ],
          },
        },
      });
      const orderNumber = formatOrderNumber(new Date().getFullYear(), created.seq);
      return tx.order.update({
        where: { id: created.id },
        data: { orderNumber, externalReference: orderNumber, metaEventId: `purchase_${created.id}` },
      });
    });
  } catch (err) {
    // Corrida de duplo clique: outra requisição criou o pedido com o mesmo token.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await db.order.findUnique({ where: { checkoutToken: input.checkoutToken } });
      if (again) return { order: again, reused: true };
    }
    throw err;
  }

  await logOrderEvent(order.id, "order_created", `Pedido ${order.orderNumber} criado`, {
    total: order.totalCents,
    items: input.items.length,
    bumps: bumps.map((b) => b.sku),
  });
  await linkSessionToCustomer(order.sessionId, order.customerId);
  if (bumps.length) {
    for (const b of bumps) await trackServerEvent(order, "order_bump_accept", { valueCents: b.priceCents, props: { sku: b.sku } });
  }

  const withPix = await ensurePix(order.id);

  // Pixel/CAPI AddPaymentInfo — mesmo event_id do navegador
  if (withPix.pixCopyPaste && input.paymentEventId) {
    await sendCapiEvent({
      eventName: "AddPaymentInfo",
      eventId: input.paymentEventId,
      eventSourceUrl: `${siteUrl()}/checkout`,
      user: {
        email: input.customer.email,
        phone: input.customer.phone,
        firstName: input.customer.name.split(/\s+/)[0],
        lastName: input.customer.name.split(/\s+/).slice(-1)[0],
        city: input.address.city,
        state: input.address.state,
        zip: input.address.cep,
        externalId: order.customerId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        fbc: order.fbc ?? fbcFromClickId(order.fbclid, order.createdAt),
        fbp: order.fbp,
      },
      customData: {
        currency: "BRL",
        value: order.totalCents / 100,
        content_type: "product",
        content_ids: lines.map((l) => l.product.sku),
        contents: lines.map((l) => ({ id: l.product.sku, quantity: l.quantity, item_price: l.unitPriceCents / 100 })),
      },
    });
  }
  return { order: withPix, reused: false };
}

/** Gera o PIX na BravoPay se o pedido ainda não tiver um. Pode ser chamado de novo com segurança. */
export async function ensurePix(orderId: string): Promise<Order> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true, items: true } });
  if (order.pixCopyPaste || order.status !== "PENDING_PAYMENT") return order;

  const settings = await getSettingsFresh();
  const expiresIn = settingInt(settings, "pix_expiration_minutes", 60) * 60;
  const kit = order.items.find((i) => i.kind === "PRODUCT") ?? order.items[0];
  const description = `MONTEZ ${order.orderNumber} — ${order.items.map((i) => `${i.quantity}x ${i.productNameSnapshot}`).join(", ")}`;

  await logOrderEvent(order.id, "payment_request", "Solicitando PIX à BravoPay", {
    amount_cents: order.totalCents,
    external_reference: order.externalReference,
    expires_in: expiresIn,
  });

  try {
    const tx = await createPixTransaction({
      amountCents: order.totalCents,
      idempotencyKey: `montez-${order.id}`,
      externalReference: order.externalReference!,
      description,
      customer: { name: order.customer.name, email: order.customer.email, cpf: order.customer.cpf, phone: order.customer.phone },
      metadata: {
        order_id: order.id,
        order_number: order.orderNumber ?? "",
        product_id: kit?.productId ?? "",
        kit: kit?.sku ?? "",
        color: kit?.colorName ?? "",
        session_id: order.sessionId ?? "",
        customer_id: order.customerId,
        source: order.source,
      },
      utm: {
        source: order.utmSource,
        medium: order.utmMedium,
        campaign: order.utmCampaign,
        content: order.utmContent,
        term: order.utmTerm,
        fbclid: order.fbclid,
        gclid: order.gclid,
        ttclid: order.ttclid,
      },
      expiresInSeconds: expiresIn,
    });

    if (!tx.pix?.copy_paste) throw new BravopayError("Resposta sem código PIX", 502, "missing_pix");

    const updated = await db.order.update({
      where: { id: order.id },
      data: {
        bravopayTransactionId: tx.id,
        pixCopyPaste: tx.pix.copy_paste,
        pixExpiresAt: tx.pix.expires_at ? new Date(tx.pix.expires_at) : new Date(Date.now() + expiresIn * 1000),
        feeCents: tx.fee_cents ?? null,
        netCents: tx.net_cents ?? null,
        paymentError: null,
        payments: {
          create: {
            provider: "bravopay",
            transactionId: tx.id,
            method: "PIX",
            status: "PENDING",
            amountCents: tx.amount_cents,
            feeCents: tx.fee_cents ?? null,
            netCents: tx.net_cents ?? null,
            raw: sanitize({ ...tx, pix: { expires_at: tx.pix.expires_at } }),
          },
        },
      },
    });
    await logOrderEvent(order.id, "payment_response", "PIX gerado", { transaction_id: tx.id, status: tx.status, expires_at: tx.pix.expires_at }, tx.status);
    await trackCheckout(updated);
    await scheduleRecovery(order.id, order.customer.email);
    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    const code = err instanceof BravopayError ? err.code : undefined;
    await db.order.update({ where: { id: order.id }, data: { paymentError: message.slice(0, 300) } });
    await logOrderEvent(order.id, "payment_error", `Falha ao gerar PIX: ${message}`, { code, status: err instanceof BravopayError ? err.status : undefined }, "ERROR");
    console.error(`[checkout] falha ao gerar PIX pedido=${order.orderNumber} code=${code ?? "-"} msg=${message}`);
    throw new CheckoutError("Não foi possível gerar seu PIX. Tente novamente.", 502);
  }
}

// ───────────────────────── Status de pagamento ─────────────────────────

const STATUS_MAP: Record<BravopayStatus, { order: OrderStatus; payment: PaymentStatus }> = {
  PENDING: { order: "PENDING_PAYMENT", payment: "PENDING" },
  PAID: { order: "PAID", payment: "PAID" },
  EXPIRED: { order: "EXPIRED", payment: "EXPIRED" },
  REFUNDED: { order: "REFUNDED", payment: "REFUNDED" },
  CHARGEBACK: { order: "CHARGEBACK", payment: "CHARGEBACK" },
  FAILED: { order: "FAILED", payment: "FAILED" },
};

/** Transições permitidas — um pedido pago nunca volta para pendente/expirado. */
function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (from === "PENDING_PAYMENT") return true;
  if (from === "EXPIRED" || from === "FAILED" || from === "CANCELLED") return to === "PAID"; // pagamento tardio
  if (from === "PAID") return to === "REFUNDED" || to === "CHARGEBACK";
  if (from === "REFUNDED") return to === "CHARGEBACK";
  return false;
}

/**
 * ÚNICO ponto do sistema que altera o status de pagamento de um pedido.
 * Chamado pelo webhook (push), pelo polling e pela reconciliação (pull).
 * Os efeitos colaterais de "pago" rodam exatamente uma vez (update condicional).
 */
export async function applyTransactionSnapshot(orderId: string, tx: BravopayTransaction, source: "webhook" | "poll" | "reconcile" | "admin" | "test", statusOverride?: BravopayStatus | null) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { customer: true, items: true } });
  if (!order) return null;

  const remote = statusOverride ?? tx.status;
  const mapped = STATUS_MAP[remote];
  if (!mapped) {
    await logOrderEvent(order.id, "status_ignored", `Status desconhecido "${remote}" (${source})`, { transaction_id: tx.id });
    return order;
  }

  if (mapped.order === "PAID" && tx.amount_cents < order.totalCents) {
    await logOrderEvent(order.id, "amount_mismatch", `Valor pago (${tx.amount_cents}) menor que o total (${order.totalCents}) — não marcado como pago`, { transaction_id: tx.id, source }, "WARNING");
    return order;
  }

  await db.order.update({ where: { id: order.id }, data: { lastCheckedAt: new Date() } });
  if (!canTransition(order.status, mapped.order)) return order;

  const now = new Date();
  const paidAt = mapped.order === "PAID" ? (tx.paid_at ? new Date(tx.paid_at) : now) : undefined;
  const moved = await db.order.updateMany({
    where: { id: order.id, status: order.status },
    data: {
      status: mapped.order,
      paymentStatus: mapped.payment,
      bravopayTransactionId: order.bravopayTransactionId ?? tx.id,
      feeCents: tx.fee_cents ?? order.feeCents,
      netCents: tx.net_cents ?? order.netCents,
      ...(paidAt ? { paidAt } : {}),
      ...(mapped.order === "EXPIRED" ? { expiredAt: now } : {}),
    },
  });
  if (moved.count === 0) return db.order.findUnique({ where: { id: order.id } }); // outro processo já aplicou

  await db.payment.upsert({
    where: { transactionId: tx.id },
    update: { status: mapped.payment, feeCents: tx.fee_cents ?? undefined, netCents: tx.net_cents ?? undefined, ...(paidAt ? { paidAt } : {}) },
    create: {
      orderId: order.id,
      provider: "bravopay",
      transactionId: tx.id,
      method: "PIX",
      status: mapped.payment,
      amountCents: tx.amount_cents,
      feeCents: tx.fee_cents ?? null,
      netCents: tx.net_cents ?? null,
      paidAt: paidAt ?? null,
      raw: sanitize({ id: tx.id, status: tx.status, tracking: tx.tracking, metadata: tx.metadata }),
    },
  });
  await logOrderEvent(order.id, "status_change", `${order.status} → ${mapped.order} (${source})`, { transaction_id: tx.id, amount_cents: tx.amount_cents, fee_cents: tx.fee_cents, net_cents: tx.net_cents }, mapped.order);

  if (mapped.order === "PAID") await onPaid(order.id);
  if (mapped.order === "EXPIRED" || mapped.order === "FAILED") {
    await cancelScheduled(order.id, "PIX_RECOVERY", `Pedido ${mapped.order}`);
    if (mapped.order === "EXPIRED") await trackServerEvent(order, "checkout_abandoned", { valueCents: order.totalCents });
  }
  return db.order.findUnique({ where: { id: order.id } });
}

async function onPaid(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true, items: { include: { product: true } } } });

  await cancelScheduled(order.id, "PIX_RECOVERY", "Pedido pago");
  await scheduleConfirmation(order.id, order.customer.email);

  // Baixa de estoque (uma única vez)
  const commit = await db.order.updateMany({ where: { id: order.id, stockCommittedAt: null }, data: { stockCommittedAt: new Date() } });
  if (commit.count === 1) {
    for (const item of order.items) {
      if (item.variantId) {
        await db.productVariant.update({ where: { id: item.variantId }, data: { stockQuantity: { decrement: item.quantity } } }).catch(() => {});
      }
    }
  }

  await trackPurchase(order);

  // CAPI Purchase — mesmo event_id que o Pixel dispara na página de sucesso
  const address = order.shippingAddress as { city?: string; state?: string; cep?: string };
  const products = order.items.filter((i) => i.kind !== "ORDER_BUMP");
  await sendCapiEvent({
    eventName: "Purchase",
    eventId: order.metaEventId ?? `purchase_${order.id}`,
    eventSourceUrl: `${siteUrl()}/checkout/sucesso`,
    eventTime: Math.floor((order.paidAt ?? new Date()).getTime() / 1000),
    user: {
      email: order.customer.email,
      phone: order.customer.phone,
      firstName: order.customer.name.split(/\s+/)[0],
      lastName: order.customer.name.split(/\s+/).slice(-1)[0],
      city: address.city,
      state: address.state,
      zip: address.cep,
      externalId: order.customerId,
      userAgent: order.userAgent,
      fbc: order.fbc ?? fbcFromClickId(order.fbclid, order.createdAt),
      fbp: order.fbp,
    },
    customData: {
      currency: "BRL",
      value: order.totalCents / 100,
      order_id: order.orderNumber,
      content_type: "product",
      content_ids: products.map((i) => i.product?.sku ?? i.sku),
      contents: order.items.map((i) => ({ id: i.product?.sku ?? i.sku, quantity: i.quantity, item_price: i.unitPriceCents / 100 })),
      num_items: order.items.reduce((s, i) => s + i.quantity, 0),
    },
  });
  await db.order.update({ where: { id: order.id }, data: { purchaseTrackedAt: new Date() } });
}

const TERMINAL: OrderStatus[] = ["PAID", "REFUNDED", "CHARGEBACK", "CANCELLED"];

/**
 * Consulta a BravoPay e aplica o status (pull). Throttled por lastCheckedAt
 * para respeitar o limite de 60 req/min da API.
 */
export async function syncOrder(order: Order, opts: { minIntervalMs?: number; source?: "poll" | "reconcile" | "admin" } = {}) {
  const minInterval = opts.minIntervalMs ?? 5000;
  if (TERMINAL.includes(order.status) || !order.externalReference) return order;
  if (order.lastCheckedAt && Date.now() - order.lastCheckedAt.getTime() < minInterval) return order;

  await db.order.update({ where: { id: order.id }, data: { lastCheckedAt: new Date() } });
  try {
    const tx = await getTransaction(order.externalReference);
    if (tx) return (await applyTransactionSnapshot(order.id, tx, opts.source ?? "poll")) ?? order;
  } catch (err) {
    await logOrderEvent(order.id, "poll_error", `Falha na consulta: ${err instanceof Error ? err.message : "erro"}`, undefined, "ERROR");
    return order;
  }

  // Sem confirmação remota e PIX vencido há mais de 10 min → expira localmente.
  if (order.status === "PENDING_PAYMENT" && order.pixExpiresAt && order.pixExpiresAt.getTime() < Date.now() - 10 * 60_000) {
    const moved = await db.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { status: "EXPIRED", paymentStatus: "EXPIRED", expiredAt: new Date() },
    });
    if (moved.count) {
      await logOrderEvent(order.id, "status_change", "PENDING_PAYMENT → EXPIRED (prazo do PIX encerrado)", undefined, "EXPIRED");
      await cancelScheduled(order.id, "PIX_RECOVERY", "PIX expirado");
      await trackServerEvent(order, "checkout_abandoned", { valueCents: order.totalCents });
    }
    return (await db.order.findUnique({ where: { id: order.id } })) ?? order;
  }
  return order;
}

/** Reconciliação server-side de pedidos pendentes (cron). Limitada para respeitar rate limit. */
export async function reconcilePendingOrders(limit = 20) {
  const pending = await db.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      deletedAt: null,
      pixCopyPaste: { not: null },
      createdAt: { gte: new Date(Date.now() - 3 * 24 * 3600_000) },
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - 2 * 60_000) } }],
    },
    orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
    take: limit,
  });
  let paid = 0;
  let expired = 0;
  for (const o of pending) {
    const r = await syncOrder(o, { minIntervalMs: 0, source: "reconcile" });
    if (r?.status === "PAID") paid++;
    if (r?.status === "EXPIRED") expired++;
  }
  return { checked: pending.length, paid, expired };
}

// ───────────────────────── Acesso público ao pedido ─────────────────────────

export async function findOrderByAccess(orderNumber: string | null | undefined, token: string | null | undefined) {
  if (!orderNumber || !token || token.length < 16) return null;
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: { items: true, customer: { select: { name: true, email: true } } },
  });
  if (!order || order.deletedAt || !safeEqual(order.accessToken, token)) return null;
  return order;
}



export function toPublicOrder(o: NonNullable<Awaited<ReturnType<typeof findOrderByAccess>>>): PublicOrder {
  return {
    orderNumber: o.orderNumber!,
    status: o.status,
    fulfillmentStatus: o.fulfillmentStatus,
    trackingCode: o.trackingCode,
    totalCents: o.totalCents,
    subtotalCents: o.subtotalCents,
    shippingCents: o.shippingCents,
    pixCopyPaste: o.status === "PENDING_PAYMENT" ? o.pixCopyPaste : null,
    pixExpiresAt: o.pixExpiresAt?.toISOString() ?? null,
    paidAt: o.paidAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    metaEventId: o.metaEventId,
    customerFirstName: o.customer.name.split(/\s+/)[0],
    paymentError: !o.pixCopyPaste && Boolean(o.paymentError),
    items: o.items.map((i) => ({
      name: i.productNameSnapshot,
      sku: i.sku,
      colorName: i.colorName,
      colorHex: i.colorHex,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      totalPriceCents: i.totalPriceCents,
      kind: i.kind,
    })),
  };
}

// ───────────────────────── Upsell pós-compra ─────────────────────────

/**
 * Cria um pedido complementar (novo PIX) a partir de um pedido já pago.
 * Nunca altera o pedido original — a compra principal já está concluída.
 */
export async function createUpsellOrder(parentId: string, upsellId: string, meta: RequestMeta) {
  const parent = await db.order.findUniqueOrThrow({ where: { id: parentId }, include: { items: true } });
  if (parent.status !== "PAID") throw new CheckoutError("A oferta só está disponível após a confirmação do pagamento.");
  const upsell = await db.upsell.findFirst({ where: { id: upsellId, active: true } });
  if (!upsell) throw new CheckoutError("Oferta indisponível.");

  const token = `upsell_${parent.id}_${upsell.id}`.slice(0, 64);
  const existing = await db.order.findUnique({ where: { checkoutToken: token } });
  if (existing) return existing.pixCopyPaste || existing.status !== "PENDING_PAYMENT" ? existing : ensurePix(existing.id);

  const kit = parent.items.find((i) => i.kind === "PRODUCT") ?? parent.items[0];
  const shippingCents = 0; // segue no mesmo envio do pedido principal
  const totals = computeTotals([{ unitPriceCents: upsell.priceCents, quantity: 1 }], shippingCents);

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        source: "UPSELL",
        parentOrderId: parent.id,
        customerId: parent.customerId,
        addressId: parent.addressId,
        shippingAddress: parent.shippingAddress as Prisma.InputJsonValue,
        ...totals,
        checkoutToken: token,
        accessToken: randomToken(24),
        userAgent: cut(meta.userAgent, 300),
        ipHash: hashIp(meta.ip),
        utmSource: parent.utmSource,
        utmMedium: parent.utmMedium,
        utmCampaign: parent.utmCampaign,
        utmContent: parent.utmContent,
        utmTerm: parent.utmTerm,
        firstTouchSource: parent.firstTouchSource,
        firstTouchMedium: parent.firstTouchMedium,
        firstTouchCampaign: parent.firstTouchCampaign,
        firstTouchContent: parent.firstTouchContent,
        firstTouchTerm: parent.firstTouchTerm,
        lastTouchSource: parent.lastTouchSource,
        lastTouchMedium: parent.lastTouchMedium,
        lastTouchCampaign: parent.lastTouchCampaign,
        lastTouchContent: parent.lastTouchContent,
        lastTouchTerm: parent.lastTouchTerm,
        fbclid: parent.fbclid,
        gclid: parent.gclid,
        ttclid: parent.ttclid,
        fbp: parent.fbp,
        fbc: parent.fbc,
        landingPage: parent.landingPage,
        referrer: parent.referrer,
        sessionId: parent.sessionId,
        visitorId: parent.visitorId,
        channel: parent.channel,
        items: {
          create: {
            kind: "UPSELL",
            productNameSnapshot: upsell.title.replace(/^\+\s*/, ""),
            sku: upsell.sku,
            variantLabel: "Upsell",
            colorName: kit?.colorName ?? null,
            colorHex: kit?.colorHex ?? null,
            quantity: 1,
            unitPriceCents: upsell.priceCents,
            totalPriceCents: upsell.priceCents,
            metadata: { upsellId: upsell.id, parentOrder: parent.orderNumber } as Prisma.InputJsonValue,
          },
        },
      },
    });
    const orderNumber = formatOrderNumber(new Date().getFullYear(), created.seq);
    return tx.order.update({ where: { id: created.id }, data: { orderNumber, externalReference: orderNumber, metaEventId: `purchase_${created.id}` } });
  });
  await logOrderEvent(order.id, "order_created", `Pedido complementar (upsell) de ${parent.orderNumber}`, { upsell: upsell.sku });
  await logOrderEvent(parent.id, "upsell_accepted", `Upsell aceito — pedido ${order.orderNumber}`);
  return ensurePix(order.id);
}
