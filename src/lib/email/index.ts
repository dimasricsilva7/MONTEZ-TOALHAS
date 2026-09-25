import "server-only";
import type { EmailType } from "@prisma/client";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/env";
import { deliver } from "@/lib/email/provider";
import { trackServerEvent } from "@/lib/analytics";
import { getSettingsFresh, settingInt, isOn } from "@/server/content";
import { orderStatusEmail, pixRecoveryEmail, purchaseConfirmationEmail, type EmailOrder } from "@/emails/templates";
import { customerStatusLabel } from "@/utils/status";
import { formatCep } from "@/utils/format";

type ShippingSnapshot = EmailOrder["address"];

async function loadOrder(orderId: string) {
  return db.order.findUnique({ where: { id: orderId }, include: { customer: true, items: true } });
}
type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

function toEmailOrder(o: LoadedOrder): EmailOrder {
  const a = o.shippingAddress as unknown as ShippingSnapshot;
  return {
    orderNumber: o.orderNumber ?? o.id,
    customerName: o.customer.name,
    totalCents: o.totalCents,
    shippingCents: o.shippingCents,
    statusLabel: customerStatusLabel(o.status, o.fulfillmentStatus),
    trackingCode: o.trackingCode,
    items: o.items.map((i) => ({ name: i.productNameSnapshot, color: i.colorName, quantity: i.quantity, totalCents: i.totalPriceCents })),
    address: { ...a, cep: formatCep(a.cep ?? "") },
  };
}

export const orderLinks = (o: { orderNumber: string | null; accessToken: string }) => {
  const q = `pedido=${encodeURIComponent(o.orderNumber ?? "")}&t=${encodeURIComponent(o.accessToken)}`;
  return { track: `${siteUrl()}/pedido-confirmado?${q}`, resume: `${siteUrl()}/checkout/pendente?${q}` };
};

function render(type: EmailType, o: LoadedOrder, store: string) {
  const data = toEmailOrder(o);
  const links = orderLinks(o);
  if (type === "PIX_RECOVERY") return pixRecoveryEmail(data, links.resume, store);
  if (type === "PURCHASE_CONFIRMATION") return purchaseConfirmationEmail(data, links.track, store);
  return orderStatusEmail(data, links.track, store);
}

/** Verifica se um e-mail ainda faz sentido no momento do envio. */
function eligibility(type: EmailType, o: LoadedOrder, manual: boolean): string | null {
  if (o.deletedAt) return "Pedido excluído";
  if (type === "PIX_RECOVERY") {
    if (o.status !== "PENDING_PAYMENT") return `Pedido não está pendente (${o.status})`;
    if (!o.pixCopyPaste) return "PIX não foi gerado";
    if (o.pixExpiresAt && o.pixExpiresAt < new Date()) return "PIX expirado";
  }
  if (type === "PURCHASE_CONFIRMATION" && o.status !== "PAID" && !manual) return "Pedido não está pago";
  return null;
}

export async function scheduleEmail(orderId: string, type: EmailType, toEmail: string, delayMinutes: number) {
  const pending = await db.emailEvent.findFirst({ where: { orderId, type, status: { in: ["SCHEDULED", "SENDING", "SENT"] } } });
  if (pending) return pending; // idempotente: um agendamento automático por tipo/pedido
  return db.emailEvent.create({
    data: { orderId, type, toEmail, scheduledFor: new Date(Date.now() + delayMinutes * 60_000), triggeredBy: "system" },
  });
}

export async function cancelScheduled(orderId: string, type: EmailType, reason: string) {
  await db.emailEvent.updateMany({ where: { orderId, type, status: "SCHEDULED" }, data: { status: "CANCELLED", error: reason } });
}

/** Envia um EmailEvent já existente (reservando-o atomicamente para evitar envio duplo). */
export async function sendEmailEvent(emailEventId: string, opts: { manual?: boolean } = {}) {
  const claimed = await db.emailEvent.updateMany({
    where: { id: emailEventId, status: { in: ["SCHEDULED", "FAILED"] } },
    data: { status: "SENDING", attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return { ok: false as const, error: "E-mail já processado" };
  const ev = await db.emailEvent.findUniqueOrThrow({ where: { id: emailEventId } });
  const order = ev.orderId ? await loadOrder(ev.orderId) : null;
  if (!order) {
    await db.emailEvent.update({ where: { id: ev.id }, data: { status: "SKIPPED", error: "Pedido não encontrado" } });
    return { ok: false as const, error: "Pedido não encontrado" };
  }
  const renderType: EmailType = ev.type === "MANUAL" ? "ORDER_STATUS" : ev.type;
  const reason = eligibility(renderType, order, Boolean(opts.manual));
  if (reason) {
    await db.emailEvent.update({ where: { id: ev.id }, data: { status: "SKIPPED", error: reason } });
    return { ok: false as const, error: reason };
  }
  const settings = await getSettingsFresh();
  const store = settings.store_name || "MONTEZ";
  const { subject, html, text } = render(renderType, order, store);
  const result = await deliver({ to: ev.toEmail, subject, html, text });

  if (result.ok) {
    await db.emailEvent.update({ where: { id: ev.id }, data: { status: "SENT", sentAt: new Date(), subject, providerMessageId: result.id } });
    const name = renderType === "PIX_RECOVERY" ? "email_recovery_sent" : renderType === "PURCHASE_CONFIRMATION" ? "email_confirmation_sent" : null;
    if (name) await trackServerEvent(order, name);
    return { ok: true as const };
  }
  const giveUp = ev.attempts + 1 >= 3;
  await db.emailEvent.update({
    where: { id: ev.id },
    data: { status: giveUp ? "FAILED" : "SCHEDULED", error: result.error, subject, scheduledFor: new Date(Date.now() + 5 * 60_000) },
  });
  console.error(`[email] falha ao enviar ${ev.type} pedido=${order.orderNumber}: ${result.error}`);
  return { ok: false as const, error: result.error };
}

async function sendNow(orderId: string, type: EmailType, meta: { triggeredBy?: string; reason?: string; manual?: boolean } = {}) {
  const order = await loadOrder(orderId);
  if (!order) return { ok: false as const, error: "Pedido não encontrado" };
  const ev = await db.emailEvent.create({
    data: { orderId, type, toEmail: order.customer.email, triggeredBy: meta.triggeredBy ?? "system", reason: meta.reason ?? null },
  });
  return sendEmailEvent(ev.id, { manual: meta.manual });
}

export const sendPurchaseConfirmation = (orderId: string) => sendNow(orderId, "PURCHASE_CONFIRMATION");
export const sendPixRecovery = (orderId: string) => sendNow(orderId, "PIX_RECOVERY");
export const sendOrderStatus = (orderId: string, triggeredBy?: string) => sendNow(orderId, "ORDER_STATUS", { triggeredBy });

/**
 * Reenvio manual pelo admin. Proteção anti-spam: bloqueia o mesmo tipo para o
 * mesmo pedido se já houve envio nos últimos 5 minutos.
 */
export async function sendManualEmail(orderId: string, type: Exclude<EmailType, "MANUAL">, adminId: string, reason?: string) {
  const recent = await db.emailEvent.findFirst({
    where: { orderId, type, status: { in: ["SENT", "SENDING"] }, updatedAt: { gte: new Date(Date.now() - 5 * 60_000) } },
  });
  if (recent) return { ok: false as const, error: "Este e-mail foi enviado há menos de 5 minutos. Aguarde para reenviar." };
  return sendNow(orderId, type, { triggeredBy: `admin:${adminId}`, reason, manual: true });
}

/** Agenda recuperação de PIX para um pedido recém-criado (respeitando configurações). */
export async function scheduleRecovery(orderId: string, email: string) {
  const s = await getSettingsFresh();
  if (!isOn(s.recovery_enabled)) return;
  await scheduleEmail(orderId, "PIX_RECOVERY", email, settingInt(s, "recovery_delay_minutes", 15));
}

export async function scheduleConfirmation(orderId: string, email: string) {
  const s = await getSettingsFresh();
  if (!isOn(s.confirmation_enabled)) return;
  await scheduleEmail(orderId, "PURCHASE_CONFIRMATION", email, settingInt(s, "confirmation_delay_minutes", 15));
}

/** Processa e-mails agendados vencidos (chamado pelos jobs/cron). */
export async function processDueEmails(limit = 25) {
  // Libera envios travados em SENDING há mais de 10 min (instância morta no meio do envio)
  await db.emailEvent.updateMany({
    where: { status: "SENDING", updatedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    data: { status: "SCHEDULED" },
  });
  const due = await db.emailEvent.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: "asc" },
    take: limit,
    select: { id: true },
  });
  let sent = 0;
  let skipped = 0;
  for (const e of due) {
    const r = await sendEmailEvent(e.id);
    if (r.ok) sent++;
    else skipped++;
  }
  return { processed: due.length, sent, skipped };
}
