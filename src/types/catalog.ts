export type KitPiece = {
  type: "banho" | "rosto" | "piso" | string;
  label: string;
  quantity: number;
  dimensions?: string;
  weight?: string;
  composition?: string;
};

export type CatalogColor = { id: string; slug: string; name: string; hex: string; swatchUrl: string | null };

export type CatalogImage = { url: string; alt: string; colorId: string | null; device: "ALL" | "DESKTOP" | "MOBILE" };

export type CatalogVariant = { id: string; sku: string; colorId: string; available: boolean };

export type CatalogProduct = {
  id: string;
  slug: string;
  sku: string;
  kind: "KIT" | "PIECE";
  name: string;
  commercialName: string;
  subtitle: string | null;
  shortDescription: string | null;
  description: string | null;
  tagline: string | null;
  badge: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  pieceCount: number;
  pieces: KitPiece[];
  specs: { label: string; value: string }[];
  composition: string | null;
  weight: string | null;
  dimensions: string | null;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  inStock: boolean;
  variants: CatalogVariant[];
  images: CatalogImage[];
};

export type CartLine = { productId: string; colorId: string; quantity: number };
