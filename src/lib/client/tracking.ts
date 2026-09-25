"use client";

import type { Attribution, ClientContext, Touch } from "@/types/tracking";

/**
 * Tracking no navegador:
 * - session_id anônimo (expira após 30 min sem atividade) e visitor_id (1 ano)
 * - captura de UTMs/click IDs com first-touch e last-touch persistidos
 * - fila de eventos internos enviada em lote para /api/track
 * - Meta Pixel / GA4 com o mesmo event_id enviado à CAPI (deduplicação)
 */

const SESSION_TTL = 30 * 60 * 1000;
const ATTR_KEY = "mz_attr";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* modo privado */
  }
}

export function randomId(len = 20) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[b % 62]).join("");
}

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&")}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSec: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

export function getIds() {
  let vid = readCookie("mz_vid");
  if (!vid) {
    vid = randomId(20);
    writeCookie("mz_vid", vid, 365 * 24 * 3600);
  }
  let sid = readCookie("mz_sid");
  const last = Number(safeGet("mz_sid_ts") ?? 0);
  if (!sid || Date.now() - last > SESSION_TTL) {
    sid = randomId(20);
  }
  writeCookie("mz_sid", sid, SESSION_TTL / 1000);
  safeSet("mz_sid_ts", String(Date.now()));
  return { sid, vid };
}

function readAttribution(): Attribution {
  try {
    return JSON.parse(safeGet(ATTR_KEY) ?? "{}") as Attribution;
  } catch {
    return {};
  }
}

/** Chamado a cada navegação: atualiza last-touch quando há UTMs novos, preserva first-touch. */
export function captureAttribution() {
  const url = new URL(location.href);
  const attr = readAttribution();
  const touch: Touch = {};
  let hasUtm = false;
  for (const k of UTM_KEYS) {
    const v = url.searchParams.get(k);
    if (v) {
      touch[k.replace("utm_", "") as keyof Touch] = v.slice(0, 200) as never;
      hasUtm = true;
    }
  }
  const fbclid = url.searchParams.get("fbclid");
  const gclid = url.searchParams.get("gclid");
  const ttclid = url.searchParams.get("ttclid");
  const externalReferrer = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : null;

  if (hasUtm) {
    touch.at = Date.now();
    attr.last = touch;
    if (!attr.first) attr.first = touch;
  }
  if (fbclid) {
    attr.fbclid = fbclid;
    // _fbc no formato da Meta, para eventos de servidor mesmo sem o Pixel carregado
    if (!readCookie("_fbc")) writeCookie("_fbc", `fb.1.${Date.now()}.${fbclid}`, 90 * 24 * 3600);
  }
  if (gclid) attr.gclid = gclid;
  if (ttclid) attr.ttclid = ttclid;
  if (!attr.landingPage || hasUtm || fbclid || gclid || ttclid) {
    attr.landingPage = (url.pathname + url.search).slice(0, 500);
    if (externalReferrer) attr.referrer = externalReferrer.slice(0, 500);
  }
  if (!attr.referrer && externalReferrer) attr.referrer = externalReferrer.slice(0, 500);
  safeSet(ATTR_KEY, JSON.stringify(attr));
  return attr;
}

export function getClientContext(): ClientContext {
  const { sid, vid } = getIds();
  return { sessionId: sid, visitorId: vid, fbp: readCookie("_fbp"), fbc: readCookie("_fbc"), attribution: readAttribution() };
}

// ───────────── Fila de eventos internos ─────────────

type CapiForward = { eventName: string; eventId: string; url: string; customData?: Record<string, unknown> };
type QueuedEvent = {
  name: string;
  path?: string;
  productId?: string | null;
  valueCents?: number | null;
  props?: Record<string, string | number | boolean | null>;
  capi?: CapiForward;
};

const queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  if (!queue.length) return;
  const events = queue.splice(0, 20);
  const { sessionId, visitorId, ...rest } = getClientContext();
  const body = JSON.stringify({ sid: sessionId, vid: visitorId, context: rest, events });
  const blob = new Blob([body], { type: "application/json" });
  if (!(navigator.sendBeacon && navigator.sendBeacon("/api/track", blob))) {
    fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }
  if (queue.length) flush();
}

export function track(name: string, data: Omit<QueuedEvent, "name"> = {}) {
  if (typeof window === "undefined") return;
  queue.push({ name, path: location.pathname + location.search, ...data });
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 400);
}

if (typeof window !== "undefined") {
  addEventListener("pagehide", flush);
  addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}

// ───────────── Meta Pixel / GA4 ─────────────

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function newEventId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${randomId(8)}`;
}

/**
 * Dispara um evento no Meta Pixel e (opcionalmente) espelha na CAPI via
 * /api/track usando o MESMO event_id — a Meta deduplica os dois.
 */
export function metaEvent(eventName: string, params: Record<string, unknown> = {}, opts: { eventId?: string; mirror?: boolean; internal?: QueuedEvent } = {}) {
  const eventId = opts.eventId ?? newEventId(eventName.toLowerCase());
  // O script do Pixel carrega "afterInteractive": aguarda o fbq existir (até ~4s)
  const fire = (tries: number) => {
    if (window.fbq) window.fbq("track", eventName, params, { eventID: eventId });
    else if (tries > 0) setTimeout(() => fire(tries - 1), 200);
  };
  fire(20);
  if (opts.internal || opts.mirror) {
    const internal = opts.internal ?? { name: "cta_click" };
    track(internal.name, {
      ...internal,
      capi: opts.mirror ? { eventName, eventId, url: location.href, customData: params } : undefined,
    });
  }
  return eventId;
}

export function gaEvent(name: string, params: Record<string, unknown> = {}) {
  if (window.gtag) window.gtag("event", name, params);
}
