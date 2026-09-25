"use client";

import Link from "next/link";
import { useCart } from "@/components/providers/CartProvider";
import { ProductVisual } from "@/components/product/ProductVisual";
import { IconMinus, IconPlus, IconTrash } from "@/components/icons";
import { formatBRL } from "@/utils/format";

export function QtyStepper({ value, onChange, small }: { value: number; onChange: (v: number) => void; small?: boolean }) {
  const h = small ? "h-9" : "h-12";
  return (
    <div className={`inline-flex ${h} items-center rounded-full border border-line bg-white`}>
      <button type="button" className={`${h} w-9 rounded-l-full text-graphite hover:bg-cream disabled:opacity-40`} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Diminuir quantidade">
        <IconMinus size={16} className="mx-auto" />
      </button>
      <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className={`${h} w-9 rounded-r-full text-graphite hover:bg-cream disabled:opacity-40`} onClick={() => onChange(value + 1)} disabled={value >= 10} aria-label="Aumentar quantidade">
        <IconPlus size={16} className="mx-auto" />
      </button>
    </div>
  );
}

export function CartLines({ compact = false }: { compact?: boolean }) {
  const { items, setQuantity, remove } = useCart();
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={`${item.productId}-${item.colorId}`} className="flex gap-4 py-4">
          <Link href={`/produto/${item.product.slug}?cor=${item.color.slug}`} className="shrink-0">
            <ProductVisual product={item.product} color={item.color} className={`${compact ? "h-20 w-20" : "h-24 w-24 md:h-28 md:w-28"} rounded-xl`} sizes="112px" />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-serif text-[18px] leading-tight text-ink">{item.product.commercialName}</p>
                <p className="mt-0.5 text-[12px] text-taupe-dark">
                  {item.product.name} · {item.product.pieceCount} peças
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[12px] text-graphite/80">
                  <span className="inline-block h-3 w-3 rounded-full border border-black/10" style={{ background: item.color.hex }} />
                  {item.color.name}
                </p>
              </div>
              <button className="-mr-1 p-1.5 text-taupe hover:text-ink" onClick={() => remove(item.productId, item.colorId)} aria-label={`Remover ${item.product.commercialName}`}>
                <IconTrash size={17} />
              </button>
            </div>
            <div className="mt-auto flex items-end justify-between pt-2">
              <QtyStepper small value={item.quantity} onChange={(v) => setQuantity(item.productId, item.colorId, v)} />
              <div className="text-right">
                {item.quantity > 1 && <p className="text-[11px] text-taupe">{formatBRL(item.product.priceCents)} cada</p>}
                <p className="font-semibold tabular-nums text-ink">{formatBRL(item.lineTotalCents)}</p>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** "Complete seu conjunto": sugere o próximo kit na mesma cor, sem desconto artificial. */
export function CrossSell() {
  const { items, catalog, add } = useCart();
  if (!items.length) return null;
  const inCart = new Set(items.map((i) => i.productId));
  const reference = items[0];
  const suggestion = catalog.filter((p) => p.kind === "KIT" && !inCart.has(p.id) && p.variants.some((v) => v.colorId === reference.colorId)).sort((a, b) => b.pieceCount - a.pieceCount)[0];
  if (!suggestion) return null;
  return (
    <div className="rounded-2xl border border-line bg-cream/60 p-4">
      <p className="eyebrow mb-3">Complete seu conjunto</p>
      <div className="flex items-center gap-3">
        <ProductVisual product={suggestion} color={reference.color} className="h-16 w-16 shrink-0 rounded-lg" sizes="64px" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-[17px] text-ink">{suggestion.commercialName}</p>
          <p className="text-[12px] text-taupe-dark">
            {suggestion.subtitle} · {reference.color.name}
          </p>
          <p className="text-sm font-semibold">{formatBRL(suggestion.priceCents)}</p>
        </div>
        <button className="rounded-full border border-ink px-4 py-2 text-[11px] font-bold uppercase tracking-wider hover:bg-ink hover:text-ivory" onClick={() => add(suggestion.id, reference.colorId, 1, { openDrawer: false })}>
          Adicionar
        </button>
      </div>
    </div>
  );
}
