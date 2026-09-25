import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { Badge, EmptyState, ORDER_TONE, PageHeader, Pagination, btnSecondary, inputCls } from "@/components/admin/ui";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { parsePeriod } from "@/server/admin/stats";
import { formatBRL, formatDate, maskCpfForList } from "@/utils/format";
import { ORDER_STATUS_LABEL } from "@/utils/status";
import { CHANNELS, CHANNEL_LABEL } from "@/utils/channel";
import { onlyDigits } from "@/utils/validators";

export const metadata: Metadata = { title: "Pedidos" };
const PAGE_SIZE = 25;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const hasPeriod = Boolean(sp.periodo);
  const p = parsePeriod(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim().slice(0, 100) ?? "";
  const digits = onlyDigits(q);

  const where: Prisma.OrderWhereInput = {
    deletedAt: sp.excluidos === "1" ? { not: null } : null,
    ...(sp.status ? { status: sp.status as Prisma.EnumOrderStatusFilter["equals"] } : {}),
    ...(hasPeriod ? { createdAt: { gte: p.from, lt: p.to } } : {}),
    ...(sp.origem ? { channel: sp.origem } : {}),
    AND: [
      ...(sp.produto ? [{ items: { some: { productId: sp.produto } } }] : []),
      ...(sp.cor ? [{ items: { some: { colorName: sp.cor } } }] : []),
    ],
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q.toUpperCase() } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { customer: { email: { contains: q.toLowerCase() } } },
            ...(digits.length >= 3 ? [{ customer: { cpf: { contains: digits } } }, { customer: { phone: { contains: digits } } }] : []),
          ],
        }
      : {}),
  };
  const sort = sp.ordem === "antigos" ? { createdAt: "asc" as const } : sp.ordem === "valor" ? { totalCents: "desc" as const } : { createdAt: "desc" as const };

  const [orders, total, products, colors] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: sort,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { customer: { select: { name: true, cpf: true } }, items: { orderBy: { kind: "asc" } } },
    }),
    db.order.count({ where }),
    db.product.findMany({ select: { id: true, commercialName: true }, orderBy: { sortOrder: "asc" } }),
    db.color.findMany({ select: { commercialName: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const pages = Math.ceil(total / PAGE_SIZE);
  const href = (pg: number) => {
    const n = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    n.set("page", String(pg));
    return `/admin/pedidos?${n.toString()}`;
  };

  return (
    <>
      <PageHeader title="Pedidos" description={`${total} pedido(s)${hasPeriod ? ` · ${p.label}` : ""}`} actions={<Suspense><PeriodFilter current={hasPeriod ? p.key : ""} from={p.fromStr} to={p.toStr} /></Suspense>} />

      <form className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-7" method="get">
        {sp.periodo && <input type="hidden" name="periodo" value={sp.periodo} />}
        {sp.de && <input type="hidden" name="de" value={sp.de} />}
        {sp.ate && <input type="hidden" name="ate" value={sp.ate} />}
        <input name="q" defaultValue={q} placeholder="Nome, CPF, e-mail ou nº do pedido" className={`${inputCls} lg:col-span-2`} />
        <select name="status" defaultValue={sp.status ?? ""} className={inputCls} aria-label="Status">
          <option value="">Todos os status</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="produto" defaultValue={sp.produto ?? ""} className={inputCls} aria-label="Produto">
          <option value="">Todos os produtos</option>
          {products.map((x) => (
            <option key={x.id} value={x.id}>{x.commercialName}</option>
          ))}
        </select>
        <select name="cor" defaultValue={sp.cor ?? ""} className={inputCls} aria-label="Cor">
          <option value="">Todas as cores</option>
          {colors.map((c) => (
            <option key={c.commercialName} value={c.commercialName}>{c.commercialName}</option>
          ))}
        </select>
        <select name="origem" defaultValue={sp.origem ?? ""} className={inputCls} aria-label="Origem">
          <option value="">Todas as origens</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <select name="ordem" defaultValue={sp.ordem ?? ""} className={inputCls} aria-label="Ordenação">
            <option value="">Mais recentes</option>
            <option value="antigos">Mais antigos</option>
            <option value="valor">Maior valor</option>
          </select>
          <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Filtrar</button>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 lg:col-span-7">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="excluidos" value="1" defaultChecked={sp.excluidos === "1"} /> Mostrar excluídos
          </label>
          <Link href="/admin/pedidos" className="underline">Limpar filtros</Link>
        </div>
      </form>

      {orders.length === 0 ? (
        <EmptyState title="Nenhum pedido encontrado" text="Ajuste os filtros ou aguarde os primeiros pedidos." />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Cor</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => {
                  const main = o.items.find((i) => i.kind === "PRODUCT") ?? o.items[0];
                  return (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{o.orderNumber}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(o.createdAt, true)}</td>
                      <td className="px-4 py-3">
                        <span className="block max-w-[180px] truncate">{o.customer.name}</span>
                        <span className="text-xs text-slate-500">{maskCpfForList(o.customer.cpf)}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {main?.productNameSnapshot.split(" — ").pop()}
                        {o.items.length > 1 && <span className="ml-1 text-xs text-slate-500">+{o.items.length - 1}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          {main?.colorHex && <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: main.colorHex }} />}
                          {main?.colorName ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatBRL(o.totalCents)}</td>
                      <td className="px-4 py-3 text-slate-600">{CHANNEL_LABEL[(o.channel ?? "direto") as keyof typeof CHANNEL_LABEL] ?? o.channel}</td>
                      <td className="px-4 py-3 text-slate-600">{o.paymentMethod}</td>
                      <td className="px-4 py-3">
                        <Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                        {o.deletedAt && <Badge tone="red">Excluído</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/pedidos/${o.id}`} className={`${btnSecondary} !h-8 !px-3 text-xs`}>Detalhes</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <ul className="space-y-3 md:hidden">
            {orders.map((o) => {
              const main = o.items.find((i) => i.kind === "PRODUCT") ?? o.items[0];
              return (
                <li key={o.id}>
                  <Link href={`/admin/pedidos/${o.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{o.orderNumber}</span>
                      <Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{o.customer.name}</p>
                    <p className="text-xs text-slate-500">
                      {main?.productNameSnapshot.split(" — ").pop()} · {main?.colorName} · {formatDate(o.createdAt, true)}
                    </p>
                    <p className="mt-2 text-right font-semibold tabular-nums">{formatBRL(o.totalCents)}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} pages={pages} makeHref={href} />
        </>
      )}
    </>
  );
}
