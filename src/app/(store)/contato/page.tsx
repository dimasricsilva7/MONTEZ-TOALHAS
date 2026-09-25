import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/content";
import { IconChat, IconInstagram, IconWhatsapp } from "@/components/icons";

export const revalidate = 300;
export const metadata: Metadata = { title: "Contato", description: "Fale com o atendimento MONTEZ.", alternates: { canonical: "/contato" } };

export default async function ContactPage() {
  const s = await getSettings();
  const wa = s.contact_whatsapp?.replace(/\D/g, "");
  const ig = s.contact_instagram?.replace(/^@/, "");
  const channels = [
    s.contact_email && { icon: IconChat, label: "E-mail", value: s.contact_email, href: `mailto:${s.contact_email}` },
    wa && { icon: IconWhatsapp, label: "WhatsApp", value: s.contact_whatsapp, href: `https://wa.me/${wa.startsWith("55") ? wa : `55${wa}`}` },
    ig && { icon: IconInstagram, label: "Instagram", value: `@${ig}`, href: `https://instagram.com/${ig}` },
  ].filter(Boolean) as { icon: typeof IconChat; label: string; value: string; href: string }[];

  return (
    <>
      <section className="border-b border-line bg-linen-texture">
        <div className="container max-w-3xl py-12 md:py-16">
          <p className="eyebrow">Atendimento</p>
          <h1 className="mt-3 font-serif text-[40px] leading-tight text-ink md:text-[54px]">Fale com a MONTEZ</h1>
          <p className="mt-3 text-[15px] text-graphite/75">Tire dúvidas sobre produtos, pedidos, entregas ou trocas.</p>
        </div>
      </section>
      <div className="container max-w-3xl py-12 md:py-16">
        {channels.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {channels.map((c) => (
              <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-4 bg-white p-5 transition hover:border-ink">
                <c.icon size={26} className="text-olive" />
                <span>
                  <span className="label !mb-0">{c.label}</span>
                  <span className="block font-semibold text-ink">{c.value}</span>
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-graphite/80">Nossos canais de atendimento serão publicados em breve.</p>
        )}
        {s.contact_hours && <p className="mt-6 text-sm text-taupe-dark">Horário de atendimento: {s.contact_hours}</p>}
        {s.contact_address && <p className="mt-2 whitespace-pre-line text-sm text-taupe-dark">{s.contact_address}</p>}
        <p className="mt-10 text-[15px] text-graphite/80">
          Já fez um pedido? <Link href="/rastrear-pedido" className="font-semibold underline underline-offset-4">Acompanhe por aqui</Link>.
        </p>
      </div>
    </>
  );
}
