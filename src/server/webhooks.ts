import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { processWebhook, statusFromEvent, type BravopayWebhookEvent } from "@/lib/payments/bravopay";
import { applyTransactionSnapshot, logOrderEvent } from "@/server/orders";

export type WebhookResult = { status: number; body: Record<string, unknown> };

/**
 * Processa um webhook BravoPay:
 * 1. valida assinatura HMAC-SHA256 (rejeita sem assinatura válida);
 * 2. registra o evento em webhook_events (event_id único → idempotência);
 * 3. aplica o status no pedido pelo ponto único applyTransactionSnapshot.
 */
export async function handleBravopayWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
  const parsed = processWebhook(rawBody, headers);
  if (!parsed.ok) {
    console.warn(`[webhook] rejeitado: ${parsed.reason}`);
    return { status: parsed.reason === "invalid_signature" ? 401 : 400, body: { error: parsed.reason } };
  }
  const { event, payloadHash } = parsed;

  try {
    await db.webhookEvent.create({
      data: { eventId: event.id, eventType: event.type, payloadHash, payload: stripPii(event) as Prisma.InputJsonValue },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const prev = await db.webhookEvent.findUnique({ where: { eventId: event.id } });
      // Duplicata já processada → ok. Se o anterior falhou, reprocessa.
      if (prev && prev.status !== "FAILED" && prev.status !== "RECEIVED") return { status: 200, body: { ok: true, duplicate: true } };
    } else {
      throw err;
    }
  }

  return processStoredEvent(event);
}

export async function processStoredEvent(event: BravopayWebhookEvent): Promise<WebhookResult> {
  try {
    const tx = event.data;
    const ref = tx?.external_reference;
    const order = ref
      ? await db.order.findUnique({ where: { externalReference: ref } })
      : tx?.id
        ? await db.order.findUnique({ where: { bravopayTransactionId: tx.id } })
        : null;

    if (!order) {
      await db.webhookEvent.update({ where: { eventId: event.id }, data: { status: "IGNORED", processedAt: new Date(), error: "Pedido não encontrado" } });
      return { status: 200, body: { ok: true, ignored: true } };
    }

    await logOrderEvent(order.id, "webhook", `Webhook ${event.type} recebido`, { event_id: event.id, transaction_id: tx.id, status: tx.status });

    if (event.type === "transaction.receipt_uploaded") {
      await logOrderEvent(order.id, "receipt_uploaded", "Cliente enviou comprovante na BravoPay (verificar no painel BravoPay)");
    } else {
      await applyTransactionSnapshot(order.id, tx, "webhook", statusFromEvent(event));
    }

    await db.webhookEvent.update({ where: { eventId: event.id }, data: { status: "PROCESSED", processedAt: new Date(), error: null } });
    return { status: 200, body: { ok: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro";
    console.error(`[webhook] erro ao processar ${event.type} ${event.id}: ${message}`);
    await db.webhookEvent.update({ where: { eventId: event.id }, data: { status: "FAILED", error: message.slice(0, 500) } }).catch(() => {});
    // 500 faz a BravoPay tentar de novo (até 8 tentativas com backoff).
    return { status: 500, body: { error: "processing_failed" } };
  }
}

/** Reprocessa webhooks que falharam (job). */
export async function retryFailedWebhooks(limit = 10) {
  const failed = await db.webhookEvent.findMany({
    where: { status: { in: ["FAILED", "RECEIVED"] }, receivedAt: { lt: new Date(Date.now() - 60_000) } },
    take: limit,
    orderBy: { receivedAt: "asc" },
  });
  for (const w of failed) await processStoredEvent(w.payload as unknown as BravopayWebhookEvent);
  return { retried: failed.length };
}

/** Remove dados pessoais do cliente antes de guardar o payload bruto. */
function stripPii(event: BravopayWebhookEvent) {
  const data = { ...(event.data as unknown as Record<string, unknown>) };
  if (data.customer) data.customer = "[redacted]";
  if (data.pix) data.pix = "[omitted]";
  return { ...event, data };
}
