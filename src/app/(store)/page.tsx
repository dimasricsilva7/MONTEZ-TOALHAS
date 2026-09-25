import Link from "next/link";
import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import { ColorsSection } from "@/components/home/ColorsSection";
import { Benefits, ChooseKit, Compare, Experience, FaqList, FinalCta, HotelSection, KitsSection, Reviews, TrustBar } from "@/components/home/Sections";
import { getCatalog, getColors } from "@/server/catalog";
import { getContent, getFaqs, getReviews, getSettings, isOn } from "@/server/content";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { absolute: s.seo_title },
    description: s.seo_description,
    alternates: { canonical: "/" },
    openGraph: { title: s.seo_title, description: s.seo_description, type: "website", locale: "pt_BR", siteName: "MONTEZ", ...(s.seo_og_image ? { images: [s.seo_og_image] } : {}) },
    twitter: { card: "summary_large_image", title: s.seo_title, description: s.seo_description },
  };
}

export default async function HomePage() {
  const [c, products, colors, faqs, reviews] = await Promise.all([getContent(), getCatalog(), getColors(), getFaqs(), getReviews()]);

  return (
    <>
      {isOn(c.hero_enabled) && <Hero c={c} colors={colors} />}
      <Benefits c={c} />
      <KitsSection c={c} products={products} />
      <ColorsSection title={c.colors_title} subtitle={c.colors_subtitle} />
      <Experience c={c} />
      <HotelSection c={c} />
      <Compare c={c} />
      <ChooseKit c={c} products={products} />
      <Reviews c={c} reviews={reviews} />
      <TrustBar c={c} />
      {faqs.length > 0 && (
        <section className="section" aria-labelledby="faq-home-title">
          <div className="container grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
            <div>
              <p className="eyebrow">Dúvidas</p>
              <h2 id="faq-home-title" className="section-title mt-3">Perguntas frequentes</h2>
              <Link href="/faq" className="mt-6 inline-flex text-sm font-semibold text-ink underline underline-offset-4">
                Ver todas as perguntas
              </Link>
            </div>
            <FaqList faqs={faqs} limit={6} />
          </div>
        </section>
      )}
      <FinalCta c={c} />
    </>
  );
}
