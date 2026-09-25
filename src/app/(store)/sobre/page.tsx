import type { Metadata } from "next";
import { InfoPage } from "@/components/ui/InfoPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Sobre a MONTEZ", description: "A MONTEZ leva para casa a sensação de hotel com toalhas de 600 g/m² em 100% algodão e fio penteado.", alternates: { canonical: "/sobre" } };

export default function Page() {
  return <InfoPage contentKey="page_sobre" eyebrow="Institucional" title="Sobre a MONTEZ" />;
}
