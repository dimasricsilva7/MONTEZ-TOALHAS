import type { Metadata } from "next";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { Card, Field, PageHeader, inputCls, textareaCls } from "@/components/admin/ui";
import { ActionForm, ConfirmAction, SubmitButton, type ActionResult } from "@/components/admin/client";
import { bool, int, str } from "@/server/admin/forms";

export const metadata: Metadata = { title: "FAQ" };

const refresh = () => {
  revalidateTag("faq");
  revalidatePath("/", "layout");
  revalidatePath("/admin/conteudo/faq");
};

async function saveFaq(_: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const admin = await requireAdmin();
  const id = str(fd, "id", 40);
  const question = str(fd, "question", 300);
  const answer = str(fd, "answer", 4000);
  if (!question || !answer) return { error: "Informe pergunta e resposta." };
  const data = { question, answer, active: bool(fd, "active"), sortOrder: int(fd, "sortOrder", 0) };
  if (id) await db.faq.update({ where: { id }, data });
  else await db.faq.create({ data });
  await audit(admin.id, id ? "faq_updated" : "faq_created", "faq", id || null, { question });
  refresh();
  return { ok: true };
}

async function deleteFaq(_: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const admin = await requireAdmin();
  const id = str(fd, "id", 40);
  await db.faq.delete({ where: { id } });
  await audit(admin.id, "faq_deleted", "faq", id);
  refresh();
  return { ok: true, message: "Pergunta excluída." };
}

type F = { id: string; question: string; answer: string; active: boolean; sortOrder: number };

function FaqForm({ f }: { f?: F }) {
  return (
    <ActionForm action={saveFaq} className="grid gap-3" resetOnSuccess={!f}>
      <input type="hidden" name="id" value={f?.id ?? ""} />
      <Field label="Pergunta"><input name="question" defaultValue={f?.question} required className={inputCls} /></Field>
      <Field label="Resposta"><textarea name="answer" defaultValue={f?.answer} required rows={4} className={textareaCls} /></Field>
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Ordem"><input name="sortOrder" type="number" defaultValue={f?.sortOrder ?? 99} className={`${inputCls} !w-24`} /></Field>
        <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={f?.active ?? true} /> Ativa</label>
        <SubmitButton>{f ? "Salvar" : "Adicionar pergunta"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function FaqAdmin() {
  const faqs = await db.faq.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <>
      <PageHeader title="FAQ" description="Perguntas exibidas na home, nas páginas de produto e em /faq (com dados estruturados FAQPage)." />
      <div className="space-y-4">
        {faqs.map((f) => (
          <Card key={f.id} title={`${f.sortOrder}. ${f.question}${f.active ? "" : " (inativa)"}`} actions={<ConfirmAction action={deleteFaq} label="Excluir" danger hidden={{ id: f.id }} />}>
            <FaqForm f={f} />
          </Card>
        ))}
        <Card title="Nova pergunta">
          <FaqForm />
        </Card>
      </div>
    </>
  );
}
