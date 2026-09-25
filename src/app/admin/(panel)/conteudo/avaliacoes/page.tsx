import type { Metadata } from "next";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { Card, Field, PageHeader, inputCls, textareaCls } from "@/components/admin/ui";
import { ActionForm, ConfirmAction, SubmitButton, type ActionResult } from "@/components/admin/client";
import { ImageField } from "@/components/admin/media";
import { bool, int, optStr, str } from "@/server/admin/forms";

export const metadata: Metadata = { title: "Avaliações" };

const refresh = () => {
  revalidateTag("reviews");
  revalidatePath("/", "layout");
  revalidatePath("/admin/conteudo/avaliacoes");
};

async function saveReview(_: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const admin = await requireAdmin();
  const id = str(fd, "id", 40);
  const name = str(fd, "name", 80);
  const body = str(fd, "body", 1500);
  const rating = Math.min(5, Math.max(1, int(fd, "rating", 5)));
  if (!name || !body) return { error: "Informe nome e texto da avaliação." };
  if (!bool(fd, "genuine")) return { error: "Confirme que esta é uma avaliação real de um cliente." };
  const data = { name, body, rating, city: optStr(fd, "city", 80), title: optStr(fd, "title", 120), photoUrl: optStr(fd, "photoUrl", 1000), productId: optStr(fd, "productId", 40), active: bool(fd, "active"), sortOrder: int(fd, "sortOrder", 0) };
  if (id) await db.review.update({ where: { id }, data });
  else await db.review.create({ data });
  await audit(admin.id, id ? "review_updated" : "review_created", "review", id || null, { name, rating });
  refresh();
  return { ok: true };
}

async function deleteReview(_: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const admin = await requireAdmin();
  const id = str(fd, "id", 40);
  await db.review.delete({ where: { id } });
  await audit(admin.id, "review_deleted", "review", id);
  refresh();
  return { ok: true, message: "Avaliação excluída." };
}

type R = { id: string; name: string; city: string | null; rating: number; title: string | null; body: string; photoUrl: string | null; productId: string | null; active: boolean; sortOrder: number };

function ReviewForm({ r, products }: { r?: R; products: { id: string; commercialName: string }[] }) {
  return (
    <ActionForm action={saveReview} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="id" value={r?.id ?? ""} />
      <Field label="Nome"><input name="name" defaultValue={r?.name} required className={inputCls} /></Field>
      <Field label="Cidade/UF"><input name="city" defaultValue={r?.city ?? ""} className={inputCls} /></Field>
      <Field label="Nota">
        <select name="rating" defaultValue={r?.rating ?? 5} className={inputCls}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>{n} estrela(s)</option>
          ))}
        </select>
      </Field>
      <Field label="Produto (opcional)">
        <select name="productId" defaultValue={r?.productId ?? ""} className={inputCls}>
          <option value="">Geral</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.commercialName}</option>
          ))}
        </select>
      </Field>
      <Field label="Título (opcional)" className="md:col-span-2"><input name="title" defaultValue={r?.title ?? ""} className={inputCls} /></Field>
      <Field label="Texto" className="md:col-span-2"><textarea name="body" defaultValue={r?.body} required rows={3} className={textareaCls} /></Field>
      <ImageField name="photoUrl" label="Foto (opcional, com autorização do cliente)" defaultValue={r?.photoUrl ?? ""} category="DEPOIMENTOS" />
      <div className="space-y-2 text-sm">
        <Field label="Ordem"><input name="sortOrder" type="number" defaultValue={r?.sortOrder ?? 0} className={`${inputCls} !w-24`} /></Field>
        <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={r?.active ?? true} /> Exibir na loja</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="genuine" defaultChecked={Boolean(r)} required /> Confirmo que é uma avaliação real de cliente</label>
        <SubmitButton>{r ? "Salvar" : "Adicionar avaliação"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function ReviewsAdmin() {
  const [reviews, products] = await Promise.all([
    db.review.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
    db.product.findMany({ select: { id: true, commercialName: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Avaliações" description="A seção de avaliações só aparece na loja quando houver avaliações reais ativas. Nunca cadastre depoimentos inventados." />
      <div className="space-y-4">
        {reviews.map((r) => (
          <Card key={r.id} title={`${r.name} — ${"★".repeat(r.rating)}${r.active ? "" : " (oculta)"}`} actions={<ConfirmAction action={deleteReview} label="Excluir" danger hidden={{ id: r.id }} />}>
            <ReviewForm r={r} products={products} />
          </Card>
        ))}
        <Card title="Nova avaliação">
          <ReviewForm products={products} />
        </Card>
      </div>
    </>
  );
}
