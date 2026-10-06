import "server-only";
import { db } from "@/lib/db";
import { processDueEmails } from "@/lib/email";
import { reconcilePendingOrders } from "@/server/orders";
import { retryFailedWebhooks } from "@/server/webhooks";

/** Trava distribuída simples via banco — evita dois processadores simultâneos. */
async function withLock<T>(name: string, ttlMs: number, fn: () => Promise<T>): Promise<T | { skipped: true }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const taken = await db.$executeRaw`
    INSERT INTO "JobLock" ("name", "lockedAt", "expiresAt") VALUES (${name}, ${now}, ${expiresAt})
    ON CONFLICT ("name") DO UPDATE SET "lockedAt" = EXCLUDED."lockedAt", "expiresAt" = EXCLUDED."expiresAt"
    WHERE "JobLock"."expiresAt" < ${now}`;
  if (taken === 0) return { skipped: true };
  try {
    return await fn();
  } finally {
    await db.jobLock.delete({ where: { name } }).catch(() => {});
  }
}

export async function runEmailJobs() {
  return withLock("emails", 5 * 60_000, () => processDueEmails(30));
}

export async function runReconcileJobs() {
  return withLock("reconcile", 5 * 60_000, async () => ({
    reconcile: await reconcilePendingOrders(20),
    webhooks: await retryFailedWebhooks(10),
  }));
}

export async function runCleanupJobs() {
  return withLock("cleanup", 10 * 60_000, async () => {
    const now = Date.now();
    const sessions = await db.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const attempts = await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(now - 30 * 24 * 3600_000) } } });
    // Sessões anônimas sem eventos há mais de 13 meses (analytics retém ~1 ano)
    const analytics = await db.analyticsSession.deleteMany({ where: { lastSeenAt: { lt: new Date(now - 395 * 24 * 3600_000) } } });
    return { adminSessions: sessions.count, loginAttempts: attempts.count, analyticsSessions: analytics.count };
  });
}

export async function runAllJobs() {
  const started = Date.now();
  const reconcile = await runReconcileJobs();
  const emails = await runEmailJobs();
  const cleanup = await runCleanupJobs();
  return { ms: Date.now() - started, reconcile, emails, cleanup };
}

/** Permite uma execução a cada `intervalMs` no total (entre todas as instâncias), via banco. */
async function claimSlot(name: string, intervalMs: number) {
  const now = new Date();
  const until = new Date(now.getTime() + intervalMs);
  const taken = await db.$executeRaw`
    INSERT INTO "JobLock" ("name", "lockedAt", "expiresAt") VALUES (${name}, ${now}, ${until})
    ON CONFLICT ("name") DO UPDATE SET "lockedAt" = EXCLUDED."lockedAt", "expiresAt" = EXCLUDED."expiresAt"
    WHERE "JobLock"."expiresAt" < ${now}`;
  return taken > 0;
}

let lastOpportunistic = 0;
/**
 * Execução a partir do próprio tráfego do site (via after()): reconcilia PIX
 * pendentes com a BravoPay e envia e-mails vencidos. No máximo 1x/min no total.
 * Garante confirmações mesmo sem webhook e com o agendador do GitHub atrasado.
 */
export async function maybeRunJobsOpportunistically() {
  if (Date.now() - lastOpportunistic < 20_000) return; // filtro barato por instância
  lastOpportunistic = Date.now();
  try {
    if (!(await claimSlot("tick", 60_000))) return;
    await reconcilePendingOrders(10);
    await processDueEmails(20);
  } catch (err) {
    console.error("[jobs] execução oportunista falhou", err instanceof Error ? err.message : err);
  }
}

/** Para agendadores externos (ex.: cron-job.org a cada 1 min): mesmo trabalho, mesmo limite global. */
export async function runTick() {
  if (!(await claimSlot("tick", 45_000))) return { skipped: true };
  return { reconcile: await reconcilePendingOrders(15), emails: await processDueEmails(25) };
}
