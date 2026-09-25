import Link from "next/link";
import type { Metadata } from "next";
import { EmailStatus, EmailType } from "@prisma/client";
import { db } from "@/lib/db";
import { emailProvider } from "@/lib/email/provider";
import { Badge, Card, EmptyState, PageHeader, Pagination, Stat, inputCls } from "@/components/admin/ui";
import { EMAIL_STATUS_LABEL, EMAIL_TYPE_LABEL } from "@/utils/status";
import { formatDate, maskEmail } from "@/utils/format";

export const metadata: Metadata = { title: "E-mails" };
const PAGE_SIZE = 40;

export default async function EmailsPage({ searchParams }: { searchParams: Promise<{ tipo?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = {
    ...((Object.values(EmailType) as string[]).includes(sp.tipo ?? "") ? { type: sp.tipo as EmailType } : {}),
    ...((Object.values(EmailStatus) as string[]).includes(sp.status ?? "") ? { status: sp.status as EmailStatus } : {}),
  };
  const [events, total, counts] = await Promise.all([
    db.emailEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { order: { select: { id: true, orderNumber: true } } } }),
    db.emailEvent.count({ where }),
    db.emailEvent.groupBy({ by: ["status"], _count: true }),
  ]);
  const c = (s: string) => counts.find((x) => x.status === s)?._count ?? 0;
  const provider = emailProvider();

  return (
    <>
      <PageHeader title="E-mails transacionais" description="Confirmação de compra (~15 min após o pagamento), recuperação de PIX (~15 min após gerar, se não pago) e atualizações." />
      {provider === "none" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Provedor de e-mail não configurado: defina <code>EMAIL_PROVIDER</code> (resend | smtp) e as credenciais correspondentes. Os e-mails ficam agendados e são marcados como falha até lá.
        </div>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Provedor" value={provider === "none" ? "—" : provider} />
        <Stat label="Agendados" value={String(c("SCHEDULED"))} />
        <Stat label="Enviados" value={String(c("SENT"))} />
        <Stat label="Falhas" value={String(c("FAILED"))} />
        <Stat label="Não enviados" value={String(c("SKIPPED") + c("CANCELLED"))} hint="pedido pago/expirado antes" />
      </div>
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <select name="tipo" defaultValue={sp.tipo ?? ""} className={`${inputCls} !w-56`}>
          <option value="">Todos os tipos</option>
          {Object.entries(EMAIL_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={`${inputCls} !w-48`}>
          <option value="">Todos os status</option>
          {Object.entries(EMAIL_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Filtrar</button>
      </form>
      {events.length === 0 ? (
        <EmptyState title="Nenhum e-mail registrado" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr><th className="py-2">Tipo</th><th className="py-2">Pedido</th><th className="py-2">Destinatário</th><th className="py-2">Status</th><th className="py-2">Quando</th><th className="py-2">Origem</th><th className="py-2">Detalhe</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2">{EMAIL_TYPE_LABEL[e.type]}</td>
                    <td className="py-2">{e.order ? <Link className="underline" href={`/admin/pedidos/${e.order.id}`}>{e.order.orderNumber}</Link> : "—"}</td>
                    <td className="py-2 text-slate-600">{maskEmail(e.toEmail)}</td>
                    <td className="py-2"><Badge tone={e.status === "SENT" ? "green" : e.status === "FAILED" ? "red" : e.status === "SCHEDULED" ? "amber" : "slate"}>{EMAIL_STATUS_LABEL[e.status]}</Badge></td>
                    <td className="py-2 text-slate-600">{e.sentAt ? formatDate(e.sentAt, true) : `${e.status === "SCHEDULED" ? "para " : ""}${formatDate(e.scheduledFor, true)}`}</td>
                    <td className="py-2 text-slate-600">{e.triggeredBy?.startsWith("admin:") ? "manual" : "automático"}</td>
                    <td className="max-w-[260px] truncate py-2 text-xs text-slate-500" title={e.error ?? e.reason ?? ""}>{e.error ?? e.reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={Math.ceil(total / PAGE_SIZE)} makeHref={(p) => `/admin/emails?page=${p}${sp.tipo ? `&tipo=${sp.tipo}` : ""}${sp.status ? `&status=${sp.status}` : ""}`} />
        </Card>
      )}
    </>
  );
}
