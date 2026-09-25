import type { Metadata } from "next";
import { revalidatePath, revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { Card, PageHeader, inputCls, labelCls } from "@/components/admin/ui";
import { ActionForm, ConfirmAction, SubmitButton, type ActionResult } from "@/components/admin/client";
import { ImageField } from "@/components/admin/media";
import { bool, int, optStr, str } from "@/server/admin/forms";
import { slugify } from "@/utils/format";

export const metadata: Metadata = { title: "Cores" };

async function saveColor(_: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const admin = await requireAdmin();
  const id = str(fd, "id", 40);
  const hex = str(fd, "hex", 7).toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(hex)) return { error: "HEX inválido (use #RRGGBB)." };
  const internalName = str(fd, "internalName", 60);
  const commercialName = str(fd, "commercialName", 60);
  if (!internalName || !commercialName) return { error: "Informe nome interno e nome comercial." };
  const data = { internalName, commercialName, hex, swatchUrl: optStr(fd, "swatchUrl", 1000), active: bool(fd, "active"), sortOrder: int(fd, "sortOrder", 0) };
  try {
    if (id) await db.color.update({ where: { id }, data });
    else {
      const color = await db.color.create({ data: { ...data, slug: slugify(str(fd, "slug", 40) || internalName) } });
      // Nova cor fica disponível (sem estoque) em todos os kits; ajuste por produto se necessário
      const products = await db.product.findMany({ select: { id: true, sku: true } });
      for (const p of products) {
        await db.productVariant.create({ data: { productId: p.id, colorId: color.id, sku: `${p.sku}-${color.slug.toUpperCase()}`, active: false } });
      }
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "Já existe uma cor com esse identificador." };
    throw e;
  }
  await audit(admin.id, id ? "color_updated" : "color_created", "color", id || null, data);
  revalidateTag("catalog");
  revalidatePath("/admin/cores");
  return { ok: true, message: id ? "Cor salva." : "Cor criada (ative-a nos produtos desejados)." };
}

async function deleteColor(_: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const admin = await requireAdmin();
  const id = str(fd, "id", 40);
  const used = await db.orderItem.count({ where: { variant: { colorId: id } } });
  if (used > 0) {
    await db.color.update({ where: { id }, data: { active: false } });
    await audit(admin.id, "color_deactivated", "color", id);
    revalidateTag("catalog");
    revalidatePath("/admin/cores");
    return { ok: true, message: "Cor usada em pedidos: foi desativada em vez de excluída." };
  }
  await db.productVariant.deleteMany({ where: { colorId: id } });
  await db.color.delete({ where: { id } });
  await audit(admin.id, "color_deleted", "color", id);
  revalidateTag("catalog");
  revalidatePath("/admin/cores");
  return { ok: true, message: "Cor excluída." };
}

function ColorForm({ c }: { c?: { id: string; slug: string; internalName: string; commercialName: string; hex: string; swatchUrl: string | null; active: boolean; sortOrder: number } }) {
  return (
    <ActionForm action={saveColor} className="grid items-end gap-3 md:grid-cols-[56px_1fr_1fr_120px_80px_auto_auto]">
      <input type="hidden" name="id" value={c?.id ?? ""} />
      <span className="h-12 w-12 rounded-full ring-1 ring-black/10" style={{ background: c?.hex ?? "#EEEEEE" }} aria-hidden />
      <div>
        <label className={labelCls}>Nome interno</label>
        <input name="internalName" defaultValue={c?.internalName} className={inputCls} required />
      </div>
      <div>
        <label className={labelCls}>Nome comercial</label>
        <input name="commercialName" defaultValue={c?.commercialName} className={inputCls} required />
      </div>
      <div>
        <label className={labelCls}>HEX</label>
        <input name="hex" defaultValue={c?.hex ?? "#"} className={inputCls} required pattern="#[0-9A-Fa-f]{6}" />
      </div>
      <div>
        <label className={labelCls}>Ordem</label>
        <input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 99} className={inputCls} />
      </div>
      <label className="flex h-10 items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={c?.active ?? true} /> Ativa
      </label>
      <SubmitButton>{c ? "Salvar" : "Criar cor"}</SubmitButton>
      <div className="md:col-span-7">
        <ImageField name="swatchUrl" label="Imagem da amostra (opcional — senão usa o HEX)" defaultValue={c?.swatchUrl ?? ""} category="COLECAO" />
      </div>
    </ActionForm>
  );
}

export default async function ColorsPage() {
  const colors = await db.color.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <>
      <PageHeader title="Cores" description={`${colors.filter((c) => c.active).length} ativas de ${colors.length}. Nomes comerciais aparecem na loja; o nome interno é para a operação.`} />
      <div className="space-y-4">
        {colors.map((c) => (
          <Card key={c.id}>
            <ColorForm c={c} />
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>Identificador: {c.slug}</span>
              <ConfirmAction action={deleteColor} label="Excluir" danger confirmLabel="Excluir cor" description="Se a cor já foi vendida, ela será apenas desativada." hidden={{ id: c.id }} />
            </div>
          </Card>
        ))}
        <Card title="Nova cor">
          <ColorForm />
        </Card>
      </div>
    </>
  );
}
