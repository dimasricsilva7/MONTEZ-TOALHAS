import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/layout/Logo";
import { CartProvider } from "@/components/providers/CartProvider";
import { Analytics } from "@/components/providers/Analytics";
import { IconShield } from "@/components/icons";
import { getCatalog, getColors } from "@/server/catalog";
import { getSettings, isOn } from "@/server/content";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const [catalog, colors, settings] = await Promise.all([getCatalog(), getColors(), getSettings()]);
  return (
    <CartProvider catalog={catalog} colors={colors}>
      <header className="border-b border-line bg-ivory">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-olive">
            <IconShield size={16} /> Compra 100% segura
          </p>
        </div>
      </header>
      <main className="min-h-[70vh] bg-ivory">{children}</main>
      <footer className="border-t border-line bg-cream">
        <div className="container flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-6 text-[12px] text-taupe-dark">
          <span>© {new Date().getFullYear()} {settings.store_legal_name || "MONTEZ"}{settings.store_cnpj ? ` · CNPJ ${settings.store_cnpj}` : ""}</span>
          <Link href="/trocas-e-devolucoes" className="hover:text-ink">Trocas e devoluções</Link>
          <Link href="/politica-de-privacidade" className="hover:text-ink">Privacidade</Link>
          <Link href="/termos" className="hover:text-ink">Termos</Link>
          {settings.contact_email && <a href={`mailto:${settings.contact_email}`} className="hover:text-ink">{settings.contact_email}</a>}
        </div>
      </footer>
      <Analytics metaEnabled={isOn(settings.tracking_meta_enabled)} gaEnabled={isOn(settings.tracking_ga_enabled)} />
    </CartProvider>
  );
}
