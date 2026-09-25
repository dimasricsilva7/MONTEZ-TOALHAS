import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { KitCard } from "@/components/product/KitCard";
import { kitCounts } from "@/components/product/ProductVisual";
import { IconArrow, IconCheck, IconChat, IconLeaf, IconPalette, IconPix, IconShield, IconStar, IconThread, IconTruck, IconWeight } from "@/components/icons";
import type { CatalogProduct } from "@/types/catalog";
import { formatBRL } from "@/utils/format";

type C = Record<string, string>;

/** Cores de vitrine enquanto o cliente ainda não escolheu uma cor. */
export const DEFAULT_CARD_COLORS = ["areia", "caqui", "verde-oliva"];

export function Benefits({ c }: { c: C }) {
  const items = [
    { icon: IconWeight, title: c.benefit_1_title, text: c.benefit_1_text },
    { icon: IconLeaf, title: c.benefit_2_title, text: c.benefit_2_text },
    { icon: IconThread, title: c.benefit_3_title, text: c.benefit_3_text },
    { icon: IconPalette, title: c.benefit_4_title, text: c.benefit_4_text },
  ];
  return (
    <section className="border-y border-line bg-ivory" aria-label="Benefícios">
      <div className="container grid grid-cols-2 gap-x-4 gap-y-7 py-9 md:grid-cols-4 md:py-11">
        {items.map((it, i) => (
          <Reveal key={i} delay={i * 80} className="flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-white text-olive">
              <it.icon size={21} />
            </span>
            <div>
              <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-ink">{it.title}</p>
              <p className="mt-0.5 text-[13px] leading-5 text-graphite/70">{it.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function KitsSection({ c, products }: { c: C; products: CatalogProduct[] }) {
  const kits = products.filter((p) => p.kind === "KIT").sort((a, b) => a.pieceCount - b.pieceCount);
  if (!kits.length) return null;
  return (
    <section id="kits" className="section scroll-mt-20" aria-labelledby="kits-title">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Linha Hotel 600</p>
          <h2 id="kits-title" className="section-title mt-3 text-balance">{c.kits_title}</h2>
          <p className="mt-4 text-[15px] leading-7 text-graphite/75">{c.kits_subtitle}</p>
        </Reveal>
        <div className="mt-14 grid gap-8 md:grid-cols-3 md:gap-5 lg:gap-7">
          {kits.map((p, i) => (
            <Reveal key={p.id} delay={i * 90} className={p.featured ? "order-first md:order-none" : ""}>
              <KitCard product={p} priority={i === 0} defaultColorSlug={DEFAULT_CARD_COLORS[i % DEFAULT_CARD_COLORS.length]} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function TerryTexture({ tone = "#DBC9AC" }: { tone?: string }) {
  // Macro de felpa gerada por CSS quando não há fotografia cadastrada
  return (
    <div
      className="h-full w-full"
      style={{
        backgroundColor: tone,
        backgroundImage: `radial-gradient(circle at 30% 30%, rgba(255,255,255,.55) 0 1.6px, transparent 2.4px), radial-gradient(circle at 70% 70%, rgba(0,0,0,.10) 0 1.8px, transparent 2.6px), radial-gradient(circle at 70% 25%, rgba(255,255,255,.3) 0 1.2px, transparent 2px)`,
        backgroundSize: "9px 9px, 9px 9px, 13px 13px",
      }}
    />
  );
}

export function Experience({ c }: { c: C }) {
  const points = [c.experience_point_1, c.experience_point_2, c.experience_point_3, c.experience_point_4].filter(Boolean);
  return (
    <section id="qualidade" className="section scroll-mt-20 bg-cream" aria-labelledby="exp-title">
      <div className="container grid items-center gap-10 md:grid-cols-2 md:gap-16">
        <Reveal className="relative aspect-[4/5] overflow-hidden rounded-[28px] md:aspect-square">
          {c.experience_image ? (
            <Image src={c.experience_image} alt="Detalhe da felpa de uma toalha MONTEZ" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          ) : (
            <TerryTexture />
          )}
          <span className="absolute bottom-5 left-5 rounded-sm bg-ivory/95 px-3 py-1.5 font-serif text-[13px] tracking-[0.35em] text-ink shadow-card">MONTEZ</span>
        </Reveal>
        <Reveal delay={120}>
          <p className="eyebrow">Qualidade que se sente</p>
          <h2 id="exp-title" className="section-title mt-3 text-balance">{c.experience_title}</h2>
          <p className="mt-5 text-[15px] leading-7 text-graphite/80">{c.experience_text}</p>
          <ul className="mt-8 space-y-4">
            {points.map((p, i) => {
              const [head, ...rest] = p.split("—");
              return (
                <li key={i} className="flex gap-4 border-b border-line pb-4 last:border-0">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-olive text-ivory">
                    <IconCheck size={14} />
                  </span>
                  <p className="text-[15px] leading-6">
                    <strong className="font-semibold text-ink">{head.trim()}</strong>
                    {rest.length > 0 && <span className="text-graphite/75"> — {rest.join("—").trim()}</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export function HotelSection({ c }: { c: C }) {
  return (
    <section className="relative isolate overflow-hidden bg-graphite text-ivory" aria-labelledby="hotel-title">
      {c.hotel_image ? (
        <Image src={c.hotel_image} alt="Banheiro com toalhas MONTEZ" fill sizes="100vw" className="-z-10 object-cover opacity-60" />
      ) : (
        <div className="absolute inset-0 -z-10 opacity-[0.35]" aria-hidden="true">
          <div className="absolute -right-24 top-10 h-[520px] w-[380px] rounded-t-full border border-ivory/20" />
          <div className="absolute -right-8 top-24 h-[480px] w-[340px] rounded-t-full bg-gradient-to-b from-taupe/40 to-transparent" />
        </div>
      )}
      <div className="container py-24 md:py-36">
        <Reveal className="max-w-xl">
          <p className="eyebrow !text-sand">Hotel em casa</p>
          <h2 id="hotel-title" className="mt-4 font-serif text-[36px] leading-[1.05] md:text-[54px]">{c.hotel_title}</h2>
          <p className="mt-5 text-[16px] leading-7 text-ivory/80">{c.hotel_text}</p>
          <Link href={c.hotel_cta_href || "/sobre"} className="btn-light mt-9" data-cta="hotel_section">
            {c.hotel_cta} <IconArrow size={18} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

export function Compare({ c }: { c: C }) {
  const items = (c.compare_items || "").split("\n").map((s) => s.trim()).filter(Boolean);
  return (
    <section className="section" aria-labelledby="compare-title">
      <div className="container grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-center md:gap-20">
        <Reveal>
          <p className="eyebrow">Padrão MONTEZ</p>
          <h2 id="compare-title" className="section-title mt-3 text-balance">{c.compare_title}</h2>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-graphite/75">Especificações claras, sem letras miúdas. É isso que você recebe em cada peça da linha Hotel 600.</p>
        </Reveal>
        <Reveal delay={100} className="card divide-y divide-line overflow-hidden bg-white">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-5">
              <span className="font-serif text-[15px] text-taupe tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <p className="flex-1 text-[15px] font-medium text-ink">{it}</p>
              <IconCheck size={18} className="text-olive" />
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

export function ChooseKit({ c, products }: { c: C; products: CatalogProduct[] }) {
  const kits = products.filter((p) => p.kind === "KIT").sort((a, b) => a.pieceCount - b.pieceCount);
  if (!kits.length) return null;
  const rows: { label: string; key: "banho" | "rosto" | "piso" }[] = [
    { label: "Toalhas de banho", key: "banho" },
    { label: "Toalhas de rosto", key: "rosto" },
    { label: "Toalhas de piso", key: "piso" },
  ];
  return (
    <section className="section bg-cream" aria-labelledby="choose-title">
      <div className="container">
        <Reveal className="text-center">
          <p className="eyebrow">Compare</p>
          <h2 id="choose-title" className="section-title mt-3">{c.choose_title}</h2>
        </Reveal>
        <Reveal delay={80} className="mt-10 overflow-x-auto no-scrollbar">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left">
            <thead>
              <tr>
                <th className="w-[28%] p-3" />
                {kits.map((k) => (
                  <th key={k.id} className={`rounded-t-2xl p-4 text-center align-bottom ${k.featured ? "bg-white" : ""}`}>
                    {k.badge && <span className="mb-2 inline-block rounded-full bg-olive px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-ivory">{k.badge}</span>}
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-taupe-dark">{k.name}</span>
                    <span className="block font-serif text-[21px] font-medium leading-tight text-ink">{k.commercialName}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[14px]">
              <tr>
                <td className="border-t border-line p-3 text-taupe-dark">Para quem</td>
                {kits.map((k) => (
                  <td key={k.id} className={`border-t border-line p-3 text-center font-serif text-[17px] italic text-graphite ${k.featured ? "bg-white" : ""}`}>
                    {k.tagline}
                  </td>
                ))}
              </tr>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="border-t border-line p-3 text-taupe-dark">{r.label}</td>
                  {kits.map((k) => {
                    const n = kitCounts(k)[r.key];
                    return (
                      <td key={k.id} className={`border-t border-line p-3 text-center font-semibold ${n ? "text-ink" : "text-taupe/50"} ${k.featured ? "bg-white" : ""}`}>
                        {n || "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="border-t border-line p-3 text-taupe-dark">Total de peças</td>
                {kits.map((k) => (
                  <td key={k.id} className={`border-t border-line p-3 text-center font-semibold text-ink ${k.featured ? "bg-white" : ""}`}>
                    {k.pieceCount}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border-t border-line p-3 text-taupe-dark">Preço</td>
                {kits.map((k) => (
                  <td key={k.id} className={`border-t border-line p-3 text-center font-serif text-[22px] text-ink ${k.featured ? "bg-white" : ""}`}>
                    {formatBRL(k.priceCents)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3" />
                {kits.map((k) => (
                  <td key={k.id} className={`rounded-b-2xl p-4 text-center ${k.featured ? "bg-white" : ""}`}>
                    <Link href={`/produto/${k.slug}`} className={`${k.featured ? "btn-olive" : "btn-outline"} w-full !px-4`} data-cta={`choose_${k.slug}`}>
                      Escolher
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </Reveal>
      </div>
    </section>
  );
}

type ReviewItem = { id: string; name: string; city: string | null; rating: number; title: string | null; body: string; photoUrl: string | null };

export function Reviews({ c, reviews }: { c: C; reviews: ReviewItem[] }) {
  if (!reviews.length) return null; // só exibe avaliações reais cadastradas no admin
  return (
    <section className="section" aria-labelledby="reviews-title">
      <div className="container">
        <Reveal className="text-center">
          <p className="eyebrow">Avaliações</p>
          <h2 id="reviews-title" className="section-title mt-3">{c.reviews_title}</h2>
        </Reveal>
        <div className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 no-scrollbar md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {reviews.map((r) => (
            <figure key={r.id} className="card w-[84%] shrink-0 snap-center bg-white p-6 md:w-auto">
              <div className="flex gap-0.5 text-olive" aria-label={`Nota ${r.rating} de 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <IconStar key={i} size={16} filled={i < r.rating} />
                ))}
              </div>
              {r.title && <p className="mt-3 font-serif text-lg text-ink">{r.title}</p>}
              <blockquote className="mt-2 text-[14px] leading-6 text-graphite/85">“{r.body}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                {r.photoUrl && <Image src={r.photoUrl} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />}
                <span className="text-[13px]">
                  <strong className="block font-semibold text-ink">{r.name}</strong>
                  {r.city && <span className="text-taupe-dark">{r.city}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TrustBar({ c }: { c: C }) {
  const items = [
    { icon: IconPix, text: c.trust_1 },
    { icon: IconShield, text: c.trust_2 },
    { icon: IconTruck, text: c.trust_3 },
    { icon: IconChat, text: c.trust_4 },
  ].filter((i) => i.text);
  return (
    <section className="border-y border-line bg-ivory" aria-label="Compra segura">
      <div className="container grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3 text-[13px] leading-5 text-graphite/80">
            <it.icon size={22} className="shrink-0 text-olive" />
            {it.text}
          </div>
        ))}
      </div>
    </section>
  );
}

export function FaqList({ faqs, limit }: { faqs: { id: string; question: string; answer: string }[]; limit?: number }) {
  const list = limit ? faqs.slice(0, limit) : faqs;
  return (
    <div className="divide-y divide-line border-y border-line">
      {list.map((f) => (
        <details key={f.id} className="group py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[16px] font-medium text-ink [&::-webkit-details-marker]:hidden">
            {f.question}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-taupe-dark transition group-open:rotate-45">+</span>
          </summary>
          <div className="animate-fade-in whitespace-pre-line pb-5 pr-10 text-[15px] leading-7 text-graphite/80">{f.answer}</div>
        </details>
      ))}
    </div>
  );
}

export function FinalCta({ c }: { c: C }) {
  return (
    <section className="relative isolate overflow-hidden bg-linen-texture" aria-labelledby="final-title">
      {c.final_image && <Image src={c.final_image} alt="" fill sizes="100vw" className="-z-10 object-cover opacity-30" />}
      <div className="container py-20 text-center md:py-28">
        <Reveal>
          <h2 id="final-title" className="section-title mx-auto max-w-2xl text-balance">{c.final_title}</h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-graphite/75">{c.final_text}</p>
          <Link href="/#kits" className="btn-primary mt-8" data-cta="final_cta">
            {c.final_cta} <IconArrow size={18} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
