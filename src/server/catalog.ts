import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import type { CatalogColor, CatalogProduct, KitPiece } from "@/types/catalog";

export const getColors = unstable_cache(
  async (): Promise<CatalogColor[]> => {
    const colors = await db.color.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { commercialName: "asc" }] });
    return colors.map((c) => ({ id: c.id, slug: c.slug, name: c.commercialName, hex: c.hex, swatchUrl: c.swatchUrl }));
  },
  ["colors"],
  { tags: ["catalog"], revalidate: 300 }
);

export const getCatalog = unstable_cache(
  async (): Promise<CatalogProduct[]> => {
    const products = await db.product.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }],
      include: {
        variants: { where: { active: true, color: { active: true } }, include: { color: true } },
        images: { include: { media: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    return products.map((p) => ({
      id: p.id,
      slug: p.slug,
      sku: p.sku,
      kind: p.kind,
      name: p.name,
      commercialName: p.commercialName,
      subtitle: p.subtitle,
      shortDescription: p.shortDescription,
      description: p.description,
      tagline: p.tagline,
      badge: p.badge,
      priceCents: p.priceCents,
      compareAtPriceCents: p.compareAtPriceCents,
      pieceCount: p.pieceCount,
      pieces: (Array.isArray(p.pieces) ? p.pieces : []) as unknown as KitPiece[],
      specs: (Array.isArray(p.specs) ? p.specs : []) as unknown as { label: string; value: string }[],
      composition: p.composition,
      weight: p.weight,
      dimensions: p.dimensions,
      featured: p.featured,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      inStock: p.allowBackorder || p.variants.some((v) => v.stockQuantity > 0),
      variants: p.variants
        .sort((a, b) => a.color.sortOrder - b.color.sortOrder)
        .map((v) => ({
          id: v.id,
          sku: v.sku,
          colorId: v.colorId,
          available: p.allowBackorder || v.stockQuantity > 0,
        })),
      images: p.images
        .filter((i) => i.media.active)
        .map((i) => ({ url: i.media.url, alt: i.media.alt || p.commercialName, colorId: i.colorId, device: i.device })),
    }));
  },
  ["catalog"],
  { tags: ["catalog"], revalidate: 300 }
);

export async function getProductBySlug(slug: string) {
  const catalog = await getCatalog();
  return catalog.find((p) => p.slug === slug) ?? null;
}
