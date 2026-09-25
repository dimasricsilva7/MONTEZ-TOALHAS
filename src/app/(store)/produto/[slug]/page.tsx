import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ProductDetail } from "@/components/product/ProductDetail";
import { KitCard } from "@/components/product/KitCard";
import { FaqList } from "@/components/home/Sections";
import { getCatalog, getProductBySlug } from "@/server/catalog";
import { getFaqs, getSettings } from "@/server/content";
import { siteUrl } from "@/lib/env";

export const revalidate = 300;

export async function generateStaticParams() {
  const catalog = await getCatalog().catch(() => []);
  return catalog.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Produto não encontrado" };
  const title = p.seoTitle || `${p.commercialName} (${p.name}) — ${p.pieceCount} peças`;
  const description = p.seoDescription || p.shortDescription || undefined;
  const image = p.images[0]?.url;
  return {
    title,
    description,
    alternates: { canonical: `/produto/${p.slug}` },
    openGraph: { title, description, type: "website", locale: "pt_BR", ...(image ? { images: [image] } : {}) },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, catalog, faqs, settings] = await Promise.all([getProductBySlug(slug), getCatalog(), getFaqs(), getSettings()]);
  if (!product) notFound();

  const base = siteUrl();
  const shippingNote = Number(settings.shipping_flat_cents) > 0 ? "Envio para todo o Brasil" : "Frete grátis";
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `${product.commercialName} — ${product.name}`,
      sku: product.sku,
      brand: { "@type": "Brand", name: "MONTEZ" },
      description: product.shortDescription ?? product.description ?? undefined,
      ...(product.images.length ? { image: product.images.map((i) => i.url) } : {}),
      material: product.composition ?? undefined,
      offers: {
        "@type": "Offer",
        url: `${base}/produto/${product.slug}`,
        priceCurrency: "BRL",
        price: (product.priceCents / 100).toFixed(2),
        availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: base },
        { "@type": "ListItem", position: 2, name: "Kits", item: `${base}/kits` },
        { "@type": "ListItem", position: 3, name: product.commercialName, item: `${base}/produto/${product.slug}` },
      ],
    },
  ];
  const others = catalog.filter((p) => p.kind === "KIT" && p.id !== product.id).sort((a, b) => a.pieceCount - b.pieceCount);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Trilha" className="container pt-5 text-[12px] text-taupe-dark">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-ink">Início</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/kits" className="hover:text-ink">Kits</Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-ink">{product.commercialName}</li>
        </ol>
      </nav>
      <Suspense>
        <ProductDetail product={product} shippingNote={shippingNote} />
      </Suspense>

      {others.length > 0 && (
        <section className="section border-t border-line bg-cream" aria-labelledby="others-title">
          <div className="container">
            <h2 id="others-title" className="section-title text-center">Compare com os outros kits</h2>
            <div className="mx-auto mt-12 grid max-w-4xl gap-8 md:grid-cols-2">
              {others.map((p) => (
                <KitCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}
      {faqs.length > 0 && (
        <section className="section" aria-labelledby="pfaq-title">
          <div className="container max-w-3xl">
            <h2 id="pfaq-title" className="section-title mb-8 text-center">Dúvidas sobre o kit</h2>
            <FaqList faqs={faqs} limit={6} />
          </div>
        </section>
      )}
    </>
  );
}
