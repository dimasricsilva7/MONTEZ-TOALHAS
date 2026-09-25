"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/providers/CartProvider";
import { Gallery } from "./Gallery";
import { QtyStepper } from "@/components/cart/CartContents";
import { IconArrow, IconPix, IconShield, IconTruck } from "@/components/icons";
import type { CatalogProduct } from "@/types/catalog";
import { formatBRL } from "@/utils/format";
import { gaEvent, metaEvent } from "@/lib/client/tracking";

export function ProductDetail({ product, shippingNote }: { product: CatalogProduct; shippingNote: string }) {
  const { colors, selectedColorId, selectColor, add } = useCart();
  const router = useRouter();
  const search = useSearchParams();
  const available = useMemo(() => colors.filter((c) => product.variants.some((v) => v.colorId === c.id)), [colors, product]);
  const fromUrl = available.find((c) => c.slug === search.get("cor"));
  const color = fromUrl ?? available.find((c) => c.id === selectedColorId) ?? available.find((c) => c.slug === "areia") ?? available[0];
  const variant = product.variants.find((v) => v.colorId === color?.id);
  const [qty, setQty] = useState(1);
  const [showSticky, setShowSticky] = useState(false);
  const buyRef = useRef<HTMLDivElement>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (fromUrl && fromUrl.id !== selectedColorId) selectColor(fromUrl.id, "url");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromUrl?.id]);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    const params = { currency: "BRL", value: product.priceCents / 100, content_type: "product", content_ids: [product.sku], content_name: product.commercialName };
    metaEvent("ViewContent", params, { mirror: true, internal: { name: "view_product", productId: product.id, valueCents: product.priceCents } });
    gaEvent("view_item", { currency: "BRL", value: product.priceCents / 100, items: [{ item_id: product.sku, item_name: product.commercialName }] });
  }, [product]);

  useEffect(() => {
    const el = buyRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const changeColor = (id: string) => {
    selectColor(id, "product_page");
    const slug = colors.find((c) => c.id === id)?.slug;
    if (slug) router.replace(`/produto/${product.slug}?cor=${slug}`, { scroll: false });
  };

  const buyNow = () => {
    if (!color) return;
    add(product.id, color.id, qty, { openDrawer: false });
    router.push("/checkout");
  };

  const unavailable = !variant?.available;

  return (
    <>
      <div className="container grid gap-8 pb-16 pt-4 md:grid-cols-[1.1fr_1fr] md:gap-14 md:pt-8 lg:gap-20">
        <Gallery product={product} color={color} />

        <div>
          {product.badge && <span className="mb-3 inline-block rounded-full bg-olive px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ivory">{product.badge}</span>}
          <p className="eyebrow">{product.name} · {product.pieceCount} peças</p>
          <h1 className="mt-2 font-serif text-[38px] leading-[1.05] text-ink md:text-[50px]">{product.commercialName}</h1>
          {product.subtitle && <p className="mt-2 text-[16px] text-taupe-dark">{product.subtitle}</p>}
          {product.shortDescription && <p className="mt-5 text-[15px] leading-7 text-graphite/80">{product.shortDescription}</p>}

          <div className="mt-6 flex items-baseline gap-3">
            <p className="font-serif text-[40px] leading-none text-ink">{formatBRL(product.priceCents)}</p>
            {product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents && (
              <p className="text-[15px] text-taupe line-through">{formatBRL(product.compareAtPriceCents)}</p>
            )}
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-olive">
            <IconPix size={15} /> Pagamento à vista via PIX
          </p>

          <div className="mt-8" ref={buyRef}>
            <div className="flex items-baseline justify-between">
              <p className="label !mb-0">Escolha a cor</p>
              <p className="text-[14px] font-semibold text-ink">{color?.name}</p>
            </div>
            <div className="mt-3 grid grid-cols-10 gap-2 sm:gap-3 md:grid-cols-5 lg:grid-cols-10" role="radiogroup" aria-label="Cor">
              {available.map((c) => {
                const active = c.id === color?.id;
                return (
                  <button
                    key={c.id}
                    role="radio"
                    aria-checked={active}
                    aria-label={c.name}
                    title={c.name}
                    onClick={() => changeColor(c.id)}
                    className={`aspect-square w-full rounded-full border transition ${active ? "border-ink ring-2 ring-ink/20 ring-offset-2 ring-offset-ivory" : "border-black/10 hover:scale-105"}`}
                    style={{ background: c.swatchUrl ? `center/cover url("${c.swatchUrl}")` : `radial-gradient(circle at 35% 30%, rgba(255,255,255,.35), transparent 55%), ${c.hex}` }}
                  />
                );
              })}
            </div>

            <div className="mt-7 flex gap-3">
              <QtyStepper value={qty} onChange={setQty} />
              <button className="btn-olive flex-1" onClick={buyNow} disabled={unavailable || !color} data-cta="product_buy_now">
                {unavailable ? "Indisponível nesta cor" : "Comprar agora"} {!unavailable && <IconArrow size={18} />}
              </button>
            </div>
            <button className="btn-outline mt-3 w-full" onClick={() => color && add(product.id, color.id, qty)} disabled={unavailable || !color} data-cta="product_add_to_cart">
              Adicionar ao carrinho
            </button>

            <ul className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] leading-4 text-graphite/75">
              <li className="flex flex-col items-center gap-1.5 rounded-xl bg-cream/70 px-2 py-3">
                <IconShield size={18} className="text-olive" /> Compra segura
              </li>
              <li className="flex flex-col items-center gap-1.5 rounded-xl bg-cream/70 px-2 py-3">
                <IconPix size={18} className="text-olive" /> Confirmação automática
              </li>
              <li className="flex flex-col items-center gap-1.5 rounded-xl bg-cream/70 px-2 py-3">
                <IconTruck size={18} className="text-olive" /> {shippingNote}
              </li>
            </ul>
          </div>

          <div className="mt-10">
            <p className="label">O que vem no kit</p>
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white/70">
              {product.pieces.map((p, i) => (
                <li key={i} className="flex items-center gap-4 px-4 py-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-serif text-lg text-ink" style={{ background: color?.hex ?? "#EEE7DA" }}>
                    <span className="rounded-full bg-ivory/85 px-1.5 text-[15px] leading-6">{p.quantity}</span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink">{p.label}</p>
                    <p className="text-[12.5px] text-taupe-dark">{[p.dimensions, p.weight, p.composition].filter(Boolean).join(" · ")}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {product.description && (
            <details className="group mt-8 border-t border-line" open>
              <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                Descrição <span className="text-taupe transition group-open:rotate-45">+</span>
              </summary>
              <div className="whitespace-pre-line pb-5 text-[15px] leading-7 text-graphite/80">{product.description}</div>
            </details>
          )}
          {product.specs.length > 0 && (
            <details className="group border-t border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                Especificações <span className="text-taupe transition group-open:rotate-45">+</span>
              </summary>
              <dl className="pb-5 text-[14px]">
                {product.specs.map((s, i) => (
                  <div key={i} className="flex justify-between gap-4 border-b border-line/60 py-2.5 last:border-0">
                    <dt className="text-taupe-dark">{s.label}</dt>
                    <dd className="text-right font-medium text-ink">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          <details className="group border-y border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
              Cuidados <span className="text-taupe transition group-open:rotate-45">+</span>
            </summary>
            <p className="pb-5 text-[15px] leading-7 text-graphite/80">
              Lave antes do primeiro uso, com água fria ou morna e sabão neutro. Evite alvejante com cloro e excesso de amaciante. Seque à sombra ou em secadora em temperatura baixa.{" "}
              <Link href="/cuidados" className="underline underline-offset-4">
                Guia completo
              </Link>
            </p>
          </details>
        </div>
      </div>

      {/* CTA fixo no mobile */}
      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ivory/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-300 md:hidden ${showSticky ? "translate-y-0" : "translate-y-full"}`}>
        <button className="btn-olive w-full" onClick={buyNow} disabled={unavailable || !color} data-cta="product_sticky_buy">
          Comprar agora — {formatBRL(product.priceCents * qty)}
        </button>
      </div>
    </>
  );
}
