import Link from "next/link";
import type { Metadata } from "next";
import { KitCard } from "@/components/product/KitCard";
import { ChooseKit, DEFAULT_CARD_COLORS } from "@/components/home/Sections";
import { getCatalog, getColors } from "@/server/catalog";
import { getContent } from "@/server/content";

export const metadata: Metadata = {
  title: "Toalhas e kits MONTEZ Hotel 600",
  description: "Kits de toalhas MONTEZ com 4, 5 ou 6 peças: 600 g/m², 100% algodão e fio penteado, em 10 cores.",
  alternates: { canonical: "/kits" },
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default async function KitsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [products, colors, c] = await Promise.all([getCatalog(), getColors(), getContent()]);
  const query = q?.trim().slice(0, 80) ?? "";
  const colorMatch = query ? colors.find((x) => norm(x.name).includes(norm(query)) || norm(x.slug).includes(norm(query))) : undefined;
  const list = query && !colorMatch
    ? products.filter((p) => norm([p.name, p.commercialName, p.subtitle, p.shortDescription, p.pieces.map((x) => `${x.label} ${x.dimensions}`).join(" ")].join(" ")).includes(norm(query)))
    : products;
  const kits = list.filter((p) => p.kind === "KIT").sort((a, b) => a.pieceCount - b.pieceCount);

  return (
    <>
      <section className="border-b border-line bg-linen-texture">
        <div className="container py-12 text-center md:py-16">
          <p className="eyebrow">Linha MONTEZ Hotel 600</p>
          <h1 className="mt-3 font-serif text-[40px] leading-tight text-ink md:text-[56px]">Toalhas e kits</h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-7 text-graphite/75">{c.kits_subtitle}</p>
          {query && (
            <p className="mt-6 text-sm text-graphite">
              {colorMatch ? (
                <>Todos os kits estão disponíveis na cor <strong>{colorMatch.name}</strong>. Escolha a cor na página do kit.</>
              ) : (
                <>
                  {kits.length} resultado(s) para <strong>“{query}”</strong>
                </>
              )}{" "}
              · <Link href="/kits" className="underline underline-offset-4">limpar busca</Link>
            </p>
          )}
        </div>
      </section>
      <section className="section">
        <div className="container">
          {kits.length ? (
            <div className="grid gap-8 md:grid-cols-3 md:gap-6">
              {kits.map((p, i) => (
                <div key={p.id} className={p.featured ? "order-first md:order-none" : ""}>
                  <KitCard product={p} defaultColorSlug={DEFAULT_CARD_COLORS[i % DEFAULT_CARD_COLORS.length]} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="font-serif text-2xl text-ink">Nada encontrado.</p>
              <Link href="/kits" className="btn-primary mt-6">Ver todos os kits</Link>
            </div>
          )}
        </div>
      </section>
      <ChooseKit c={c} products={products} />
    </>
  );
}
