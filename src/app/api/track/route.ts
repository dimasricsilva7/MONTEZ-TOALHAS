import { NextResponse, after, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request";
import { ensureSession, trackEvent, trackPageView, TRACKED_EVENTS } from "@/lib/analytics";
import { sendCapiEvent, type CapiEventName } from "@/lib/meta/capi";
import { clientContextSchema } from "@/lib/validation";
import { parseUserAgent } from "@/utils/channel";
import { maybeRunJobsOpportunistically } from "@/server/jobs";

export const dynamic = "force-dynamic";

const CAPI_ALLOWED: CapiEventName[] = ["PageView", "ViewContent", "AddToCart", "InitiateCheckout"];

const bodySchema = z.object({
  sid: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  vid: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  context: clientContextSchema.optional(),
  events: z
    .array(
      z.object({
        name: z.enum(TRACKED_EVENTS),
        path: z.string().max(500).optional(),
        productId: z.string().max(40).optional().nullable(),
        valueCents: z.number().int().min(0).max(10_000_000).optional().nullable(),
        props: z.record(z.union([z.string().max(300), z.number(), z.boolean(), z.null()])).optional(),
        capi: z
          .object({
            eventName: z.enum(["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "AddPaymentInfo", "Purchase", "Lead"]),
            eventId: z.string().max(80),
            url: z.string().max(1000),
            customData: z.record(z.unknown()).optional(),
          })
          .optional(),
      })
    )
    .min(1)
    .max(20),
});

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse(null, { status: 204 });
  const ip = getClientIp(req.headers);
  if (!rateLimit(`track:${ip}`, 120, 60_000)) return new NextResponse(null, { status: 204 });

  const userAgent = req.headers.get("user-agent");
  if (parseUserAgent(userAgent).isBot) return new NextResponse(null, { status: 204 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { sid, vid, events, context } = parsed.data;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");

  try {
    const session = await ensureSession({ sessionId: sid, visitorId: vid, userAgent, attribution: context?.attribution, path: events[0]?.path, siteHost: host });
    for (const e of events) {
      if (e.name === "page_view" && e.path) await trackPageView(sid, e.path);
      await trackEvent({ sessionId: sid, visitorId: vid, name: e.name, path: e.path, productId: e.productId, valueCents: e.valueCents, props: e.props });
    }

    const capiEvents = events.filter(
      (e) => e.capi && CAPI_ALLOWED.includes(e.capi.eventName) && (e.capi.eventName !== "PageView" || session.created)
    );
    if (capiEvents.length) {
      after(async () => {
        for (const e of capiEvents) {
          await sendCapiEvent({
            eventName: e.capi!.eventName,
            eventId: e.capi!.eventId,
            eventSourceUrl: e.capi!.url,
            user: { ip, userAgent, fbp: context?.fbp, fbc: context?.fbc, externalId: vid },
            customData: e.capi!.customData,
          });
        }
      });
    }
    after(() => maybeRunJobsOpportunistically());
  } catch (err) {
    console.error("[track] erro", err instanceof Error ? err.message : err);
  }
  return new NextResponse(null, { status: 204 });
}
