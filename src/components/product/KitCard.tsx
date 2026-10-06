"use client";

import Link from "next/link";
import { useCart } from "@/components/providers/CartProvider";
import { ProductVisual, kitCounts } from "./ProductVisual";
import type { CatalogProduct } from "@/types/catalog";
import { formatBRL } from "@/utils/format";

export function KitCard({ product, priority, defaultColorSlug }: { product: CatalogProduct; priority?: boolean; defaultColorSlug?: string }) {
  const { colors, selectedColorId, selectColor } = useCart();
  const available = colors.filter((c) => product.variants.some((v) => v.colorId === c.id));
  const color = available.find((c) => c.id === selectedColorId) ?? available.find((c) => c.slug === defaultColorSlug) ?? available[0];
  const counts = kitCounts(product);
  const highlight = product.featured;
  const href = `/produto/${product.slug}${color ? `?cor=${color.slug}` : ""}`;

  return (
    <article
      className={`group relative flex flex-col rounded-[22px] border bg-white/80 transition duration-300 hover:-translate-y-0.5 hover:shadow-lift ${
        highlight ? "border-ink/80 shadow-lift md:-my-3" : "border-line shadow-card"
      }`}
    >
      {product.badge && (
        <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-olive px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ivory">
          {product.badge}
        </span>
      )}
      <Link href={href} className="block px-5 pt-7 text-center" aria-label={`${product.commercialName} — ver detalhes`}>
        <p className="eyebrow">{product.name}</p>
        <h3 className="mt-1.5 font-serif text-[27px] leading-tight text-ink">{product.commercialName}</h3>
        <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-taupe">{product.pieceCount} peças</p>
        {product.tagline && <p className="mt-2 font-serif text-[16px] italic text-graphite/80">{product.tagline}</p>}
        <ProductVisual product={product} color={color} className="mx-auto mt-4 aspect-[5/4] w-full rounded-2xl" priority={priority} />
      </Link>

      <div className="flex flex-1 flex-col px-5 pb-6 pt-4">
        <ul className="grid grid-cols-3 gap-2 text-center" aria-label="Composição do kit">
          {(["banho", "rosto", "piso"] as const).map((k) => (
            <li key={k} className={`rounded-xl border py-2 ${counts[k] ? "border-line bg-cream/60" : "border-dashed border-line/80 opacity-45"}`}>
              <span className="block font-serif text-[22px] leading-none text-ink">{counts[k]}</span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-taupe-dark">{k}</span>
            </li>
          ))}
        </ul>

        {available.length > 0 && (
          <div className="mt-4 flex items-center justify-center gap-1.5" role="radiogroup" aria-label="Cor">
            {available.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={c.id === color?.id}
                aria-label={c.name}
                title={c.name}
                onClick={() => selectColor(c.id, "kit_card")}
                className={`h-5 w-5 rounded-full border transition ${c.id === color?.id ? "scale-110 border-ink ring-2 ring-ink/15 ring-offset-2 ring-offset-white" : "border-black/10 hover:scale-110"}`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
        )}
        {color && <p className="mt-2 text-center text-[12px] text-taupe-dark">Cor: {color.name}</p>}

        <div className="mt-auto pt-5 text-center">
          <p className="font-serif text-[34px] leading-none text-ink">
            <span className="mr-1 align-top font-sans text-sm font-semibold">R$</span>
            {formatBRL(product.priceCents).replace("R$", "").trim()}
          </p>
          <p className="mt-1 text-[12px] text-taupe-dark">à vista no PIX</p>
          <Link href={href} className={`${highlight ? "btn-olive" : "btn-primary"} mt-5 w-full`} data-cta={`kit_card_${product.slug}`}>
            Quero este kit
          </Link>
        </div>
      </div>
    </article>
  );
}
