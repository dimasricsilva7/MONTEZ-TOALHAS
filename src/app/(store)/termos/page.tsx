import type { Metadata } from "next";
import { InfoPage } from "@/components/ui/InfoPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Termos de uso", description: "Termos de uso e condições de compra da loja MONTEZ.", alternates: { canonical: "/termos" } };

export default function Page() {
  return <InfoPage contentKey="page_termos" eyebrow="Institucional" title="Termos de uso" />;
}
