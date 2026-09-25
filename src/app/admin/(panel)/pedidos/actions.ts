"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sendManualEmail } from "@/lib/email";
import { logOrderEvent, syncOrder } from "@/server/orders";
import type { ActionResult } from "@/components/admin/client";

export async function resendEmailAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ orderId: z.string().min(1), type: z.enum(["PURCHASE_CONFIRMATION", "PIX_RECOVERY", "ORDER_STATUS"]), reason: z.string().max(300).optional() })
    .safeParse({ orderId: fd.get("orderId"), type: fd.get("type"), reason: fd.get("reason") || undefined });
  if (!parsed.success) return { error: "Selecione o tipo de e-mail." };
  const r = await sendManualEmail(parsed.data.orderId, parsed.data.type, admin.id, parsed.data.reason);
  await audit(admin.id, "email_resent", "order", parsed.data.orderId, { type: parsed.data.type, reason: parsed.data.reason ?? null, ok: r.ok, error: r.ok ? null : r.error });
  revalidatePath(`/admin/pedidos/${parsed.data.orderId}`);
  return r.ok ? { ok: true, message: "E-mail enviado." } : { error: r.error };
}

export async function deleteOrderAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const orderId = String(fd.get("orderId") ?? "");
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 300);
  const confirmText = String(fd.get("confirmText") ?? "").trim().toUpperCase();
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: "Pedido não encontrado." };
  if (order.deletedAt) return { error: "Pedido já excluído." };
  if (!reason) return { error: "Informe o motivo da exclusão." };
  if (order.status === "PAID" && confirmText !== order.orderNumber) return { error: `Pedido pago: digite ${order.orderNumber} para confirmar.` };

  await db.order.update({ where: { id: orderId }, data: { deletedAt: new Date(), deletedBy: admin.id, deleteReason: reason } });
  await db.emailEvent.updateMany({ where: { orderId, status: "SCHEDULED" }, data: { status: "CANCELLED", error: "Pedido excluído" } });
  await logOrderEvent(orderId, "order_deleted", `Pedido excluído (soft delete) por ${admin.email}: ${reason}`);
  await audit(admin.id, "order_deleted", "order", orderId, { reason, status: order.status, orderNumber: order.orderNumber });
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
  return { ok: true, message: "Pedido excluído (pode ser restaurado)." };
}

export async function restoreOrderAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const orderId = String(fd.get("orderId") ?? "");
  await db.order.update({ where: { id: orderId }, data: { deletedAt: null, deletedBy: null, deleteReason: null } });
  await logOrderEvent(orderId, "order_restored", `Pedido restaurado por ${admin.email}`);
  await audit(admin.id, "order_restored", "order", orderId);
  revalidatePath(`/admin/pedidos/${orderId}`);
  return { ok: true, message: "Pedido restaurado." };
}

export async function updateFulfillmentAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      orderId: z.string().min(1),
      fulfillmentStatus: z.enum(["UNFULFILLED", "PREPARING", "SHIPPED", "DELIVERED"]),
      trackingCode: z.string().trim().max(60).optional(),
      notes: z.string().max(2000).optional(),
      notify: z.boolean(),
    })
    .safeParse({
      orderId: fd.get("orderId"),
      fulfillmentStatus: fd.get("fulfillmentStatus"),
      trackingCode: fd.get("trackingCode") || undefined,
      notes: fd.get("notes") ?? undefined,
      notify: fd.get("notify") === "on",
    });
  if (!parsed.success) return { error: "Dados inválidos." };
  const { orderId, fulfillmentStatus, trackingCode, notes, notify } = parsed.data;
  const before = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (fulfillmentStatus !== "UNFULFILLED" && before.status !== "PAID") return { error: "Só é possível avançar o envio de pedidos pagos." };

  await db.order.update({ where: { id: orderId }, data: { fulfillmentStatus, trackingCode: trackingCode ?? null, notes: notes ?? before.notes } });
  await logOrderEvent(orderId, "fulfillment", `Envio: ${before.fulfillmentStatus} → ${fulfillmentStatus}${trackingCode ? ` (rastreio ${trackingCode})` : ""}`);
  await audit(admin.id, "order_updated", "order", orderId, { from: before.fulfillmentStatus, to: fulfillmentStatus, trackingCode: trackingCode ?? null });
  let message = "Pedido atualizado.";
  if (notify) {
    const r = await sendManualEmail(orderId, "ORDER_STATUS", admin.id, "Atualização de envio");
    message += r.ok ? " Cliente notificado por e-mail." : ` E-mail não enviado: ${r.error}`;
  }
  revalidatePath(`/admin/pedidos/${orderId}`);
  return { ok: true, message };
}

export async function reverifyPaymentAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const orderId = String(fd.get("orderId") ?? "");
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: "Pedido não encontrado." };
  const updated = await syncOrder(order, { minIntervalMs: 0, source: "admin" });
  await audit(admin.id, "payment_reverified", "order", orderId, { before: order.status, after: updated?.status });
  revalidatePath(`/admin/pedidos/${orderId}`);
  return { ok: true, message: updated?.status === order.status ? `Consulta feita na BravoPay: status mantido (${order.status}).` : `Status atualizado: ${updated?.status}.` };
}
