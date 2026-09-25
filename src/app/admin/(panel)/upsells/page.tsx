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

export const metadata: Metadata = { title: "Upsells" };

async function saveUpsell(_: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const admin = await requireAdmin();
  const id = str(fd, "id", 40);
  const price = parseMoney(fd.get("price"));
  const title = str(fd, "title", 120);
  const headline = str(fd, "headline", 160);
  const sku = str(fd, "sku", 40).toUpperCase();
  if (!title || !headline || !sku || price == null || price < 500) return { error: "Informe headline, título, SKU e preço (mínimo R$ 5,00)." };
  const data = { title, headline, sku, priceCents: price, description: optStr(fd, "description", 500), imageUrl: optStr(fd, "imageUrl", 1000), active: bool(fd, "active"), sortOrder: int(fd, "sortOrder", 0) };
  try {
    if (id) await db.upsell.update({ where: { id }, data });
    else await db.upsell.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "SKU já utilizado." };
    throw e;
  }
  await audit(admin.id, id ? "upsell_updated" : "upsell_created", "upsell", id || null, data);
  revalidatePath("/admin/upsells");
  return { ok: true };
}

async function deleteUpsell(_: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const admin = await requireAdmin();
  const id = str(fd, "id", 40);
  await db.upsell.delete({ where: { id } });
  await audit(admin.id, "upsell_deleted", "upsell", id);
  revalidatePath("/admin/upsells");
  return { ok: true, message: "Excluído." };
}

type U = { id: string; sku: string; headline: string; title: string; description: string | null; priceCents: number; imageUrl: string | null; active: boolean; sortOrder: number };

function UpsellForm({ u }: { u?: U }) {
  return (
    <ActionForm action={saveUpsell} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="id" value={u?.id ?? ""} />
      <Field label="Headline" className="md:col-span-2"><input name="headline" defaultValue={u?.headline ?? "Seu banheiro pode ficar ainda mais completo."} required className={inputCls} /></Field>
      <Field label="Título do produto"><input name="title" defaultValue={u?.title} required className={inputCls} /></Field>
      <Field label="SKU"><input name="sku" defaultValue={u?.sku} required className={inputCls} /></Field>
      <Field label="Descrição" className="md:col-span-2"><textarea name="description" defaultValue={u?.description ?? ""} rows={3} className={textareaCls} /></Field>
      <Field label="Preço (R$)"><input name="price" defaultValue={centsToInput(u?.priceCents)} required className={inputCls} inputMode="decimal" /></Field>
      <Field label="Ordem"><input name="sortOrder" type="number" defaultValue={u?.sortOrder ?? 0} className={inputCls} /></Field>
      <ImageField name="imageUrl" label="Imagem (opcional)" defaultValue={u?.imageUrl ?? ""} category="CHECKOUT" />
      <div className="flex items-end justify-between gap-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={u?.active ?? true} /> Ativo</label>
        <SubmitButton>{u ? "Salvar" : "Criar"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function UpsellsPage() {
  const [upsells, stats] = await Promise.all([
    db.upsell.findMany({ orderBy: { sortOrder: "asc" } }),
    db.order.groupBy({ by: ["status"], where: { source: "UPSELL", deletedAt: null }, _count: true, _sum: { totalCents: true } }),
  ]);
  const paid = stats.find((s) => s.status === "PAID");
  const total = stats.reduce((s, x) => s + x._count, 0);
  return (
    <>
      <PageHeader title="Upsells" description="Oferta opcional exibida na página de sucesso após o pagamento. Gera um PIX separado e nunca bloqueia a compra principal." />
      <p className="mb-4 text-sm text-slate-600">
        Upsells aceitos: <strong>{total}</strong> · pagos: <strong>{paid?._count ?? 0}</strong> · receita: <strong>{formatBRL(paid?._sum.totalCents ?? 0)}</strong>. A oferta exibida é a primeira ativa (menor ordem).
      </p>
      <div className="space-y-4">
        {upsells.map((u) => (
          <Card key={u.id} title={`${u.title} — ${formatBRL(u.priceCents)}${u.active ? "" : " (inativo)"}`} actions={<ConfirmAction action={deleteUpsell} label="Excluir" danger hidden={{ id: u.id }} />}>
            <UpsellForm u={u} />
          </Card>
        ))}
        <Card title="Novo upsell">
          <UpsellForm />
        </Card>
      </div>
    </>
  );
}
