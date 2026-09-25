"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CatalogColor, CatalogProduct } from "@/types/catalog";
import { imagesForColor, kitCounts } from "./ProductVisual";
import { TowelStack, piecesForKit } from "./TowelStack";
import { shade } from "@/utils/color";

type Slide = { key: string; alt: string; render: (priority: boolean) => React.ReactNode };

function SizesDiagram({ product, hex }: { product: CatalogProduct; hex: string }) {
  const parse = (d?: string) => {
    const m = d?.match(/(\d+)\s*[×x]\s*(\d+)/);
    return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
  };
  const seen = new Set<string>();
  const pieces = product.pieces.filter((p) => (seen.has(p.type) ? false : (seen.add(p.type), true)));
  const scale = 1.35;
  let x = 20;
  return (
    <svg viewBox="0 0 420 300" className="h-full w-full" role="img" aria-label="Medidas das peças">
      {pieces.map((p) => {
        const d = parse(p.dimensions);
        if (!d) return null;
        const w = d.w * scale;
        const h = Math.min(d.h * scale, 210);
        const el = (
          <g key={p.type}>
            <rect x={x} y={250 - h} width={w} height={h} rx={6} fill={hex} stroke={shade(hex, -0.25)} strokeWidth="1" />
            <rect x={x} y={250 - h + h * 0.8} width={w} height={h * 0.06} fill={shade(hex, -0.1)} />
            <text x={x + w / 2} y={270} textAnchor="middle" fontSize="11" fill="#2E2B28" fontFamily="sans-serif">
              {p.label.replace("Toalha de ", "")}
            </text>
            <text x={x + w / 2} y={285} textAnchor="middle" fontSize="10" fill="#6F6152" fontFamily="sans-serif">
              {p.dimensions}
            </text>
          </g>
        );
        x += w + 22;
        return el;
      })}
    </svg>
  );
}

export function Gallery({ product, color }: { product: CatalogProduct; color: CatalogColor | undefined }) {
  const hex = color?.hex ?? "#EEE7DA";
  const photos = imagesForColor(product, color?.id);
  const slides: Slide[] = photos.length
    ? photos.map((img, i) => ({
        key: img.url + i,
        alt: img.alt,
        render: (priority) => <Image src={img.url} alt={img.alt} fill sizes="(max-width: 768px) 100vw, 55vw" priority={priority} className="object-cover" />,
      }))
    : [
        {
          key: "stack",
          alt: `${product.commercialName} em ${color?.name}`,
          render: () => (
            <div className="flex h-full w-full items-end justify-center bg-gradient-to-b from-cream to-linen/70 pb-[4%]">
              <TowelStack colors={hex} pieces={piecesForKit(kitCounts(product))} className="h-[86%] w-[86%]" label={`${product.commercialName} na cor ${color?.name}`} />
            </div>
          ),
        },
        {
          key: "texture",
          alt: "Textura da felpa",
          render: () => (
            <div
              className="h-full w-full"
              style={{
                backgroundColor: hex,
                backgroundImage: `radial-gradient(circle at 30% 30%, rgba(255,255,255,.45) 0 1.6px, transparent 2.4px), radial-gradient(circle at 70% 70%, rgba(0,0,0,.12) 0 1.8px, transparent 2.6px)`,
                backgroundSize: "9px 9px, 9px 9px",
              }}
            >
              <span className="absolute bottom-5 left-5 rounded-sm bg-ivory/95 px-3 py-1.5 font-serif text-[12px] tracking-[0.35em] text-ink">MONTEZ</span>
            </div>
          ),
        },
        {
          key: "sizes",
          alt: "Medidas",
          render: () => (
            <div className="flex h-full w-full items-center justify-center bg-ivory p-6">
              <SizesDiagram product={product} hex={hex} />
            </div>
          ),
        },
      ];

  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
    track.current?.scrollTo({ left: 0 });
  }, [color?.id]);

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="md:sticky md:top-24">
      <div className="relative overflow-hidden rounded-[24px] bg-cream">
        <div
          ref={track}
          className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
          onScroll={(e) => {
            const el = e.currentTarget;
            setActive(Math.round(el.scrollLeft / el.clientWidth));
          }}
          aria-roledescription="carrossel"
        >
          {slides.map((s, i) => (
            <div key={s.key} className="relative aspect-square w-full shrink-0 snap-center md:aspect-[5/5]" aria-label={`${i + 1} de ${slides.length}: ${s.alt}`}>
              {s.render(i === 0)}
            </div>
          ))}
        </div>
        {slides.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden">
            {slides.map((s, i) => (
              <button key={s.key} onClick={() => go(i)} aria-label={`Imagem ${i + 1}`} className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-ink" : "w-1.5 bg-ink/30"}`} />
            ))}
          </div>
        )}
      </div>
      {slides.length > 1 && (
        <div className="mt-3 hidden grid-cols-5 gap-3 md:grid">
          {slides.map((s, i) => (
            <button key={s.key} onClick={() => go(i)} className={`relative aspect-square overflow-hidden rounded-xl border-2 transition ${i === active ? "border-ink" : "border-transparent opacity-75 hover:opacity-100"}`} aria-label={`Ver ${s.alt}`}>
              <div className="pointer-events-none absolute inset-0 origin-top-left scale-100">{s.render(false)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
