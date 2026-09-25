"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, MediaDevice } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { bool, int, jsonArray, optStr, parseMoney, str } from "@/server/admin/forms";
import { slugify } from "@/utils/format";
import type { ActionResult } from "@/components/admin/client";
import type { KitPiece } from "@/types/catalog";

function revalidateCatalog() {
  revalidateTag("catalog");
  revalidatePath("/", "layout");
}

export async function saveProductAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = str(fd, "id", 40);
  const name = str(fd, "name", 80);
  const commercialName = str(fd, "commercialName", 120);
  const slug = slugify(str(fd, "slug", 80) || commercialName);
  const sku = str(fd, "sku", 40).toUpperCase();
  const price = parseMoney(fd.get("price"));
  const compareAt = parseMoney(fd.get("compareAt"));
  if (!name || !commercialName || !slug || !sku) return { error: "Preencha nome, nome comercial, slug e SKU." };
  if (price == null || price < 500) return { error: "Preço inválido (mínimo R$ 5,00 por limitação do PIX)." };
  if (compareAt != null && compareAt <= price) return { error: "O preço anterior deve ser maior que o preço atual — ou deixe em branco. Não use preço anterior fictício." };

  const pieces = jsonArray<KitPiece>(fd, "pieces")
    .filter((p) => p.label && p.quantity > 0)
    .map((p) => ({ type: String(p.type || "outro").slice(0, 20), label: String(p.label).slice(0, 60), quantity: Math.min(20, Math.max(1, Number(p.quantity) || 1)), dimensions: String(p.dimensions ?? "").slice(0, 40), weight: String(p.weight ?? "").slice(0, 40), composition: String(p.composition ?? "").slice(0, 120) }));
  const specs = jsonArray<{ label: string; value: string }>(fd, "specs")
    .filter((s) => s.label && s.value)
    .map((s) => ({ label: String(s.label).slice(0, 60), value: String(s.value).slice(0, 160) }));

  const data = {
    name,
    commercialName,
    slug,
    sku,
    kind: fd.get("kind") === "PIECE" ? ("PIECE" as const) : ("KIT" as const),
    subtitle: optStr(fd, "subtitle", 160),
    tagline: optStr(fd, "tagline", 160),
    badge: optStr(fd, "badge", 40),
    shortDescription: optStr(fd, "shortDescription", 400),
    description: optStr(fd, "description", 5000),
    priceCents: price,
    compareAtPriceCents: compareAt,
    pieceCount: Math.max(1, int(fd, "pieceCount", pieces.reduce((s, p) => s + p.quantity, 0) || 1)),
    pieces: pieces as unknown as Prisma.InputJsonValue,
    specs: specs as unknown as Prisma.InputJsonValue,
    composition: optStr(fd, "composition", 200),
    weight: optStr(fd, "weight", 100),
    dimensions: optStr(fd, "dimensions", 300),
    stockQuantity: Math.max(0, int(fd, "stockQuantity", 0)),
    allowBackorder: bool(fd, "allowBackorder"),
    lowStockThreshold: Math.max(0, int(fd, "lowStockThreshold", 5)),
    featured: bool(fd, "featured"),
    active: bool(fd, "active"),
    sortOrder: int(fd, "sortOrder", 0),
    seoTitle: optStr(fd, "seoTitle", 120),
    seoDescription: optStr(fd, "seoDescription", 300),
  };

  let productId = id;
  try {
    if (id) {
      await db.product.update({ where: { id }, data });
    } else {
      productId = (await db.product.create({ data })).id;
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "Slug ou SKU já está em uso por outro produto." };
    throw e;
  }

  // Variantes (uma por cor): ativo + estoque
  const colors = await db.color.findMany();
  for (const c of colors) {
    const enabled = bool(fd, `variant_${c.id}_active`);
    const stock = Math.max(0, int(fd, `variant_${c.id}_stock`, 0));
    const existing = await db.productVariant.findUnique({ where: { productId_colorId: { productId, colorId: c.id } } });
    if (existing) {
      await db.productVariant.update({ where: { id: existing.id }, data: { active: enabled, stockQuantity: stock } });
    } else if (enabled) {
      await db.productVariant.create({ data: { productId, colorId: c.id, sku: `${sku}-${c.slug.toUpperCase()}`, stockQuantity: stock, active: true } });
    }
  }

  await audit(admin.id, id ? "product_updated" : "product_created", "product", productId, { name, sku, price });
  revalidateCatalog();
  revalidatePath("/admin/produtos");
  if (!id) redirect(`/admin/produtos/${productId}`);
  return { ok: true, message: "Produto salvo." };
}

export async function deleteProductAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = str(fd, "id", 40);
  const product = await db.product.findUnique({ where: { id }, include: { _count: { select: { orderItems: true } } } });
  if (!product) return { error: "Produto não encontrado." };
  if (product._count.orderItems > 0) {
    await db.product.update({ where: { id }, data: { active: false } });
    await audit(admin.id, "product_deactivated", "product", id, { reason: "possui pedidos" });
    revalidateCatalog();
    return { ok: true, message: "O produto possui pedidos: foi desativado em vez de excluído (preserva o histórico)." };
  }
  await db.product.delete({ where: { id } });
  await audit(admin.id, "product_deleted", "product", id, { name: product.name });
  revalidateCatalog();
  redirect("/admin/produtos");
}

export async function addProductImageAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const productId = str(fd, "productId", 40);
  const url = str(fd, "url", 1000);
  if (!url) return { error: "Escolha uma imagem." };
  const media = await db.mediaAsset.findFirst({ where: { url } });
  if (!media) return { error: "Imagem não encontrada na biblioteca." };
  const colorId = str(fd, "colorId", 40) || null;
  const device = (Object.values(MediaDevice) as string[]).includes(str(fd, "device")) ? (str(fd, "device") as MediaDevice) : "ALL";
  const count = await db.productImage.count({ where: { productId } });
  await db.productImage.create({ data: { productId, mediaId: media.id, colorId, device, sortOrder: count } });
  await audit(admin.id, "product_image_added", "product", productId, { media: media.id, colorId });
  revalidateCatalog();
  revalidatePath(`/admin/produtos/${productId}`);
  return { ok: true, message: "Imagem adicionada." };
}

export async function removeProductImageAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const imageId = str(fd, "imageId", 40);
  const img = await db.productImage.delete({ where: { id: imageId } });
  await audit(admin.id, "product_image_removed", "product", img.productId, { imageId });
  revalidateCatalog();
  revalidatePath(`/admin/produtos/${img.productId}`);
  return { ok: true };
}

export async function moveProductImageAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const imageId = str(fd, "imageId", 40);
  const dir = str(fd, "dir") === "up" ? -1 : 1;
  const img = await db.productImage.findUniqueOrThrow({ where: { id: imageId } });
  const list = await db.productImage.findMany({ where: { productId: img.productId }, orderBy: { sortOrder: "asc" } });
  const idx = list.findIndex((i) => i.id === imageId);
  const swap = list[idx + dir];
  if (swap) {
    await db.$transaction([
      db.productImage.update({ where: { id: img.id }, data: { sortOrder: idx + dir } }),
      db.productImage.update({ where: { id: swap.id }, data: { sortOrder: idx } }),
    ]);
  }
  revalidateCatalog();
  revalidatePath(`/admin/produtos/${img.productId}`);
  return { ok: true };
}
