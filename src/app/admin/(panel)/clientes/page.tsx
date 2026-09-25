import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { EmptyState, PageHeader, Pagination, inputCls } from "@/components/admin/ui";
import { formatBRL, formatDate, maskCpfForList, formatPhone } from "@/utils/format";
import { onlyDigits } from "@/utils/validators";

export const metadata: Metadata = { title: "Clientes" };
const PAGE_SIZE = 30;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 100) ?? "";
  const digits = onlyDigits(q);
  const page = Math.max(1, Number(sp.page) || 1);
  const where = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q.toLowerCase() } }, ...(digits.length >= 3 ? [{ cpf: { contains: digits } }, { phone: { contains: digits } }] : [])] }
    : {};
  const [customers, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { orders: { where: { deletedAt: null }, select: { id: true, status: true, totalCents: true, createdAt: true, orderNumber: true }, orderBy: { createdAt: "desc" } } },
    }),
    db.customer.count({ where }),
  ]);
  return (
    <>
      <PageHeader title="Clientes" description={`${total} cliente(s). CPF mascarado nas listas (LGPD) — dados completos no detalhe do pedido.`} />
      <form className="mb-4 flex gap-2" method="get">
        <input name="q" defaultValue={q} placeholder="Nome, e-mail, CPF ou telefone" className={`${inputCls} max-w-sm`} />
        <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Buscar</button>
      </form>
      {customers.length === 0 ? (
        <EmptyState title="Nenhum cliente ainda" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3 text-right">Pedidos</th>
                <th className="px-4 py-3 text-right">Total pago</th>
                <th className="px-4 py-3">Último pedido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => {
                const paid = c.orders.filter((o) => o.status === "PAID");
                const last = c.orders[0];
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-slate-900">{c.name}</span>
                      <span className="text-xs text-slate-500">{maskCpfForList(c.cpf)} · desde {formatDate(c.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.email}
                      <span className="block text-xs">{formatPhone(c.phone)}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {paid.length}/{c.orders.length}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatBRL(paid.reduce((s, o) => s + o.totalCents, 0))}</td>
                    <td className="px-4 py-3">
                      {last ? (
                        <Link className="underline" href={`/admin/pedidos/${last.id}`}>
                          {last.orderNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={Math.ceil(total / PAGE_SIZE)} makeHref={(p) => `/admin/clientes?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
    </>
  );
}
