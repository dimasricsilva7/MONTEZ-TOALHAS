"use client";

import Link from "next/link";
import { useCart } from "@/components/providers/CartProvider";
import { ProductVisual } from "@/components/product/ProductVisual";
import { IconArrow } from "@/components/icons";
import { Reveal } from "@/components/ui/Reveal";

export function ColorsSection({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors, catalog, selectedColorId, selectColor } = useCart();
  const hero = catalog.find((p) => p.featured) ?? catalog[0];
  if (!colors.length || !hero) return null;
  const color = colors.find((c) => c.id === selectedColorId) ?? colors.find((c) => c.slug === "areia") ?? colors[0];

  return (
    <section className="section overflow-hidden" aria-labelledby="colors-title">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">A coleção</p>
          <h2 id="colors-title" className="section-title mt-3 text-balance">{title}</h2>
          <p className="mt-4 text-[15px] leading-7 text-graphite/75">{subtitle}</p>
        </Reveal>

        <div className="mt-12 grid items-center gap-10 md:grid-cols-[1.1fr_1fr] md:gap-16">
          <Reveal>
            <ProductVisual key={color.id} product={hero} color={color} className="aspect-[5/4] w-full rounded-[28px] animate-fade-in" sizes="(max-width: 768px) 100vw, 55vw" />
          </Reveal>
          <Reveal delay={100}>
            <p className="eyebrow">Cor selecionada</p>
            <p className="mt-2 font-serif text-[40px] leading-none text-ink">{color.name}</p>
            <div className="mt-8 grid grid-cols-5 gap-x-3 gap-y-5" role="radiogroup" aria-label="Cores da coleção">
              {colors.map((c) => {
                const active = c.id === color.id;
                return (
                  <button key={c.id} role="radio" aria-checked={active} onClick={() => selectColor(c.id, "home_colors")} className="group flex flex-col items-center gap-2 text-center">
                    <span
                      className={`block aspect-square w-full max-w-[56px] rounded-full border shadow-inner transition duration-200 ${active ? "scale-105 border-ink ring-2 ring-ink/20 ring-offset-4 ring-offset-ivory" : "border-black/10 group-hover:scale-105"}`}
                      style={{ background: c.swatchUrl ? `center/cover url("${c.swatchUrl}")` : `radial-gradient(circle at 35% 30%, rgba(255,255,255,.35), transparent 55%), ${c.hex}` }}
                    />
                    <span className={`text-[11px] leading-tight ${active ? "font-semibold text-ink" : "text-graphite/70"}`}>{c.name}</span>
                  </button>
                );
              })}
            </div>
            <Link href={`/produto/${hero.slug}?cor=${color.slug}`} className="btn-primary mt-10 w-full sm:w-auto" data-cta="colors_section">
              Ver {hero.commercialName} em {color.name} <IconArrow size={18} />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
