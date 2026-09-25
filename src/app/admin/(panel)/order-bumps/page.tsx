import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { Card, Field, PageHeader, inputCls, textareaCls } from "@/components/admin/ui";
import { ActionForm, ConfirmAction, SubmitButton, type ActionResult } from "@/components/admin/client";
import { ImageField } from "@/components/admin/media";
import { bool, centsToInput, int, optStr, parseMoney, str } from "@/server/admin/forms";
import { formatBRL } from "@/utils/format";

export const metadata: Metadata = { title: "Order Bumps" };

async function saveBump(_: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const admin = await requireAdmin();
  const id = str(fd, "id", 40);
  const price = parseMoney(fd.get("price"));
  const title = str(fd, "title", 120);
  const sku = str(fd, "sku", 40).toUpperCase();
  if (!title || !sku || price == null || price <= 0) return { error: "Informe título, SKU e preço." };
  const data = { title, sku, priceCents: price, description: optStr(fd, "description", 300), imageUrl: optStr(fd, "imageUrl", 1000), active: bool(fd, "active"), sortOrder: int(fd, "sortOrder", 0) };
  try {
    if (id) await db.orderBump.update({ where: { id }, data });
    else await db.orderBump.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "SKU já utilizado." };
    throw e;
  }
  await audit(admin.id, id ? "order_bump_updated" : "order_bump_created", "order_bump", id || null, data);
  revalidatePath("/admin/order-bumps");
  return { ok: true };
}

async function deleteBump(_: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const admin = await requireAdmin();
  const id = str(fd, "id", 40);
  await db.orderBump.delete({ where: { id } });
  await audit(admin.id, "order_bump_deleted", "order_bump", id);
  revalidatePath("/admin/order-bumps");
  return { ok: true, message: "Excluído." };
}

type B = { id: string; sku: string; title: string; description: string | null; priceCents: number; imageUrl: string | null; active: boolean; sortOrder: number };

function BumpForm({ b }: { b?: B }) {
  return (
    <ActionForm action={saveBump} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="id" value={b?.id ?? ""} />
      <Field label="Título"><input name="title" defaultValue={b?.title} required className={inputCls} placeholder="+ 1 toalha de rosto MONTEZ" /></Field>
      <Field label="SKU"><input name="sku" defaultValue={b?.sku} required className={inputCls} /></Field>
      <Field label="Descrição" className="md:col-span-2"><textarea name="description" defaultValue={b?.description ?? ""} rows={2} className={textareaCls} /></Field>
      <Field label="Preço (R$)"><input name="price" defaultValue={centsToInput(b?.priceCents)} required className={inputCls} inputMode="decimal" /></Field>
      <Field label="Ordem"><input name="sortOrder" type="number" defaultValue={b?.sortOrder ?? 0} className={inputCls} /></Field>
      <ImageField name="imageUrl" label="Imagem (opcional)" defaultValue={b?.imageUrl ?? ""} category="CHECKOUT" />
      <div className="flex items-end justify-between gap-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={b?.active ?? true} /> Ativo no checkout</label>
        <SubmitButton>{b ? "Salvar" : "Criar"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function BumpsPage() {
  const bumps = await db.orderBump.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <>
      <PageHeader title="Order Bumps" description="Ofertas exibidas na etapa de revisão do checkout. O item segue a cor do primeiro kit do pedido." />
      <div className="space-y-4">
        {bumps.map((b) => (
          <Card key={b.id} title={`${b.title} — ${formatBRL(b.priceCents)}${b.active ? "" : " (inativo)"}`} actions={<ConfirmAction action={deleteBump} label="Excluir" danger hidden={{ id: b.id }} />}>
            <BumpForm b={b} />
          </Card>
        ))}
        <Card title="Novo order bump">
          <BumpForm />
        </Card>
      </div>
    </>
  );
}
