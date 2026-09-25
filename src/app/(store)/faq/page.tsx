import Link from "next/link";
import type { Metadata } from "next";
import { FaqList } from "@/components/home/Sections";
import { getFaqs } from "@/server/content";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Perguntas frequentes",
  description: "Gramatura, composição, medidas, cores, lavagem, PIX, entrega e trocas: tire suas dúvidas sobre as toalhas MONTEZ.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const faqs = await getFaqs();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
  return (
    <>
      {faqs.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <section className="border-b border-line bg-linen-texture">
        <div className="container max-w-3xl py-12 md:py-16">
          <p className="eyebrow">Ajuda</p>
          <h1 className="mt-3 font-serif text-[40px] leading-tight text-ink md:text-[54px]">Perguntas frequentes</h1>
        </div>
      </section>
      <div className="container max-w-3xl py-12 md:py-16">
        <FaqList faqs={faqs} />
        <p className="mt-10 text-[15px] text-graphite/80">
          Não encontrou sua resposta? <Link href="/contato" className="font-semibold underline underline-offset-4">Fale com a gente</Link>.
        </p>
      </div>
    </>
  );
}
