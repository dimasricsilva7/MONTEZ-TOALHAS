"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { del } from "@vercel/blob";
import { MediaCategory, MediaDevice } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/components/admin/client";

const schema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  alt: z.string().trim().max(200),
  category: z.nativeEnum(MediaCategory),
  device: z.nativeEnum(MediaDevice),
  page: z.string().trim().max(60),
  section: z.string().trim().max(60),
  active: z.boolean(),
});

export async function updateMediaAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse({
    id: fd.get("id"),
    name: fd.get("name"),
    alt: fd.get("alt") ?? "",
    category: fd.get("category"),
    device: fd.get("device"),
    page: fd.get("page") ?? "",
    section: fd.get("section") ?? "",
    active: fd.get("active") === "on",
  });
  if (!parsed.success) return { error: "Dados inválidos." };
  const { id, page, section, ...data } = parsed.data;
  await db.mediaAsset.update({ where: { id }, data: { ...data, page: page || null, section: section || null } });
  await audit(admin.id, "media_updated", "media", id, data);
  revalidateTag("catalog");
  revalidatePath("/admin/imagens");
  return { ok: true };
}

export async function deleteMediaAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) return { error: "Imagem não encontrada." };
  const [inContent, inSettings] = await Promise.all([
    db.siteContent.count({ where: { value: { equals: asset.url } } }),
    db.setting.count({ where: { value: { equals: asset.url } } }),
  ]);
  if (inContent + inSettings > 0) return { error: "Esta imagem está em uso no conteúdo/configurações do site. Troque-a lá antes de excluir." };
  await db.mediaAsset.delete({ where: { id } });
  if (asset.url.includes("blob.vercel-storage.com") && process.env.BLOB_READ_WRITE_TOKEN) await del(asset.url).catch(() => {});
  await audit(admin.id, "media_deleted", "media", id, { name: asset.name, url: asset.url });
  revalidateTag("catalog");
  revalidatePath("/admin/imagens");
  return { ok: true, message: "Imagem excluída." };
}
