import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { classifyChannel, parseUserAgent } from "@/utils/channel";
import type { Attribution } from "@/types/tracking";

export const TRACKED_EVENTS = [
  "page_view",
  "view_product",
  "select_color",
  "add_to_cart",
  "remove_from_cart",
  "begin_checkout",
  "view_checkout",
  "add_payment_info",
  "pix_generated",
  "pix_copy",
  "pix_qr_view",
  "purchase",
  "checkout_abandoned",
  "email_recovery_sent",
  "email_confirmation_sent",
  "cta_click",
  "upsell_view",
  "upsell_accept",
  "upsell_decline",
  "order_bump_view",
  "order_bump_accept",
] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

export type SessionInit = {
  sessionId: string;
  visitorId: string;
  userAgent?: string | null;
  attribution?: Attribution | null;
  path?: string | null;
  siteHost?: string | null;
};

const cut = (v: string | null | undefined, n = 200) => (v ? String(v).slice(0, n) : null);

/** Cria a sessão no primeiro evento; nas seguintes, não faz nada. */
export async function ensureSession(init: SessionInit) {
  const existing = await db.analyticsSession.findUnique({ where: { id: init.sessionId }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };
  const ua = parseUserAgent(init.userAgent);
  const touch = init.attribution?.last ?? init.attribution?.first ?? null;
  const referrer = cut(init.attribution?.referrer, 500);
  const channel = classifyChannel({
    source: touch?.source,
    medium: touch?.medium,
    fbclid: init.attribution?.fbclid,
    gclid: init.attribution?.gclid,
    ttclid: init.attribution?.ttclid,
    referrer,
    siteHost: init.siteHost,
  });
  await db.analyticsSession.upsert({
    where: { id: init.sessionId },
    update: {},
    create: {
      id: init.sessionId,
      visitorId: init.visitorId,
      landingPage: cut(init.attribution?.landingPage ?? init.path, 500),
      exitPage: cut(init.path, 500),
      referrer,
      utmSource: cut(touch?.source),
      utmMedium: cut(touch?.medium),
      utmCampaign: cut(touch?.campaign),
      utmContent: cut(touch?.content),
      utmTerm: cut(touch?.term),
      fbclid: cut(init.attribution?.fbclid, 500),
      gclid: cut(init.attribution?.gclid, 500),
      ttclid: cut(init.attribution?.ttclid, 500),
      channel,
      device: ua.device,
      browser: ua.browser,
      os: ua.os,
    },
  });
  return { id: init.sessionId, created: true };
}

export type EventInput = {
  sessionId: string;
  visitorId: string;
  name: TrackedEvent;
  path?: string | null;
  productId?: string | null;
  orderId?: string | null;
  valueCents?: number | null;
  props?: Record<string, unknown> | null;
};

export async function trackEvent(e: EventInput) {
  await db.analyticsEvent.create({
    data: {
      sessionId: e.sessionId,
      visitorId: e.visitorId,
      name: e.name,
      path: cut(e.path, 500),
      productId: e.productId ?? null,
      orderId: e.orderId ?? null,
      valueCents: e.valueCents ?? null,
      props: (e.props ?? undefined) as Prisma.InputJsonValue,
    },
  });
}

export async function trackPageView(sessionId: string, path: string) {
  await db.analyticsSession.update({
    where: { id: sessionId },
    data: { pageViews: { increment: 1 }, lastSeenAt: new Date(), exitPage: cut(path, 500) },
  });
}

type OrderRef = { id: string; sessionId: string | null; visitorId: string | null; channel?: string | null; totalCents?: number };

/** Eventos originados no servidor (webhook, jobs): garante uma sessão para o pedido. */
export async function trackServerEvent(order: OrderRef, name: TrackedEvent, extra: Omit<EventInput, "sessionId" | "visitorId" | "name"> = {}) {
  try {
    let sessionId = order.sessionId;
    const visitorId = order.visitorId ?? `order_${order.id}`;
    if (sessionId) {
      const exists = await db.analyticsSession.findUnique({ where: { id: sessionId }, select: { id: true } });
      if (!exists) sessionId = null;
    }
    if (!sessionId) {
      sessionId = `srv_${order.id}`;
      await db.analyticsSession.upsert({
        where: { id: sessionId },
        update: {},
        create: { id: sessionId, visitorId, channel: order.channel ?? "direto", device: "servidor" },
      });
    }
    await trackEvent({ sessionId, visitorId, name, orderId: order.id, ...extra });
  } catch (err) {
    console.error("[analytics] falha ao registrar evento de servidor", name, err instanceof Error ? err.message : err);
  }
}

export const trackCheckout = (order: OrderRef) => trackServerEvent(order, "pix_generated", { valueCents: order.totalCents ?? null });
export const trackPurchase = (order: OrderRef) => trackServerEvent(order, "purchase", { valueCents: order.totalCents ?? null });

/** Vincula a sessão anônima ao cliente (sem copiar dados pessoais para o analytics). */
export async function linkSessionToCustomer(sessionId: string | null | undefined, customerId: string) {
  if (!sessionId) return;
  await db.analyticsSession.updateMany({ where: { id: sessionId }, data: { customerId } }).catch(() => {});
}
