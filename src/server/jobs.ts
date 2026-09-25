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

let lastOpportunistic = 0;
/**
 * Execução oportunista dos jobs de e-mail a partir do tráfego (via after()),
 * no máximo 1x/min por instância. Complementa o cron externo — nunca é a única garantia.
 */
export async function maybeRunJobsOpportunistically() {
  if (Date.now() - lastOpportunistic < 60_000) return;
  lastOpportunistic = Date.now();
  try {
    await runEmailJobs();
  } catch (err) {
    console.error("[jobs] execução oportunista falhou", err instanceof Error ? err.message : err);
  }
}
