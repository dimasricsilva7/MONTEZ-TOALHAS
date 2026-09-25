import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartProvider } from "@/components/providers/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Analytics } from "@/components/providers/Analytics";
import { getCatalog, getColors } from "@/server/catalog";
import { getContent, getSettings, isOn } from "@/server/content";
import { siteUrl } from "@/lib/env";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [catalog, colors, content, settings] = await Promise.all([getCatalog(), getColors(), getContent(), getSettings()]);
  const base = siteUrl();
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.store_name || "MONTEZ",
    url: base,
    logo: settings.store_logo || `${base}/icon.svg`,
    ...(settings.contact_email ? { email: settings.contact_email } : {}),
    ...(settings.contact_instagram ? { sameAs: [`https://instagram.com/${settings.contact_instagram.replace(/^@/, "")}`] } : {}),
  };

  return (
    <CartProvider catalog={catalog} colors={colors}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org).replace(/</g, "\\u003c") }} />
      {isOn(content.announcement_enabled) && content.announcement_bar && (
        <div className="bg-ink text-ivory">
          <p className="container py-2 text-center text-[11px] font-medium uppercase tracking-[0.22em]">{content.announcement_bar}</p>
        </div>
      )}
      <Header />
      <main id="conteudo">{children}</main>
      <Footer content={content} settings={settings} />
      <CartDrawer shippingNote={Number(settings.shipping_flat_cents) > 0 ? "Frete calculado no checkout." : "Frete grátis para todo o Brasil."} />
      <Analytics metaEnabled={isOn(settings.tracking_meta_enabled)} gaEnabled={isOn(settings.tracking_ga_enabled)} />
    </CartProvider>
  );
}
