import { NextResponse, type NextRequest } from "next/server";
import { handleBravopayWebhook } from "@/server/webhooks";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text(); // corpo bruto exato — necessário para validar o HMAC
  if (rawBody.length > 256_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  const result = await handleBravopayWebhook(rawBody, req.headers);
  return NextResponse.json(result.body, { status: result.status });
}
