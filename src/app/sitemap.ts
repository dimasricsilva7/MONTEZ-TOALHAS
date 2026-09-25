import type { MetadataRoute } from "next";
import { getCatalog } from "@/server/catalog";
import { siteUrl } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const products = await getCatalog().catch(() => []);
  const staticPaths = ["", "/kits", "/sobre", "/cuidados", "/faq", "/contato", "/trocas-e-devolucoes", "/politica-de-privacidade", "/termos", "/rastrear-pedido"];
  return [
    ...staticPaths.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...products.map((p) => ({ url: `${base}/produto/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.9 })),
  ];
}
