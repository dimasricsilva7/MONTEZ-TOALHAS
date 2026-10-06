import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { CHANNEL_LABEL, type Channel } from "@/utils/channel";

export const dynamic = "force-dynamic";

const WINDOW_MS = 90_000; // batimento a cada 30 s → online = visto nos últimos 90 s

function pageLabel(raw: string | null) {
  const path = raw?.split("?")[0] ?? null;
  if (!path || path === "/") return "Página inicial";
  if (path === "/checkout") return "Checkout";
  if (path.startsWith("/checkout/pendente")) return "Pagando o PIX";
  if (path.startsWith("/checkout/sucesso")) return "Compra concluída";
  if (path.startsWith("/produto/")) return `Produto: ${path.split("/")[2]?.replace("montez-", "").toUpperCase() ?? ""}`;
  if (path === "/kits") return "Kits";
  if (path === "/carrinho") return "Carrinho";
  return path;
}

const DEVICE_LABEL: Record<string, string> = { mobile: "Celular", desktop: "Computador", tablet: "Tablet" };

export async function GET() {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const now = Date.now();
  const [sessions, today] = await Promise.all([
    db.analyticsSession.findMany({
      where: { lastSeenAt: { gte: new Date(now - WINDOW_MS) }, NOT: { device: "servidor" } },
      select: { id: true, exitPage: true, landingPage: true, device: true, browser: true, os: true, utmSource: true, utmCampaign: true, channel: true, firstSeenAt: true, lastSeenAt: true, pageViews: true },
      orderBy: { lastSeenAt: "desc" },
      take: 500,
    }),
    db.analyticsSession.count({ where: { firstSeenAt: { gte: new Date(new Date(now - 3 * 3600_000).toISOString().slice(0, 10) + "T03:00:00.000Z") }, NOT: { device: "servidor" } } }),
  ]);

  const channelOf = (s: (typeof sessions)[number]) => CHANNEL_LABEL[(s.channel ?? "direto") as Channel] ?? s.channel ?? "Direto";
  const count = (key: (s: (typeof sessions)[number]) => string) => {
    const m = new Map<string, number>();
    for (const s of sessions) m.set(key(s), (m.get(key(s)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n }));
  };

  return NextResponse.json(
    {
      online: sessions.length,
      todaySessions: today,
      inCheckout: sessions.filter((s) => s.exitPage?.startsWith("/checkout")).length,
      pages: count((s) => pageLabel(s.exitPage)).slice(0, 8),
      sources: count(channelOf),
      devices: count((s) => DEVICE_LABEL[s.device ?? ""] ?? "Outro"),
      visitors: sessions.slice(0, 25).map((s) => ({
        id: s.id.slice(0, 6),
        page: pageLabel(s.exitPage),
        source: channelOf(s),
        campaign: s.utmCampaign,
        device: DEVICE_LABEL[s.device ?? ""] ?? "Outro",
        browser: s.browser,
        os: s.os,
        pageViews: s.pageViews,
        minutes: Math.max(0, Math.round((now - s.firstSeenAt.getTime()) / 60_000)),
      })),
      at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
