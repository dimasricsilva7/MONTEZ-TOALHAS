"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PublicOrder } from "@/types/order";
import { IconArrow, IconCheck } from "@/components/icons";
import { formatBRL, formatDate } from "@/utils/format";
import { gaEvent, metaEvent, track } from "@/lib/client/tracking";
import { customerStatusLabel } from "@/utils/status";

type Upsell = { id: string; headline: string; title: string; description: string | null; priceCents: number; imageUrl: string | null };

export function SuccessClient({ order, query, title, text, upsell, destination }: { order: PublicOrder; query: string; title: string; text: string; upsell: Upsell | null; destination: string | null }) {
  const router = useRouter();
  const [offer, setOffer] = useState(upsell);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Purchase no Pixel: somente com pedido PAGO, uma vez por pedido, com o mesmo event_id da CAPI.
  useEffect(() => {
    if (order.status !== "PAID" || !order.metaEventId) return;
    const key = `mz_purchase_${order.orderNumber}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* segue */
    }
    const products = order.items.filter((i) => i.kind !== "ORDER_BUMP");
    metaEvent(
      "Purchase",
      {
        currency: "BRL",
        value: order.totalCents / 100,
        content_type: "product",
        content_ids: products.map((i) => i.sku),
        contents: order.items.map((i) => ({ id: i.sku, quantity: i.quantity, item_price: i.unitPriceCents / 100 })),
        num_items: order.items.reduce((s, i) => s + i.quantity, 0),
      },
      { eventId: order.metaEventId }
    );
    gaEvent("purchase", { transaction_id: order.orderNumber, currency: "BRL", value: order.totalCents / 100, items: order.items.map((i) => ({ item_id: i.sku, item_name: i.name, quantity: i.quantity, price: i.unitPriceCents / 100 })) });
  }, [order]);

  useEffect(() => {
    if (offer) track("upsell_view", { valueCents: offer.priceCents, props: { upsellId: offer.id } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const respond = async (action: "accept" | "decline") => {
    if (!offer) return;
    setBusy(true);
    setError(null);
    const params = new URLSearchParams(query);
    const res = await fetch("/api/upsell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido: params.get("pedido"), t: params.get("t"), upsellId: offer.id, action }),
    }).catch(() => null);
    setBusy(false);
    if (action === "decline") {
      setOffer(null);
      return;
    }
    const data = (await res?.json().catch(() => ({}))) as { orderNumber?: string; token?: string; error?: string };
    if (!res?.ok || !data.orderNumber) {
      setError(data?.error ?? "Não foi possível gerar seu PIX. Tente novamente.");
      return;
    }
    router.push(`/checkout/pendente?pedido=${encodeURIComponent(data.orderNumber)}&t=${encodeURIComponent(data.token!)}`);
  };

  return (
    <div className="container max-w-3xl py-10 md:py-16">
      <div className="text-center animate-fade-up">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-olive text-ivory">
          <IconCheck size={30} />
        </span>
        <h1 className="mt-6 font-serif text-[40px] leading-tight text-ink md:text-[52px]">{title}</h1>
        <p className="mt-2 text-[16px] text-graphite/80">
          {text} {order.customerFirstName && <>Até breve, {order.customerFirstName}.</>}
        </p>
      </div>

      <section className="mt-10 rounded-3xl border border-line bg-white p-6 shadow-card md:p-8">
        <div className="grid gap-4 text-[14px] sm:grid-cols-3">
          <div>
            <p className="label">Pedido</p>
            <p className="font-semibold text-ink">{order.orderNumber}</p>
          </div>
          <div>
            <p className="label">Status</p>
            <p className="font-semibold text-olive">{customerStatusLabel(order.status, order.fulfillmentStatus)}</p>
          </div>
          <div>
            <p className="label">Pago em</p>
            <p className="font-semibold text-ink">{order.paidAt ? formatDate(order.paidAt, true) : "—"}</p>
          </div>
        </div>
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex items-center justify-between gap-3 py-3 text-[14px]">
              <span className="flex items-center gap-3">
                {i.colorHex && <span className="h-8 w-8 shrink-0 rounded-full border border-black/10" style={{ background: i.colorHex }} />}
                <span>
                  <span className="font-medium text-ink">{i.name}</span>
                  <span className="block text-[12px] text-taupe-dark">
                    {i.colorName && `Cor: ${i.colorName} · `}Qtd.: {i.quantity}
                  </span>
                </span>
              </span>
              <span className="font-semibold tabular-nums">{formatBRL(i.totalPriceCents)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-line pt-4 text-lg font-semibold text-ink">
          <span>Total pago</span>
          <span>{formatBRL(order.totalCents)}</span>
        </p>
        <div className="mt-6 rounded-xl bg-cream/70 p-4 text-[14px] text-graphite/85">
          <p className="font-semibold text-ink">Próxima etapa: preparação do pedido</p>
          <p className="mt-1">
            Você receberá a confirmação por e-mail e, quando o pedido for despachado{destination ? ` para ${destination}` : ""}, o código de rastreio.
          </p>
        </div>
        <Link href={`/pedido-confirmado?${query}`} className="mt-5 inline-flex text-sm font-semibold text-ink underline underline-offset-4">
          Acompanhar pedido
        </Link>
      </section>

      {offer && (
        <section className="mt-8 overflow-hidden rounded-3xl border border-olive/30 bg-olive-light/40 p-6 md:p-8" aria-label="Oferta opcional">
          <p className="eyebrow !text-olive">Oferta opcional</p>
          <h2 className="mt-2 font-serif text-[28px] leading-tight text-ink md:text-[34px]">{offer.headline}</h2>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
            {offer.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={offer.imageUrl} alt="" className="h-28 w-28 rounded-2xl object-cover" />
            )}
            <div className="flex-1">
              <p className="text-[17px] font-semibold text-ink">{offer.title}</p>
              {offer.description && <p className="mt-1 text-[14px] leading-6 text-graphite/80">{offer.description}</p>}
              <p className="mt-2 font-serif text-[28px] text-ink">{formatBRL(offer.priceCents)}</p>
            </div>
          </div>
          {error && <p className="mt-4 text-[14px] text-red-700">{error}</p>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button className="btn-olive flex-1" onClick={() => respond("accept")} disabled={busy}>
              {busy ? "Gerando PIX…" : "Quero adicionar"} <IconArrow size={18} />
            </button>
            <button className="btn-outline flex-1" onClick={() => respond("decline")} disabled={busy}>
              Não, obrigado
            </button>
          </div>
          <p className="mt-3 text-[12px] text-taupe-dark">Seu pedido principal já está confirmado. Esta oferta gera um PIX separado e é totalmente opcional.</p>
        </section>
      )}
    </div>
  );
}
