import { NextResponse } from "next/server";
import { runTick } from "@/server/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Batida pública e segura para agendadores externos (ex.: cron-job.org a cada
 * 1 min): reconcilia PIX pendentes e envia e-mails vencidos. Limitada a 1
 * execução por 45 s no total e sem efeitos além dos jobs — não expõe dados.
 */
export async function GET() {
  try {
    const result = await runTick();
    return NextResponse.json({ ok: true, ...("skipped" in result ? { skipped: true } : {}) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
