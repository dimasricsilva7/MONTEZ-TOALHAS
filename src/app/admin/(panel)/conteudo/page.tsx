import Link from "next/link";
import type { Metadata } from "next";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { CONTENT_DEFAULTS, CONTENT_GROUPS } from "@/lib/content-defaults";
import { PAGE_DEFAULTS } from "@/lib/page-defaults";
import { Card, Field, PageHeader, btnSecondary, inputCls, textareaCls } from "@/components/admin/ui";
import { ActionForm, SubmitButton, type ActionResult } from "@/components/admin/client";
import { ImageField } from "@/components/admin/media";

export const metadata: Metadata = { title: "Conteúdo" };

async function saveContent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const admin = await requireAdmin();
  const group = CONTENT_GROUPS.find((g) => g.id === fd.get("group"));
  if (!group) return { error: "Grupo inválido." };
  const changed: Record<string, string> = {};
  for (const f of group.fields) {
    const raw = f.type === "boolean" ? (fd.get(f.key) === "on" ? "true" : "false") : String(fd.get(f.key) ?? "");
    const value = raw.slice(0, f.type === "textarea" ? 20000 : 1000);
    if (f.type === "select" && f.options && !f.options.includes(value)) continue;
    await db.siteContent.upsert({ where: { key: f.key }, update: { value, updatedBy: admin.id }, create: { key: f.key, value, updatedBy: admin.id } });
    changed[f.key] = value.slice(0, 80);
  }
  await audit(admin.id, "content_updated", "site_content", group.id, changed);
  revalidateTag("content");
  revalidatePath("/", "layout");
  return { ok: true, message: `${group.title} salvo. A loja já exibe a nova versão.` };
}

async function resetContent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const admin = await requireAdmin();
  const group = CONTENT_GROUPS.find((g) => g.id === fd.get("group"));
  if (!group) return { error: "Grupo inválido." };
  await db.siteContent.deleteMany({ where: { key: { in: group.fields.map((f) => f.key) } } });
  await audit(admin.id, "content_reset", "site_content", group.id);
  revalidateTag("content");
  revalidatePath("/", "layout");
  return { ok: true, message: "Textos padrão restaurados." };
}

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ secao?: string }> }) {
  const { secao } = await searchParams;
  const rows = await db.siteContent.findMany();
  const values: Record<string, string> = { ...CONTENT_DEFAULTS };
  for (const r of rows) values[r.key] = typeof r.value === "string" ? r.value : String(r.value ?? "");
  const active = CONTENT_GROUPS.find((g) => g.id === secao) ?? CONTENT_GROUPS[0];

  return (
    <>
      <PageHeader
        title="Conteúdo do site"
        description="Edite textos, CTAs e imagens sem alterar código. Imagens vêm da biblioteca de mídia."
        actions={
          <>
            <Link href="/admin/conteudo/faq" className={btnSecondary}>FAQ</Link>
            <Link href="/admin/conteudo/avaliacoes" className={btnSecondary}>Avaliações</Link>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Seções">
          {CONTENT_GROUPS.map((g) => (
            <Link key={g.id} href={`/admin/conteudo?secao=${g.id}`} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${g.id === active.id ? "bg-slate-900 font-semibold text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {g.title}
            </Link>
          ))}
        </nav>
        <Card title={active.title}>
          {active.description && <p className="mb-4 text-sm text-slate-500">{active.description}</p>}
          <ActionForm action={saveContent} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="group" value={active.id} />
            {active.fields.map((f) => {
              const v = values[f.key] || (f.key.startsWith("page_") ? PAGE_DEFAULTS[f.key] ?? "" : "");
              if (f.type === "image") return <div key={f.key} className="md:col-span-2"><ImageField name={f.key} label={f.label} defaultValue={v} category={active.id === "hero" ? "HERO" : "LIFESTYLE"} /></div>;
              if (f.type === "boolean")
                return (
                  <label key={f.key} className="flex items-center gap-2 text-sm md:col-span-2">
                    <input type="checkbox" name={f.key} defaultChecked={v === "true"} /> {f.label}
                  </label>
                );
              if (f.type === "select")
                return (
                  <Field key={f.key} label={f.label}>
                    <select name={f.key} defaultValue={v} className={inputCls}>
                      {f.options!.map((o) => (
                        <option key={o} value={o}>{o === "left" ? "Esquerda" : o === "center" ? "Centro" : o === "right" ? "Direita" : o}</option>
                      ))}
                    </select>
                  </Field>
                );
              if (f.type === "textarea")
                return (
                  <Field key={f.key} label={f.label} className="md:col-span-2">
                    <textarea name={f.key} defaultValue={v} rows={f.key.startsWith("page_") ? 18 : 3} className={`${textareaCls} ${f.key.startsWith("page_") ? "font-mono text-[13px]" : ""}`} />
                  </Field>
                );
              return (
                <Field key={f.key} label={f.label}>
                  <input name={f.key} defaultValue={v} className={inputCls} />
                </Field>
              );
            })}
            <div className="md:col-span-2">
              <SubmitButton>Salvar {active.title.toLowerCase()}</SubmitButton>
            </div>
          </ActionForm>
          <div className="mt-6 border-t border-slate-100 pt-4">
            <ActionForm action={resetContent} confirm="Restaurar os textos padrão desta seção?">
              <input type="hidden" name="group" value={active.id} />
              <SubmitButton className={btnSecondary} pendingText="Restaurando…">Restaurar padrão</SubmitButton>
            </ActionForm>
          </div>
        </Card>
      </div>
    </>
  );
}
