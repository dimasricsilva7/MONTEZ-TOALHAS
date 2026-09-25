import type { Metadata } from "next";
import { InfoPage } from "@/components/ui/InfoPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Trocas e devoluções", description: "Direito de arrependimento, trocas e devoluções na MONTEZ.", alternates: { canonical: "/trocas-e-devolucoes" } };

export default function Page() {
  return <InfoPage contentKey="page_trocas" eyebrow="Ajuda" title="Trocas e devoluções" />;
}
