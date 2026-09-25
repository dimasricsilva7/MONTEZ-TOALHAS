import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { Badge, Card, ORDER_TONE, PageHeader, btnSecondary, inputCls, labelCls, textareaCls } from "@/components/admin/ui";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/admin/client";
import { deleteOrderAction, restoreOrderAction, resendEmailAction, reverifyPaymentAction, updateFulfillmentAction } from "../actions";
import { formatBRL, formatCep, formatCpf, formatDate, formatPhone } from "@/utils/format";
import { EMAIL_STATUS_LABEL, EMAIL_TYPE_LABEL, FULFILLMENT_LABEL, ORDER_STATUS_LABEL } from "@/utils/status";
import { CHANNEL_LABEL } from "@/utils/channel";

export const metadata: Metadata = { title: "Pedido" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-slate-900">{value ?? "—"}</dd>
    </div>
  );
}

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  const order = await db.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: true,
      payments: true,
      paymentEvents: { orderBy: { createdAt: "desc" }, take: 60 },
      emailEvents: { orderBy: { createdAt: "desc" } },
      parentOrder: { select: { id: true, orderNumber: true } },
      upsellOrders: { select: { id: true, orderNumber: true, status: true } },
    },
  });
  if (!order) notFound();
  // LGPD: visualização de dados completos do cliente fica registrada
  await audit(admin.id, "order_viewed", "order", order.id);

  const a = order.shippingAddress as { cep: string; street: string; number: string; complement?: string | null; district: string; city: string; state: string };

  return (
    <>
      <PageHeader
        title={`Pedido ${order.orderNumber}`}
        description={`Criado em ${formatDate(order.createdAt, true)}${order.source === "UPSELL" ? " · pedido complementar (upsell)" : ""}`}
        actions={
          <>
            <Badge tone={ORDER_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
            {order.deletedAt && <Badge tone="red">Excluído</Badge>}
            <Link href="/admin/pedidos" className={btnSecondary}>Voltar</Link>
          </>
        }
      />
      {order.deletedAt && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Excluído em {formatDate(order.deletedAt, true)}. Motivo: {order.deleteReason}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Produtos">
            <ul className="divide-y divide-slate-100">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="flex items-center gap-3">
                    {i.colorHex && <span className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-black/10" style={{ background: i.colorHex }} />}
                    <span>
                      <span className="block font-semibold text-slate-900">{i.productNameSnapshot}</span>
                      <span className="text-xs text-slate-500">
                        {i.sku} · {i.colorName ?? "—"} · {i.quantity} × {formatBRL(i.unitPriceCents)} {i.kind !== "PRODUCT" && <Badge tone="blue">{i.kind === "ORDER_BUMP" ? "Order bump" : "Upsell"}</Badge>}
                      </span>
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatBRL(i.totalPriceCents)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 border-t border-slate-100 pt-2">
              <Row label="Subtotal" value={formatBRL(order.subtotalCents)} />
              <Row label="Desconto" value={formatBRL(order.discountCents)} />
              <Row label="Frete" value={order.shippingCents ? formatBRL(order.shippingCents) : "Grátis"} />
              <Row label="Total" value={<span className="text-base">{formatBRL(order.totalCents)}</span>} />
            </dl>
          </Card>

          <Card title="Pagamento">
            <dl>
              <Row label="Método" value={`${order.paymentMethod} · ${order.paymentProvider}`} />
              <Row label="Transaction ID" value={<span className="font-mono text-xs">{order.bravopayTransactionId ?? "—"}</span>} />
              <Row label="External reference" value={<span className="font-mono text-xs">{order.externalReference}</span>} />
              <Row label="Status do pagamento" value={order.paymentStatus} />
              <Row label="Criado em" value={formatDate(order.createdAt, true)} />
              <Row label="Pago em" value={order.paidAt ? formatDate(order.paidAt, true) : "—"} />
              <Row label="PIX expira em" value={order.pixExpiresAt ? formatDate(order.pixExpiresAt, true) : "—"} />
              <Row label="Taxa" value={order.feeCents != null ? formatBRL(order.feeCents) : "—"} />
              <Row label="Valor líquido" value={order.netCents != null ? formatBRL(order.netCents) : "—"} />
              <Row label="Última consulta" value={order.lastCheckedAt ? formatDate(order.lastCheckedAt, true) : "—"} />
              {order.paymentError && <Row label="Último erro" value={<span className="text-red-600">{order.paymentError}</span>} />}
            </dl>
            <div className="mt-4">
              <ActionForm action={reverifyPaymentAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <SubmitButton className={btnSecondary} pendingText="Consultando…">Consultar status na BravoPay</SubmitButton>
              </ActionForm>
            </div>
          </Card>

          <Card title="Origem e atribuição">
            <div className="grid gap-x-8 md:grid-cols-2">
              <dl>
                <Row label="Canal" value={CHANNEL_LABEL[(order.channel ?? "direto") as keyof typeof CHANNEL_LABEL] ?? order.channel} />
                <Row label="utm_source" value={order.utmSource} />
                <Row label="utm_medium" value={order.utmMedium} />
                <Row label="utm_campaign" value={order.utmCampaign} />
                <Row label="utm_content" value={order.utmContent} />
                <Row label="utm_term" value={order.utmTerm} />
              </dl>
              <dl>
                <Row label="First touch" value={[order.firstTouchSource, order.firstTouchMedium, order.firstTouchCampaign].filter(Boolean).join(" / ") || "—"} />
                <Row label="Last touch" value={[order.lastTouchSource, order.lastTouchMedium, order.lastTouchCampaign].filter(Boolean).join(" / ") || "—"} />
                <Row label="fbclid" value={order.fbclid ? <span className="font-mono text-xs">{order.fbclid.slice(0, 24)}…</span> : "—"} />
                <Row label="gclid" value={order.gclid ? <span className="font-mono text-xs">{order.gclid.slice(0, 24)}…</span> : "—"} />
                <Row label="ttclid" value={order.ttclid ? <span className="font-mono text-xs">{order.ttclid.slice(0, 24)}…</span> : "—"} />
                <Row label="Landing page" value={<span className="text-xs">{order.landingPage}</span>} />
                <Row label="Referrer" value={<span className="text-xs">{order.referrer}</span>} />
              </dl>
            </div>
          </Card>

          <Card title="Histórico de eventos">
            {order.paymentEvents.length === 0 ? (
              <p className="text-sm text-slate-400">Sem eventos.</p>
            ) : (
              <ol className="space-y-3">
                {order.paymentEvents.map((e) => (
                  <li key={e.id} className="flex gap-3 text-sm">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.status === "ERROR" || e.status === "WARNING" ? "bg-red-500" : e.type === "status_change" ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <div className="min-w-0">
                      <p className="text-slate-900">{e.message}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(e.createdAt, true)} · {e.type}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Cliente">
            <dl>
              <Row label="Nome" value={order.customer.name} />
              <Row label="CPF" value={formatCpf(order.customer.cpf)} />
              <Row label="E-mail" value={order.customer.email} />
              <Row label="Telefone" value={formatPhone(order.customer.phone)} />
            </dl>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {a.street}, {a.number}
              {a.complement ? ` — ${a.complement}` : ""}
              <br />
              {a.district} · {a.city}/{a.state} · CEP {formatCep(a.cep)}
            </p>
            {order.parentOrder && (
              <p className="mt-3 text-sm">Upsell do pedido <Link className="underline" href={`/admin/pedidos/${order.parentOrder.id}`}>{order.parentOrder.orderNumber}</Link></p>
            )}
            {order.upsellOrders.map((u) => (
              <p key={u.id} className="mt-2 text-sm">Upsell: <Link className="underline" href={`/admin/pedidos/${u.id}`}>{u.orderNumber}</Link> ({ORDER_STATUS_LABEL[u.status]})</p>
            ))}
          </Card>

          <Card title="Envio">
            <ActionForm action={updateFulfillmentAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <div>
                <label className={labelCls}>Etapa</label>
                <select name="fulfillmentStatus" defaultValue={order.fulfillmentStatus} className={inputCls}>
                  {Object.entries(FULFILLMENT_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Código de rastreio</label>
                <input name="trackingCode" defaultValue={order.trackingCode ?? ""} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Observações internas</label>
                <textarea name="notes" defaultValue={order.notes ?? ""} rows={2} className={textareaCls} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="notify" /> Notificar cliente por e-mail
              </label>
              <SubmitButton>Salvar envio</SubmitButton>
            </ActionForm>
          </Card>

          <Card title="E-mails">
            <ConfirmAction action={resendEmailAction} label="Reenviar e-mail" confirmLabel="Enviar agora" description={`Destinatário: ${order.customer.email}. Envios repetidos do mesmo tipo são bloqueados por 5 minutos.`} hidden={{ orderId: order.id }}>
              <div>
                <label className={labelCls}>Tipo</label>
                <select name="type" className={inputCls} defaultValue={order.status === "PAID" ? "PURCHASE_CONFIRMATION" : "PIX_RECOVERY"}>
                  <option value="PURCHASE_CONFIRMATION">Confirmação de compra</option>
                  <option value="PIX_RECOVERY">Recuperação de checkout</option>
                  <option value="ORDER_STATUS">Atualização do pedido</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Motivo (opcional)</label>
                <input name="reason" className={inputCls} maxLength={300} />
              </div>
            </ConfirmAction>
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {order.emailEvents.length === 0 && <li className="py-2 text-slate-400">Nenhum e-mail.</li>}
              {order.emailEvents.map((e) => (
                <li key={e.id} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{EMAIL_TYPE_LABEL[e.type]}</span>
                    <Badge tone={e.status === "SENT" ? "green" : e.status === "FAILED" ? "red" : e.status === "SCHEDULED" ? "amber" : "slate"}>{EMAIL_STATUS_LABEL[e.status]}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    {e.status === "SCHEDULED" ? `Agendado para ${formatDate(e.scheduledFor, true)}` : e.sentAt ? `Enviado ${formatDate(e.sentAt, true)}` : formatDate(e.updatedAt, true)}
                    {" · "}
                    {e.triggeredBy?.startsWith("admin:") ? "manual" : "automático"}
                    {e.reason ? ` · ${e.reason}` : ""}
                    {e.error ? ` · ${e.error}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Zona de risco">
            {order.deletedAt ? (
              <ActionForm action={restoreOrderAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <SubmitButton className={btnSecondary}>Restaurar pedido</SubmitButton>
              </ActionForm>
            ) : (
              <ConfirmAction
                action={deleteOrderAction}
                label="Excluir pedido"
                confirmLabel="Excluir"
                danger
                description="A exclusão é lógica (soft delete): o pedido sai das listas e relatórios, mas pode ser restaurado. E-mails agendados são cancelados."
                hidden={{ orderId: order.id }}
              >
                <div>
                  <label className={labelCls}>Motivo *</label>
                  <input name="reason" required className={inputCls} maxLength={300} />
                </div>
                {order.status === "PAID" && (
                  <div>
                    <label className={labelCls}>Pedido PAGO — digite {order.orderNumber} para confirmar</label>
                    <input name="confirmText" required className={inputCls} autoComplete="off" />
                  </div>
                )}
              </ConfirmAction>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
