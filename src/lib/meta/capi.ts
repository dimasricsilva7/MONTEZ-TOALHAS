import "server-only";
import { sha256 } from "@/lib/crypto";

/**
 * Meta Conversions API (server-side). O token fica exclusivamente no servidor
 * (META_CONVERSIONS_API_TOKEN). Browser Pixel e CAPI usam o MESMO event_id para
 * que a Meta deduplique o evento.
 */
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

export type CapiEventName = "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase" | "Lead";

export type CapiUser = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  externalId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbc?: string | null;
  fbp?: string | null;
};

export type CapiEvent = {
  eventName: CapiEventName;
  eventId: string;
  eventSourceUrl: string;
  eventTime?: number;
  user: CapiUser;
  customData?: Record<string, unknown>;
};

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

function pixels(): { pixelId: string; token: string }[] {
  const list: { pixelId: string; token: string }[] = [];
  const primary = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CONVERSIONS_API_TOKEN;
  if (primary && token) list.push({ pixelId: primary, token });
  const secondary = process.env.NEXT_PUBLIC_META_PIXEL_ID_SECONDARY;
  const secondaryToken = process.env.META_CONVERSIONS_API_TOKEN_SECONDARY || token;
  if (secondary && secondaryToken && secondary !== primary) list.push({ pixelId: secondary, token: secondaryToken });
  return list;
}

export function capiEnabled() {
  return pixels().length > 0;
}

function buildUserData(u: CapiUser) {
  const data: Record<string, string | string[]> = {};
  if (u.email) data.em = [sha256(norm(u.email))];
  if (u.phone) {
    const digits = u.phone.replace(/\D/g, "");
    data.ph = [sha256(digits.startsWith("55") ? digits : `55${digits}`)];
  }
  if (u.firstName) data.fn = [sha256(norm(u.firstName))];
  if (u.lastName) data.ln = [sha256(norm(u.lastName))];
  if (u.city) data.ct = [sha256(norm(u.city).replace(/\s+/g, ""))];
  if (u.state) data.st = [sha256(norm(u.state))];
  if (u.zip) data.zp = [sha256(u.zip.replace(/\D/g, ""))];
  if (u.email || u.phone) data.country = [sha256("br")];
  if (u.externalId) data.external_id = [sha256(u.externalId)];
  if (u.ip && u.ip !== "unknown") data.client_ip_address = u.ip;
  if (u.userAgent) data.client_user_agent = u.userAgent;
  if (u.fbc) data.fbc = u.fbc;
  if (u.fbp) data.fbp = u.fbp;
  return data;
}

/** Envio best-effort: nunca lança erro nem bloqueia o fluxo de compra. */
export async function sendCapiEvent(event: CapiEvent): Promise<void> {
  const targets = pixels();
  if (targets.length === 0) return;
  const testCode = process.env.META_TEST_EVENT_CODE;
  const body = JSON.stringify({
    data: [
      {
        event_name: event.eventName,
        event_time: event.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: "website",
        event_source_url: event.eventSourceUrl,
        user_data: buildUserData(event.user),
        custom_data: event.customData ?? {},
      },
    ],
    ...(testCode ? { test_event_code: testCode } : {}),
  });

  await Promise.all(
    targets.map(async ({ pixelId, token }) => {
      try {
        const res = await fetch(
          `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body, cache: "no-store" }
        );
        if (!res.ok) {
          const text = (await res.text().catch(() => "")).slice(0, 300);
          console.error(`[meta-capi] ${event.eventName} falhou (pixel ${pixelId}) status=${res.status} ${text}`);
        }
      } catch (err) {
        console.error(`[meta-capi] erro de rede (pixel ${pixelId})`, err instanceof Error ? err.message : err);
      }
    })
  );
}

/** Reconstrói o fbc a partir do fbclid salvo quando o cookie _fbc não está disponível. */
export function fbcFromClickId(fbclid: string | null | undefined, createdAt: Date): string | undefined {
  return fbclid ? `fb.1.${createdAt.getTime()}.${fbclid}` : undefined;
}
