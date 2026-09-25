import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CHANNELS, CHANNEL_LABEL, type Channel } from "@/utils/channel";

// ───────────── Período (fuso de Brasília, UTC−3 fixo desde 2019) ─────────────

const BRT_OFFSET_MS = 3 * 3600_000;
export type PeriodKey = "today" | "yesterday" | "7d" | "30d" | "custom";
export type Period = { key: PeriodKey; from: Date; to: Date; label: string; fromStr: string; toStr: string };

const brtDateStr = (d: Date) => new Date(d.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10);
const brtStartOf = (ymd: string) => new Date(new Date(`${ymd}T00:00:00.000Z`).getTime() + BRT_OFFSET_MS);
const addDays = (ymd: string, n: number) => new Date(new Date(`${ymd}T12:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10);

export function parsePeriod(sp: Record<string, string | string[] | undefined>): Period {
  const key = (typeof sp.periodo === "string" ? sp.periodo : "7d") as PeriodKey;
  const today = brtDateStr(new Date());
  const mk = (k: PeriodKey, fromYmd: string, toYmd: string, label: string): Period => ({
    key: k,
    from: brtStartOf(fromYmd),
    to: brtStartOf(addDays(toYmd, 1)),
    label,
    fromStr: fromYmd,
    toStr: toYmd,
  });
  switch (key) {
    case "today":
      return mk("today", today, today, "Hoje");
    case "yesterday": {
      const y = addDays(today, -1);
      return mk("yesterday", y, y, "Ontem");
    }
    case "30d":
      return mk("30d", addDays(today, -29), today, "Últimos 30 dias");
    case "custom": {
      const valid = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
      const f = valid(sp.de) ? (sp.de as string) : addDays(today, -6);
      let t = valid(sp.ate) ? (sp.ate as string) : today;
      if (t < f) t = f;
      return mk("custom", f, t, `${f.split("-").reverse().join("/")} a ${t.split("-").reverse().join("/")}`);
    }
    default:
      return mk("7d", addDays(today, -6), today, "Últimos 7 dias");
  }
}

export function daysOf(p: Period): string[] {
  const out: string[] = [];
  for (let d = p.fromStr; d <= p.toStr && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

// ───────────── Dashboard ─────────────

const notDeleted = { deletedAt: null } satisfies Prisma.OrderWhereInput;

export async function dashboardStats(p: Period) {
  const created = { ...notDeleted, createdAt: { gte: p.from, lt: p.to } };
  const paidIn = { ...notDeleted, status: "PAID" as const, paidAt: { gte: p.from, lt: p.to } };

  const [generated, pixGenerated, pending, expired, paidAgg, cohortPaid, visitorsRow, sessions, netNulls] = await Promise.all([
    db.order.count({ where: created }),
    db.order.count({ where: { ...created, pixCopyPaste: { not: null } } }),
    db.order.count({ where: { ...created, status: "PENDING_PAYMENT" } }),
    db.order.count({ where: { ...created, status: "EXPIRED" } }),
    db.order.aggregate({ where: paidIn, _count: true, _sum: { totalCents: true, netCents: true, feeCents: true } }),
    db.order.count({ where: { ...created, status: "PAID" } }),
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT "visitorId") AS n FROM "AnalyticsSession" WHERE "firstSeenAt" >= ${p.from} AND "firstSeenAt" < ${p.to} AND "device" <> 'servidor'`,
    db.analyticsSession.count({ where: { firstSeenAt: { gte: p.from, lt: p.to }, NOT: { device: "servidor" } } }),
    db.order.count({ where: { ...paidIn, netCents: null } }),
  ]);

  const paid = paidAgg._count;
  const revenue = paidAgg._sum.totalCents ?? 0;
  return {
    revenue,
    generated,
    pixGenerated,
    paid,
    pending,
    expired,
    avgTicket: paid ? Math.round(revenue / paid) : 0,
    visitors: Number(visitorsRow[0]?.n ?? 0),
    sessions,
    conversion: sessions ? paid / sessions : null,
    pixConversion: pixGenerated ? cohortPaid / pixGenerated : null,
    net: paidAgg._sum.netCents ?? null,
    netPartial: netNulls > 0 && paid > 0,
    fees: paidAgg._sum.feeCents ?? null,
  };
}

type DayRow = { d: string; n: bigint; v: bigint | null };

export async function dailySeries(p: Period) {
  const [paidRows, createdRows, pixRows] = await Promise.all([
    db.$queryRaw<DayRow[]>`
      SELECT to_char(("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS d, COUNT(*) AS n, SUM("totalCents") AS v
      FROM "Order" WHERE "status" = 'PAID' AND "deletedAt" IS NULL AND "paidAt" >= ${p.from} AND "paidAt" < ${p.to} GROUP BY d`,
    db.$queryRaw<DayRow[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS d, COUNT(*) AS n, SUM("totalCents") AS v
      FROM "Order" WHERE "deletedAt" IS NULL AND "createdAt" >= ${p.from} AND "createdAt" < ${p.to} GROUP BY d`,
    db.$queryRaw<DayRow[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS d, COUNT(*) AS n, NULL::bigint AS v
      FROM "Order" WHERE "deletedAt" IS NULL AND "pixCopyPaste" IS NOT NULL AND "createdAt" >= ${p.from} AND "createdAt" < ${p.to} GROUP BY d`,
  ]);
  const idx = (rows: DayRow[]) => new Map(rows.map((r) => [r.d, r]));
  const P = idx(paidRows), C = idx(createdRows), X = idx(pixRows);
  return daysOf(p).map((d) => ({
    day: d,
    revenue: Number(P.get(d)?.v ?? 0),
    paid: Number(P.get(d)?.n ?? 0),
    orders: Number(C.get(d)?.n ?? 0),
    pix: Number(X.get(d)?.n ?? 0),
  }));
}

export async function productBreakdown(p: Period) {
  const where = { order: { ...notDeleted, status: "PAID" as const, paidAt: { gte: p.from, lt: p.to } } };
  const [byProduct, byColor, byKind] = await Promise.all([
    db.orderItem.groupBy({ by: ["productNameSnapshot"], where, _sum: { quantity: true, totalPriceCents: true }, orderBy: { _sum: { quantity: "desc" } }, take: 10 }),
    db.orderItem.groupBy({ by: ["colorName", "colorHex"], where: { ...where, kind: "PRODUCT" }, _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 10 }),
    db.orderItem.groupBy({ by: ["kind"], where, _sum: { quantity: true, totalPriceCents: true } }),
  ]);
  return {
    products: byProduct.map((r) => ({ name: r.productNameSnapshot, qty: r._sum.quantity ?? 0, revenue: r._sum.totalPriceCents ?? 0 })),
    colors: byColor.filter((r) => r.colorName).map((r) => ({ name: r.colorName!, hex: r.colorHex ?? "#ccc", qty: r._sum.quantity ?? 0 })),
    kinds: byKind.map((r) => ({ kind: r.kind, qty: r._sum.quantity ?? 0, revenue: r._sum.totalPriceCents ?? 0 })),
  };
}

// ───────────── Funil ─────────────

export const FUNNEL_STEPS = [
  { key: "visit", label: "Visitantes" },
  { key: "view_product", label: "Visualização de produto" },
  { key: "add_to_cart", label: "Add to cart" },
  { key: "begin_checkout", label: "Checkout iniciado" },
  { key: "pix_generated", label: "PIX gerado" },
  { key: "purchase", label: "PIX pago" },
] as const;

export async function funnel(p: Period) {
  const rows = await db.$queryRaw<{ name: string; n: bigint }[]>`
    SELECT "name", COUNT(DISTINCT "sessionId") AS n FROM "AnalyticsEvent"
    WHERE "createdAt" >= ${p.from} AND "createdAt" < ${p.to}
      AND "name" IN ('view_product','add_to_cart','begin_checkout','pix_generated','purchase')
    GROUP BY "name"`;
  const sessions = await db.analyticsSession.count({ where: { firstSeenAt: { gte: p.from, lt: p.to }, NOT: { device: "servidor" } } });
  const m = new Map(rows.map((r) => [r.name, Number(r.n)]));
  // PIX gerado/pago contam por pedido (eventos de servidor podem não ter sessão de navegador)
  const [pix, paid] = await Promise.all([
    db.order.count({ where: { ...notDeleted, createdAt: { gte: p.from, lt: p.to }, pixCopyPaste: { not: null } } }),
    db.order.count({ where: { ...notDeleted, createdAt: { gte: p.from, lt: p.to }, status: "PAID" } }),
  ]);
  const values: Record<string, number> = {
    visit: sessions,
    view_product: m.get("view_product") ?? 0,
    add_to_cart: m.get("add_to_cart") ?? 0,
    begin_checkout: m.get("begin_checkout") ?? 0,
    pix_generated: pix,
    purchase: paid,
  };
  return FUNNEL_STEPS.map((s, i) => {
    const value = values[s.key];
    const prev = i === 0 ? null : values[FUNNEL_STEPS[i - 1].key];
    return { ...s, value, stepRate: prev ? value / prev : null, totalRate: sessions ? value / sessions : null };
  });
}

// ───────────── Origem do tráfego ─────────────

export async function trafficSources(p: Period) {
  const [visits, checkouts, pixOrders, paidOrders] = await Promise.all([
    db.analyticsSession.groupBy({ by: ["channel"], where: { firstSeenAt: { gte: p.from, lt: p.to }, NOT: { device: "servidor" } }, _count: true }),
    db.$queryRaw<{ channel: string | null; n: bigint }[]>`
      SELECT s."channel", COUNT(DISTINCT e."sessionId") AS n FROM "AnalyticsEvent" e JOIN "AnalyticsSession" s ON s."id" = e."sessionId"
      WHERE e."name" = 'begin_checkout' AND e."createdAt" >= ${p.from} AND e."createdAt" < ${p.to} GROUP BY s."channel"`,
    db.order.groupBy({ by: ["channel"], where: { ...notDeleted, createdAt: { gte: p.from, lt: p.to }, pixCopyPaste: { not: null } }, _count: true }),
    db.order.groupBy({ by: ["channel"], where: { ...notDeleted, status: "PAID", paidAt: { gte: p.from, lt: p.to } }, _count: true, _sum: { totalCents: true } }),
  ]);
  const get = <T extends { channel: string | null }>(rows: T[], ch: Channel) => rows.find((r) => (r.channel ?? "direto") === ch);
  return CHANNELS.map((ch) => ({
    channel: ch,
    label: CHANNEL_LABEL[ch],
    visits: get(visits, ch)?._count ?? 0,
    checkouts: Number(get(checkouts, ch)?.n ?? 0),
    pix: get(pixOrders, ch)?._count ?? 0,
    purchases: get(paidOrders, ch)?._count ?? 0,
    revenue: get(paidOrders, ch)?._sum.totalCents ?? 0,
  }));
}

export async function utmSources(p: Period) {
  return db.order.groupBy({
    by: ["utmSource", "utmCampaign"],
    where: { ...notDeleted, status: "PAID", paidAt: { gte: p.from, lt: p.to }, utmSource: { not: null } },
    _count: true,
    _sum: { totalCents: true },
    orderBy: { _sum: { totalCents: "desc" } },
    take: 15,
  });
}

// ───────────── Analytics ─────────────

export async function analyticsOverview(p: Period) {
  const range = { gte: p.from, lt: p.to };
  const sessWhere = { firstSeenAt: range, NOT: { device: "servidor" } };
  const [realtime, sessions, visitorsRow, pageViews, events, devices, browsers, landing, exits, topPages] = await Promise.all([
    db.analyticsSession.count({ where: { lastSeenAt: { gte: new Date(Date.now() - 5 * 60_000) }, NOT: { device: "servidor" } } }),
    db.analyticsSession.count({ where: sessWhere }),
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT "visitorId") AS n FROM "AnalyticsSession" WHERE "firstSeenAt" >= ${p.from} AND "firstSeenAt" < ${p.to} AND "device" <> 'servidor'`,
    db.analyticsEvent.count({ where: { name: "page_view", createdAt: range } }),
    db.analyticsEvent.groupBy({ by: ["name"], where: { createdAt: range }, _count: true }),
    db.analyticsSession.groupBy({ by: ["device"], where: sessWhere, _count: true, orderBy: { _count: { device: "desc" } } }),
    db.analyticsSession.groupBy({ by: ["browser"], where: sessWhere, _count: true, orderBy: { _count: { browser: "desc" } }, take: 8 }),
    db.analyticsSession.groupBy({ by: ["landingPage"], where: sessWhere, _count: true, orderBy: { _count: { landingPage: "desc" } }, take: 10 }),
    db.analyticsSession.groupBy({ by: ["exitPage"], where: sessWhere, _count: true, orderBy: { _count: { exitPage: "desc" } }, take: 10 }),
    db.analyticsEvent.groupBy({ by: ["path"], where: { name: "page_view", createdAt: range }, _count: true, orderBy: { _count: { path: "desc" } }, take: 12 }),
  ]);
  const ctas = await db.$queryRaw<{ cta: string | null; n: bigint }[]>`
    SELECT "props"->>'cta' AS cta, COUNT(*) AS n FROM "AnalyticsEvent"
    WHERE "name" = 'cta_click' AND "createdAt" >= ${p.from} AND "createdAt" < ${p.to} GROUP BY cta ORDER BY n DESC LIMIT 12`;
  return {
    realtime,
    sessions,
    visitors: Number(visitorsRow[0]?.n ?? 0),
    pageViews,
    events: Object.fromEntries(events.map((e) => [e.name, e._count])),
    devices: devices.map((d) => ({ label: d.device ?? "—", n: d._count })),
    browsers: browsers.map((d) => ({ label: d.browser ?? "—", n: d._count })),
    landing: landing.map((d) => ({ label: stripQuery(d.landingPage), n: d._count })),
    exits: exits.map((d) => ({ label: stripQuery(d.exitPage), n: d._count })),
    topPages: topPages.map((d) => ({ label: stripQuery(d.path), n: d._count })),
    ctas: ctas.map((c) => ({ label: c.cta ?? "—", n: Number(c.n) })),
  };
}

function stripQuery(path: string | null) {
  if (!path) return "—";
  return path.split("?")[0] || "/";
}
