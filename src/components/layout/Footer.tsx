import Link from "next/link";
import { Logo } from "./Logo";
import { IconInstagram, IconPix, IconShield, IconWhatsapp } from "@/components/icons";

type Props = { content: Record<string, string>; settings: Record<string, string> };

const COLS = [
  {
    title: "Comprar",
    links: [
      { href: "/kits", label: "Kits" },
      { href: "/produto/montez-m4", label: "M4 — Kit Essencial" },
      { href: "/produto/montez-m5", label: "M5 — Kit Completo" },
      { href: "/produto/montez-m6", label: "M6 — Kit Experiência" },
    ],
  },
  {
    title: "Ajuda",
    links: [
      { href: "/faq", label: "FAQ" },
      { href: "/rastrear-pedido", label: "Rastrear pedido" },
      { href: "/trocas-e-devolucoes", label: "Trocas e devoluções" },
      { href: "/cuidados", label: "Cuidados" },
    ],
  },
  {
    title: "Institucional",
    links: [
      { href: "/sobre", label: "Sobre" },
      { href: "/contato", label: "Contato" },
      { href: "/politica-de-privacidade", label: "Privacidade" },
      { href: "/termos", label: "Termos" },
    ],
  },
];

export function Footer({ content, settings }: Props) {
  const wa = settings.contact_whatsapp?.replace(/\D/g, "");
  const ig = settings.contact_instagram?.replace(/^@/, "");
  return (
    <footer className="border-t border-line bg-cream">
      <div className="container grid gap-12 py-14 md:grid-cols-[1.3fr_2fr] md:py-20">
        <div className="max-w-sm">
          <Logo className="!items-start" />
          <p className="mt-6 text-sm leading-6 text-graphite/75">{content.footer_text}</p>
          <div className="mt-6 flex gap-2">
            {ig && (
              <a href={`https://instagram.com/${ig}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line p-2.5 text-graphite hover:border-ink" aria-label="Instagram">
                <IconInstagram size={18} />
              </a>
            )}
            {wa && (
              <a href={`https://wa.me/${wa.startsWith("55") ? wa : `55${wa}`}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line p-2.5 text-graphite hover:border-ink" aria-label="WhatsApp">
                <IconWhatsapp size={18} />
              </a>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLS.map((col) => (
            <div key={col.title}>
              <p className="eyebrow mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-graphite/80 transition hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container flex flex-col gap-3 py-6 text-[12px] text-taupe-dark md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {settings.store_legal_name || "MONTEZ"}
            {settings.store_cnpj ? ` · CNPJ ${settings.store_cnpj}` : ""} · {content.footer_tagline}
          </p>
          <p className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <IconPix size={14} /> PIX
            </span>
            <span className="flex items-center gap-1.5">
              <IconShield size={14} /> Checkout seguro
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
