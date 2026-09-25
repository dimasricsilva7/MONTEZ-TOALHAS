import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findOrderByAccess } from "@/server/orders";
import { customerStatusLabel } from "@/utils/status";
import { formatBRL, formatDate } from "@/utils/format";
import { IconCheck } from "@/components/icons";

export const metadata: Metadata = { title: "Meu pedido", robots: { index: false } };
export const dynamic = "force-dynamic";

const STEPS = [
  { key: "PAID", label: "Pagamento confirmado" },
  { key: "PREPARING", label: "Em preparação" },
  { key: "SHIPPED", label: "Enviado" },
  { key: "DELIVERED", label: "Entregue" },
];

export default async function OrderPage({ searchParams }: { searchParams: Promise<{ pedido?: string; t?: string }> }) {
  const { pedido, t } = await searchParams;
  const order = await findOrderByAccess(pedido, t);
  if (!order) notFound();
  const q = `pedido=${encodeURIComponent(order.orderNumber!)}&t=${encodeURIComponent(order.accessToken)}`;
  const address = order.shippingAddress as { street: string; number: string; complement?: string; district: string; city: string; state: string };
  const reached = order.status !== "PAID" ? -1 : order.fulfillmentStatus === "DELIVERED" ? 3 : order.fulfillmentStatus === "SHIPPED" ? 2 : order.fulfillmentStatus === "PREPARING" ? 1 : 0;

  return (
    <div className="container max-w-3xl py-10 md:py-16">
      <p className="eyebrow">Pedido {order.orderNumber}</p>
      <h1 className="mt-2 font-serif text-[38px] leading-tight text-ink md:text-5xl">{customerStatusLabel(order.status, order.fulfillmentStatus)}</h1>
      <p className="mt-2 text-sm text-taupe-dark">Realizado em {formatDate(order.createdAt, true)}</p>

      {order.status === "PENDING_PAYMENT" && (
        <div className="mt-6 rounded-2xl border border-line bg-cream/70 p-5">
          <p className="text-[15px] text-ink">Este pedido está aguardando o pagamento via PIX.</p>
          <Link href={`/checkout/pendente?${q}`} className="btn-olive mt-4">Ir para o pagamento</Link>
        </div>
      )}

      {order.status === "PAID" && (
        <ol className="mt-8 grid grid-cols-4 gap-2">
          {STEPS.map((s, i) => (
            <li key={s.key} className="text-center">
              <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full ${i <= reached ? "bg-olive text-ivory" : "bg-linen text-taupe"}`}>
                {i <= reached ? <IconCheck size={16} /> : i + 1}
              </span>
              <span className={`mt-2 block text-[11px] leading-tight ${i <= reached ? "font-semibold text-ink" : "text-taupe-dark"}`}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}
      {order.trackingCode && (
        <p className="mt-6 rounded-xl bg-white p-4 text-[15px] shadow-card">
          Código de rastreio: <strong className="select-all">{order.trackingCode}</strong>
        </p>
      )}

      <section className="mt-8 rounded-3xl border border-line bg-white p-6 shadow-card">
        <ul className="divide-y divide-line">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-3 text-[14px]">
              <span>
                <span className="font-medium text-ink">{i.productNameSnapshot}</span>
                <span className="block text-[12px] text-taupe-dark">{i.colorName && `Cor: ${i.colorName} · `}Qtd.: {i.quantity}</span>
              </span>
              <span className="font-semibold tabular-nums">{formatBRL(i.totalPriceCents)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 space-y-1 border-t border-line pt-3 text-[14px]">
          <p className="flex justify-between"><span className="text-graphite/75">Frete</span><span>{order.shippingCents ? formatBRL(order.shippingCents) : "Grátis"}</span></p>
          <p className="flex justify-between text-lg font-semibold text-ink"><span>Total</span><span>{formatBRL(order.totalCents)}</span></p>
        </div>
        <p className="mt-5 text-[13px] leading-5 text-taupe-dark">
          Entrega: {address.street}, {address.number}{address.complement ? ` — ${address.complement}` : ""} · {address.district} · {address.city}/{address.state}
        </p>
      </section>
      <p className="mt-8 text-sm text-graphite/75">
        Precisa de ajuda? <Link href="/contato" className="font-semibold underline underline-offset-4">Fale com a gente</Link> informando o número do pedido.
      </p>
    </div>
  );
}
