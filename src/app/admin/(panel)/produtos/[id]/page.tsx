import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { Card, Field, PageHeader, btnSecondary, inputCls, textareaCls } from "@/components/admin/ui";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/admin/client";
import { ImageField } from "@/components/admin/media";
import { centsToInput } from "@/server/admin/forms";
import { addProductImageAction, deleteProductAction, moveProductImageAction, removeProductImageAction, saveProductAction } from "../actions";
import { PiecesEditor, SpecsEditor } from "../editors";
import type { KitPiece } from "@/types/catalog";

export const metadata: Metadata = { title: "Editar produto" };

export default async function ProductEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "novo";
  const [product, colors] = await Promise.all([
    isNew ? null : db.product.findUnique({ where: { id }, include: { variants: true, images: { include: { media: true, color: true }, orderBy: { sortOrder: "asc" } } } }),
    db.color.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!isNew && !product) notFound();
  const p = product;

  return (
    <>
      <PageHeader
        title={isNew ? "Novo produto" : p!.commercialName}
        description={isNew ? undefined : `${p!.name} · ${p!.sku}`}
        actions={
          <>
            {!isNew && (
              <Link href={`/produto/${p!.slug}`} target="_blank" className={btnSecondary}>
                Ver na loja
              </Link>
            )}
            <Link href="/admin/produtos" className={btnSecondary}>Voltar</Link>
          </>
        }
      />

      <ActionForm action={saveProductAction} className="grid gap-6 xl:grid-cols-3">
        <input type="hidden" name="id" value={p?.id ?? ""} />
        <div className="space-y-6 xl:col-span-2">
          <Card title="Informações">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome (ex.: MONTEZ M6)"><input name="name" defaultValue={p?.name} required className={inputCls} /></Field>
              <Field label="Nome comercial"><input name="commercialName" defaultValue={p?.commercialName} required className={inputCls} /></Field>
              <Field label="Slug (URL)" hint="/produto/[slug]"><input name="slug" defaultValue={p?.slug} className={inputCls} /></Field>
              <Field label="SKU"><input name="sku" defaultValue={p?.sku} required className={inputCls} /></Field>
              <Field label="Subtítulo"><input name="subtitle" defaultValue={p?.subtitle ?? ""} className={inputCls} /></Field>
              <Field label="Frase ('Para quem')"><input name="tagline" defaultValue={p?.tagline ?? ""} className={inputCls} /></Field>
              <Field label="Descrição curta" className="md:col-span-2"><textarea name="shortDescription" defaultValue={p?.shortDescription ?? ""} rows={2} className={textareaCls} /></Field>
              <Field label="Descrição" className="md:col-span-2"><textarea name="description" defaultValue={p?.description ?? ""} rows={6} className={textareaCls} /></Field>
            </div>
          </Card>

          <Card title="Peças do kit">
            <PiecesEditor initial={((p?.pieces as unknown as KitPiece[]) ?? []) as KitPiece[]} />
          </Card>

          <Card title="Especificações técnicas">
            <div className="mb-4 grid gap-4 md:grid-cols-3">
              <Field label="Composição"><input name="composition" defaultValue={p?.composition ?? ""} className={inputCls} /></Field>
              <Field label="Gramatura"><input name="weight" defaultValue={p?.weight ?? ""} className={inputCls} /></Field>
              <Field label="Quantidade de peças"><input name="pieceCount" type="number" min={1} defaultValue={p?.pieceCount ?? 1} className={inputCls} /></Field>
              <Field label="Dimensões (resumo)" className="md:col-span-3"><input name="dimensions" defaultValue={p?.dimensions ?? ""} className={inputCls} /></Field>
            </div>
            <SpecsEditor initial={((p?.specs as unknown as { label: string; value: string }[]) ?? []) as { label: string; value: string }[]} />
          </Card>

          <Card title="Cores e estoque por variante">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Cor</th>
                    <th className="py-2">Disponível</th>
                    <th className="py-2">Estoque</th>
                    <th className="py-2">SKU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {colors.map((c) => {
                    const v = p?.variants.find((x) => x.colorId === c.id);
                    return (
                      <tr key={c.id}>
                        <td className="py-2">
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} />
                            {c.commercialName} {!c.active && <span className="text-xs text-slate-400">(cor inativa)</span>}
                          </span>
                        </td>
                        <td className="py-2"><input type="checkbox" name={`variant_${c.id}_active`} defaultChecked={v ? v.active : isNew} aria-label={`Disponível em ${c.commercialName}`} /></td>
                        <td className="py-2"><input type="number" min={0} name={`variant_${c.id}_stock`} defaultValue={v?.stockQuantity ?? 0} className={`${inputCls} !w-24`} aria-label={`Estoque ${c.commercialName}`} /></td>
                        <td className="py-2 font-mono text-xs text-slate-500">{v?.sku ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="SEO">
            <div className="grid gap-4">
              <Field label="Título SEO"><input name="seoTitle" defaultValue={p?.seoTitle ?? ""} className={inputCls} maxLength={120} /></Field>
              <Field label="Descrição SEO"><textarea name="seoDescription" defaultValue={p?.seoDescription ?? ""} rows={2} className={textareaCls} maxLength={300} /></Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Preço">
            <div className="grid gap-4">
              <Field label="Preço (R$)"><input name="price" inputMode="decimal" defaultValue={centsToInput(p?.priceCents)} required className={inputCls} /></Field>
              <Field label="Preço anterior (opcional)" hint="Somente se for um preço real praticado anteriormente."><input name="compareAt" inputMode="decimal" defaultValue={centsToInput(p?.compareAtPriceCents)} className={inputCls} /></Field>
            </div>
          </Card>
          <Card title="Exibição">
            <div className="grid gap-3 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={p?.active ?? true} /> Ativo na loja</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={p?.featured ?? false} /> Destaque</label>
              <Field label="Selo (ex.: Mais vendido)"><input name="badge" defaultValue={p?.badge ?? ""} className={inputCls} /></Field>
              <Field label="Ordem"><input name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} className={inputCls} /></Field>
              <Field label="Tipo">
                <select name="kind" defaultValue={p?.kind ?? "KIT"} className={inputCls}>
                  <option value="KIT">Kit</option>
                  <option value="PIECE">Peça avulsa</option>
                </select>
              </Field>
            </div>
          </Card>
          <Card title="Estoque">
            <div className="grid gap-3 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="allowBackorder" defaultChecked={p?.allowBackorder ?? true} /> Permitir venda sem estoque</label>
              <Field label="Alerta de estoque baixo"><input name="lowStockThreshold" type="number" min={0} defaultValue={p?.lowStockThreshold ?? 5} className={inputCls} /></Field>
              <Field label="Estoque geral (referência)"><input name="stockQuantity" type="number" min={0} defaultValue={p?.stockQuantity ?? 0} className={inputCls} /></Field>
              <p className="text-xs text-slate-500">A baixa de estoque acontece por variante (cor) quando o pagamento é confirmado.</p>
            </div>
          </Card>
          <div className="sticky bottom-4 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <SubmitButton className="h-11 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white">Salvar produto</SubmitButton>
          </div>
        </div>
      </ActionForm>

      {!isNew && p && (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Card title="Imagens do produto" className="xl:col-span-2">
            <p className="mb-4 text-sm text-slate-500">Sem imagens, a loja exibe a ilustração vetorial na cor escolhida. Imagens associadas a uma cor aparecem quando o cliente seleciona essa cor.</p>
            {p.images.length > 0 && (
              <ul className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {p.images.map((img, i) => (
                  <li key={img.id} className="overflow-hidden rounded-lg border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.media.url} alt={img.media.alt} className="aspect-square w-full object-cover" />
                    <div className="flex items-center justify-between gap-1 p-2 text-xs">
                      <span>
                        {i + 1}. {img.color?.commercialName ?? "Todas as cores"} · {img.device === "ALL" ? "todos" : img.device.toLowerCase()}
                      </span>
                      <span className="flex gap-1">
                        <ActionForm action={moveProductImageAction} className="">
                          <input type="hidden" name="imageId" value={img.id} />
                          <input type="hidden" name="dir" value="up" />
                          <button className="rounded px-1.5 hover:bg-slate-100" aria-label="Mover para cima">↑</button>
                        </ActionForm>
                        <ActionForm action={removeProductImageAction} className="">
                          <input type="hidden" name="imageId" value={img.id} />
                          <button className="rounded px-1.5 text-red-600 hover:bg-red-50">Remover</button>
                        </ActionForm>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addProductImageAction} className="grid items-end gap-4 md:grid-cols-[1fr_180px_140px_auto]">
              <input type="hidden" name="productId" value={p.id} />
              <ImageField name="url" label="Imagem" category="PRODUTO" />
              <Field label="Cor">
                <select name="colorId" className={inputCls}>
                  <option value="">Todas as cores</option>
                  {colors.map((c) => (
                    <option key={c.id} value={c.id}>{c.commercialName}</option>
                  ))}
                </select>
              </Field>
              <Field label="Dispositivo">
                <select name="device" className={inputCls}>
                  <option value="ALL">Todos</option>
                  <option value="DESKTOP">Desktop</option>
                  <option value="MOBILE">Mobile</option>
                </select>
              </Field>
              <SubmitButton>Adicionar</SubmitButton>
            </ActionForm>
          </Card>
          <Card title="Excluir">
            <ConfirmAction action={deleteProductAction} label="Excluir produto" danger confirmLabel="Excluir" description="Produtos com pedidos são apenas desativados, para preservar o histórico." hidden={{ id: p.id }} />
          </Card>
        </div>
      )}
    </>
  );
}
