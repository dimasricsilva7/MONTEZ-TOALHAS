import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { Badge, Card, ORDER_TONE, PageHeader, Stat } from "@/components/admin/ui";
import { DayBars, HBars } from "@/components/admin/charts";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { dailySeries, dashboardStats, funnel, parsePeriod, productBreakdown, trafficSources } from "@/server/admin/stats";
import { envHealth } from "@/lib/env";
import { formatBRL, formatDate } from "@/utils/format";
import { ORDER_STATUS_LABEL } from "@/utils/status";

export const metadata: Metadata = { title: "Dashboard" };

const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(v < 0.1 ? 2 : 1).replace(".", ",")}%`);

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = parsePeriod(await searchParams);
  const [s, days, breakdown, steps, sources, recent] = await Promise.all([
    dashboardStats(p),
    dailySeries(p),
    productBreakdown(p),
    funnel(p),
    trafficSources(p),
    db.order.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 8, include: { customer: { select: { name: true } }, items: { where: { kind: "PRODUCT" }, take: 1 } } }),
  ]);
  const missing = envHealth().filter((e) => e.required && !e.ok);

  return (
    <>
      <PageHeader title="Dashboard" description={`${p.label} · fuso de Brasília`} actions={<Suspense><PeriodFilter current={p.key} from={p.fromStr} to={p.toStr} /></Suspense>} />

      {missing.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Configuração pendente:</strong> {missing.map((m) => m.key).join(", ")}.{" "}
          <Link href="/admin/configuracoes" className="underline">Ver detalhes</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Faturamento" value={formatBRL(s.revenue)} hint={`${s.paid} pedido(s) pago(s)`} />
        <Stat label="Pedidos gerados" value={String(s.generated)} hint={`${s.pixGenerated} PIX gerado(s)`} />
        <Stat label="Pedidos pagos" value={String(s.paid)} hint={`Conversão PIX: ${pct(s.pixConversion)}`} />
        <Stat label="Pedidos pendentes" value={String(s.pending)} />
        <Stat label="Pedidos expirados" value={String(s.expired)} />
        <Stat label="Ticket médio" value={s.paid ? formatBRL(s.avgTicket) : "—"} />
        <Stat label="Taxa de conversão" value={pct(s.conversion)} hint={`${s.sessions} sessões · ${s.visitors} visitantes`} />
        <Stat label="Receita líquida" value={s.net != null && s.paid ? formatBRL(s.net) : "—"} hint={s.netPartial ? "Parcial: nem toda transação informou taxa" : s.fees ? `Taxas: ${formatBRL(s.fees)}` : "Informada pela BravoPay"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Receita por dia (pedidos pagos)">
          <DayBars data={days.map((d) => ({ day: d.day, values: [d.revenue] }))} series={["Receita"]} format="brlShort" />
        </Card>
        <Card title="PIX gerado × PIX pago por dia">
          <DayBars data={days.map((d) => ({ day: d.day, values: [d.pix, d.paid] }))} series={["PIX gerados", "PIX pagos"]} format="number" />
        </Card>
        <Card title="Pedidos por dia">
          <DayBars data={days.map((d) => ({ day: d.day, values: [d.orders] }))} series={["Pedidos"]} format="number" />
        </Card>
        <Card title="Funil de conversão">
          <HBars
            rows={steps.map((st) => ({ label: st.label, value: st.value, sub: st.stepRate != null ? `${pct(st.stepRate)} da etapa anterior` : undefined }))}
          />
          <p className="mt-3 text-xs text-slate-500">
            Conversão geral (visitante → pagamento): <strong className="text-slate-800">{pct(steps.at(-1)?.totalRate ?? null)}</strong>
          </p>
        </Card>
        <Card title="Kits e produtos vendidos">
          <HBars rows={breakdown.products.map((r) => ({ label: r.name, value: r.qty, sub: formatBRL(r.revenue) }))} format="units" />
        </Card>
        <Card title="Cores mais vendidas">
          <HBars rows={breakdown.colors.map((r) => ({ label: r.name, value: r.qty, swatch: r.hex }))} format="kits" />
        </Card>
      </div>

      <Card title="Origem das vendas" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3">Origem</th>
                <th className="py-2 pr-3 text-right">Visitas</th>
                <th className="py-2 pr-3 text-right">Checkouts</th>
                <th className="py-2 pr-3 text-right">PIX gerados</th>
                <th className="py-2 pr-3 text-right">Compras</th>
                <th className="py-2 text-right">Receita</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.map((r) => (
                <tr key={r.channel}>
                  <td className="py-2.5 pr-3 font-medium text-slate-800">{r.label}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{r.visits}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{r.checkouts}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{r.pix}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{r.purchases}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">{formatBRL(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">ROAS não é calculado: não há dados de custo de mídia integrados.</p>
      </Card>

      <Card title="Vendas recentes" className="mt-6" actions={<Link href="/admin/pedidos" className="text-sm font-medium text-slate-600 hover:text-slate-900">Ver todas</Link>}>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nenhum pedido ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/pedidos/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{o.orderNumber}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {o.customer.name} · {o.items[0]?.productNameSnapshot ?? "—"} {o.items[0]?.colorName ? `· ${o.items[0].colorName}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{formatDate(o.createdAt, true)}</span>
                    <Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                    <span className="w-24 text-right text-sm font-semibold tabular-nums">{formatBRL(o.totalCents)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
