import type { Metadata } from "next";
import { InfoPage } from "@/components/ui/InfoPage";

export const revalidate = 300;
export const metadata: Metadata = { title: "Cuidados com suas toalhas", description: "Como lavar e secar as toalhas MONTEZ para manter maciez e absorção.", alternates: { canonical: "/cuidados" } };

export default function Page() {
  return <InfoPage contentKey="page_cuidados" eyebrow="Guia" title="Cuidados com suas toalhas" />;
}
