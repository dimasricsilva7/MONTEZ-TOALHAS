import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { Badge, EmptyState, PageHeader, btnPrimary, btnSecondary } from "@/components/admin/ui";
import { formatBRL, formatDate } from "@/utils/format";

export const metadata: Metadata = { title: "Produtos" };

export default async function ProductsPage() {
  const products = await db.product.findMany({ orderBy: [{ sortOrder: "asc" }], include: { variants: { where: { active: true } } } });
  return (
    <>
      <PageHeader title="Produtos" description="Kits e peças da loja. Preços, estoque e conteúdo são editáveis." actions={<Link href="/admin/produtos/novo" className={btnPrimary}>Novo produto</Link>} />
      {products.length === 0 ? (
        <EmptyState title="Nenhum produto" action={<Link href="/admin/produtos/novo" className={btnPrimary}>Criar produto</Link>} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3 text-right">Preço</th>
                <th className="px-4 py-3 text-right">Estoque</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Destaque</th>
                <th className="px-4 py-3">Atualizado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const stock = p.variants.reduce((s, v) => s + v.stockQuantity, 0);
                const low = p.variants.filter((v) => v.stockQuantity <= p.lowStockThreshold).length;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-slate-900">{p.commercialName}</span>
                      <span className="text-xs text-slate-500">{p.name} · {p.sku} · {p.variants.length} cores</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatBRL(p.priceCents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {stock}
                      {p.allowBackorder ? <span className="block text-xs text-slate-500">venda sem estoque ativa</span> : low > 0 ? <span className="block text-xs text-amber-700">{low} cor(es) com estoque baixo</span> : null}
                    </td>
                    <td className="px-4 py-3">{p.active ? <Badge tone="green">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                    <td className="px-4 py-3">{p.featured ? <Badge tone="blue">{p.badge ?? "Destaque"}</Badge> : "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(p.updatedAt, true)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/produtos/${p.id}`} className={`${btnSecondary} !h-8 !px-3 text-xs`}>Editar</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
