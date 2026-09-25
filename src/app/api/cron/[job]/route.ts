import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { runAllJobs, runCleanupJobs, runEmailJobs, runReconcileJobs } from "@/server/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Endpoints de jobs, protegidos por CRON_SECRET (Authorization: Bearer ...).
 * Chamados pelo Vercel Cron e pelo GitHub Actions (a cada 10 min).
 *   /api/cron/all · /api/cron/emails · /api/cron/reconcile · /api/cron/cleanup
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { job } = await params;
  const runners: Record<string, () => Promise<unknown>> = {
    all: runAllJobs,
    emails: runEmailJobs,
    reconcile: runReconcileJobs,
    cleanup: runCleanupJobs,
  };
  const run = runners[job];
  if (!run) return NextResponse.json({ error: "unknown_job" }, { status: 404 });

  try {
    const result = await run();
    console.info(`[cron] ${job} ok`, JSON.stringify(result));
    return NextResponse.json({ ok: true, job, result });
  } catch (err) {
    console.error(`[cron] ${job} falhou`, err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "job_failed" }, { status: 500 });
  }
}
