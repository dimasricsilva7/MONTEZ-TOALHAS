import type { Metadata } from "next";
import { InfoPage } from "@/components/ui/InfoPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Política de privacidade", description: "Como a MONTEZ trata seus dados pessoais, em conformidade com a LGPD.", alternates: { canonical: "/politica-de-privacidade" } };

export default function Page() {
  return <InfoPage contentKey="page_privacidade" eyebrow="Institucional" title="Política de privacidade" />;
}
