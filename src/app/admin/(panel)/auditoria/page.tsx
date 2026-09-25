import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { Card, EmptyState, PageHeader, Pagination, inputCls } from "@/components/admin/ui";
import { formatDate } from "@/utils/format";

export const metadata: Metadata = { title: "Auditoria" };
const PAGE_SIZE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ acao?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.acao ? { action: sp.acao } : {};
  const [logs, total, actions] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { admin: { select: { email: true } } } }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ["action"], _count: true, orderBy: { action: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Auditoria" description="Registro de logins, alterações de produtos, conteúdo, configurações, pedidos e e-mails." />
      <form className="mb-4 flex gap-2" method="get">
        <select name="acao" defaultValue={sp.acao ?? ""} className={`${inputCls} !w-64`}>
          <option value="">Todas as ações</option>
          {actions.map((a) => <option key={a.action} value={a.action}>{a.action} ({a._count})</option>)}
        </select>
        <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Filtrar</button>
      </form>
      {logs.length === 0 ? (
        <EmptyState title="Sem registros" />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="grid gap-1 py-2.5 md:grid-cols-[170px_200px_1fr]">
                <span className="text-slate-500">{formatDate(l.createdAt, true)}</span>
                <span className="font-medium text-slate-900">{l.action}</span>
                <span className="min-w-0 text-slate-600">
                  {l.admin?.email ?? "sistema/anônimo"}
                  {l.entity && (
                    <>
                      {" · "}
                      {l.entity === "order" && l.entityId ? <Link className="underline" href={`/admin/pedidos/${l.entityId}`}>pedido</Link> : l.entity}
                    </>
                  )}
                  {l.details && <code className="ml-2 block truncate text-xs text-slate-400 md:inline">{JSON.stringify(l.details).slice(0, 180)}</code>}
                </span>
              </li>
            ))}
          </ul>
          <Pagination page={page} pages={Math.ceil(total / PAGE_SIZE)} makeHref={(p) => `/admin/auditoria?page=${p}${sp.acao ? `&acao=${sp.acao}` : ""}`} />
        </Card>
      )}
    </>
  );
}
