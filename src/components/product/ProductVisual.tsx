import Image from "next/image";
import type { CatalogColor, CatalogImage, CatalogProduct } from "@/types/catalog";
import { TowelStack, piecesForKit } from "./TowelStack";

export function kitCounts(product: Pick<CatalogProduct, "pieces">) {
  const c = { banho: 0, rosto: 0, piso: 0 };
  for (const p of product.pieces) {
    if (p.type === "banho" || p.type === "rosto" || p.type === "piso") c[p.type] += p.quantity;
  }
  return c;
}

/** Imagens da cor escolhida primeiro; depois as genéricas do produto. */
export function imagesForColor(product: CatalogProduct, colorId: string | null | undefined): CatalogImage[] {
  const byColor = colorId ? product.images.filter((i) => i.colorId === colorId) : [];
  const generic = product.images.filter((i) => !i.colorId);
  return byColor.length ? [...byColor, ...generic] : generic;
}

type Props = {
  product: CatalogProduct;
  color: CatalogColor | null | undefined;
  className?: string;
  sizes?: string;
  priority?: boolean;
  background?: boolean;
};

/** Foto real (se cadastrada no admin) ou ilustração vetorial na cor escolhida. */
export function ProductVisual({ product, color, className = "", sizes = "(max-width: 768px) 90vw, 33vw", priority, background = true }: Props) {
  const image = imagesForColor(product, color?.id)[0];
  if (image) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image src={image.url} alt={image.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }
  return (
    <div className={`relative flex items-end justify-center overflow-hidden ${background ? "bg-gradient-to-b from-cream to-linen/70" : ""} ${className}`}>
      <TowelStack
        colors={color?.hex ?? "#EEE7DA"}
        pieces={piecesForKit(kitCounts(product))}
        className="h-[84%] w-[88%]"
        label={`${product.commercialName} na cor ${color?.name ?? ""}`}
      />
    </div>
  );
}
