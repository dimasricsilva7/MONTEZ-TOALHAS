import { Suspense } from "react";
import type { Metadata } from "next";
import { Card, PageHeader, Stat } from "@/components/admin/ui";
import { HBars } from "@/components/admin/charts";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { OnlineNow } from "@/components/admin/OnlineNow";
import { analyticsOverview, funnel, parsePeriod, trafficSources, utmSources } from "@/server/admin/stats";
import { formatBRL } from "@/utils/format";

export const metadata: Metadata = { title: "Analytics" };

const EVENT_LABEL: Record<string, string> = {
  page_view: "Page views",
  view_product: "Produto visualizado",
  select_color: "Seleção de cor",
  add_to_cart: "Add to cart",
  remove_from_cart: "Remoção do carrinho",
  begin_checkout: "Checkout iniciado",
  view_checkout: "Checkout visualizado",
  add_payment_info: "Dados de pagamento",
  pix_generated: "PIX gerado",
  pix_copy: "PIX copiado",
  pix_qr_view: "QR Code visualizado",
  purchase: "Purchase (PIX pago)",
  checkout_abandoned: "Checkout abandonado (PIX expirado)",
  email_recovery_sent: "E-mail de recuperação enviado",
  email_confirmation_sent: "E-mail de confirmação enviado",
  cta_click: "Cliques em CTAs",
  upsell_view: "Upsell visualizado",
  upsell_accept: "Upsell aceito",
  upsell_decline: "Upsell recusado",
  order_bump_view: "Order bump visualizado",
  order_bump_accept: "Order bump aceito",
};

const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const p = parsePeriod(await searchParams);
  const [a, steps, sources, utms] = await Promise.all([analyticsOverview(p), funnel(p), trafficSources(p), utmSources(p)]);
  const stepPairs = [
    ["view_product", "add_to_cart", "Produto → carrinho"],
    ["add_to_cart", "begin_checkout", "Carrinho → checkout"],
    ["begin_checkout", "pix_generated", "Checkout → PIX"],
    ["pix_generated", "purchase", "PIX → pagamento"],
  ] as const;
  const val = (k: string) => steps.find((s) => s.key === k)?.value ?? 0;

  return (
    <>
      <PageHeader title="Analytics" description={`${p.label} · tracking próprio (sem dependência de terceiros)`} actions={<Suspense><PeriodFilter current={p.key} from={p.fromStr} to={p.toStr} /></Suspense>} />

      <div className="mb-6">
        <OnlineNow detailed />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Agora (5 min)" value={String(a.realtime)} hint="sessões ativas" />
        <Stat label="Visitantes" value={String(a.visitors)} />
        <Stat label="Sessões" value={String(a.sessions)} />
        <Stat label="Page views" value={String(a.pageViews)} />
        <Stat label="Conversão geral" value={pct(steps.at(-1)?.totalRate ?? null)} hint="sessão → pagamento" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Funil de conversão">
          <HBars rows={steps.map((s) => ({ label: s.label, value: s.value, sub: s.totalRate != null ? pct(s.totalRate) : undefined }))} />
          <div className="mt-5 grid grid-cols-2 gap-3">
            {stepPairs.map(([from, to, label]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-lg font-bold tabular-nums">{pct(val(from) ? val(to) / val(from) : null)}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Eventos no período">
          <ul className="grid gap-x-6 text-sm sm:grid-cols-2">
            {Object.entries(EVENT_LABEL).map(([k, label]) => (
              <li key={k} className="flex justify-between border-b border-slate-100 py-1.5">
                <span className="text-slate-600">{label}</span>
                <span className="font-semibold tabular-nums">{a.events[k] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Origem do tráfego">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr><th className="py-2">Origem</th><th className="py-2 text-right">Visitas</th><th className="py-2 text-right">Checkouts</th><th className="py-2 text-right">PIX</th><th className="py-2 text-right">Compras</th><th className="py-2 text-right">Receita</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sources.map((s) => (
                  <tr key={s.channel}><td className="py-2 font-medium">{s.label}</td><td className="py-2 text-right tabular-nums">{s.visits}</td><td className="py-2 text-right tabular-nums">{s.checkouts}</td><td className="py-2 text-right tabular-nums">{s.pix}</td><td className="py-2 text-right tabular-nums">{s.purchases}</td><td className="py-2 text-right tabular-nums">{formatBRL(s.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Campanhas (utm_source / utm_campaign) — vendas pagas">
          <HBars rows={utms.map((u) => ({ label: `${u.utmSource} · ${u.utmCampaign ?? "sem campanha"}`, value: u._sum.totalCents ?? 0, sub: `${u._count} venda(s)` }))} format="brl" empty="Nenhuma venda com UTM no período" />
        </Card>
        <Card title="Páginas mais vistas"><HBars rows={a.topPages.map((x) => ({ label: x.label, value: x.n }))} /></Card>
        <Card title="Cliques em CTAs"><HBars rows={a.ctas.map((x) => ({ label: x.label, value: x.n }))} empty="Nenhum clique registrado" /></Card>
        <Card title="Páginas de entrada"><HBars rows={a.landing.map((x) => ({ label: x.label, value: x.n }))} /></Card>
        <Card title="Páginas de saída"><HBars rows={a.exits.map((x) => ({ label: x.label, value: x.n }))} /></Card>
        <Card title="Dispositivos"><HBars rows={a.devices.map((x) => ({ label: x.label, value: x.n }))} /></Card>
        <Card title="Navegadores"><HBars rows={a.browsers.map((x) => ({ label: x.label, value: x.n }))} /></Card>
      </div>
      <p className="mt-6 text-xs text-slate-500">Nenhum dado pessoal (CPF, e-mail, telefone) é gravado nos eventos de analytics. Sessões são identificadas por IDs anônimos.</p>
    </>
  );
}
