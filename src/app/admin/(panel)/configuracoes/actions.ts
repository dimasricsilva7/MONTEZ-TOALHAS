"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requireAdmin, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { SETTING_FIELDS } from "@/lib/content-defaults";
import { isProductionDeploy } from "@/lib/env";
import { parseMoney } from "@/server/admin/forms";
import { runAllJobs } from "@/server/jobs";
import { handleBravopayWebhook } from "@/server/webhooks";
import { signWebhookPayload } from "@/lib/payments/bravopay";
import type { ActionResult } from "@/components/admin/client";

export async function saveSettingsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const group = String(fd.get("group") ?? "");
  const fields = SETTING_FIELDS.filter((f) => f.group === group);
  if (!fields.length) return { error: "Grupo inválido." };
  for (const f of fields) {
    let value: string;
    if (f.type === "boolean") value = fd.get(f.key) === "on" ? "true" : "false";
    else if (f.type === "money") {
      const cents = parseMoney(fd.get(f.key));
      if (cents == null) return { error: `${f.label}: valor inválido.` };
      value = String(cents);
    } else if (f.type === "number") {
      const n = Number.parseInt(String(fd.get(f.key) ?? ""), 10);
      if (!Number.isFinite(n) || n < 0) return { error: `${f.label}: número inválido.` };
      if (f.key === "pix_expiration_minutes" && (n < 5 || n > 1440)) return { error: "Validade do PIX deve ficar entre 5 e 1440 minutos." };
      value = String(n);
    } else value = String(fd.get(f.key) ?? "").trim().slice(0, 2000);
    await db.setting.upsert({ where: { key: f.key }, update: { value, updatedBy: admin.id }, create: { key: f.key, value, updatedBy: admin.id } });
  }
  await audit(admin.id, "settings_updated", "settings", group, Object.fromEntries(fields.map((f) => [f.key, String(fd.get(f.key) ?? "").slice(0, 60)])));
  revalidateTag("settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "Configurações salvas." };
}

export async function changePasswordAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next.length < 12) return { error: "A nova senha deve ter pelo menos 12 caracteres." };
  if (next !== String(fd.get("confirm") ?? "")) return { error: "A confirmação não confere." };
  if (!(await verifyPassword(current, admin.passwordHash))) return { error: "Senha atual incorreta." };
  await db.adminUser.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(next) } });
  await audit(admin.id, "password_changed", "admin", admin.id);
  return { ok: true, message: "Senha alterada." };
}

export async function createAdminAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.role !== "OWNER") return { error: "Apenas o proprietário pode criar administradores." };
  const parsed = z
    .object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), password: z.string().min(12).max(200), role: z.enum(["ADMIN", "EDITOR"]) })
    .safeParse({ name: fd.get("name"), email: fd.get("email"), password: fd.get("password"), role: fd.get("role") });
  if (!parsed.success) return { error: "Dados inválidos (senha com no mínimo 12 caracteres)." };
  if (await db.adminUser.findUnique({ where: { email: parsed.data.email } })) return { error: "E-mail já cadastrado." };
  const created = await db.adminUser.create({ data: { name: parsed.data.name, email: parsed.data.email, role: parsed.data.role, passwordHash: await hashPassword(parsed.data.password) } });
  await audit(admin.id, "admin_created", "admin", created.id, { email: created.email, role: created.role });
  revalidatePath("/admin/configuracoes");
  return { ok: true, message: "Administrador criado." };
}

export async function toggleAdminAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (admin.role !== "OWNER") return { error: "Apenas o proprietário pode alterar administradores." };
  const id = String(fd.get("id") ?? "");
  if (id === admin.id) return { error: "Você não pode desativar a si mesmo." };
  const target = await db.adminUser.findUniqueOrThrow({ where: { id } });
  await db.adminUser.update({ where: { id }, data: { active: !target.active } });
  if (target.active) await db.adminSession.deleteMany({ where: { adminId: id } });
  await audit(admin.id, target.active ? "admin_deactivated" : "admin_activated", "admin", id);
  revalidatePath("/admin/configuracoes");
  return { ok: true };
}

export async function runJobsAction(): Promise<ActionResult> {
  const admin = await requireAdmin();
  const result = await runAllJobs();
  await audit(admin.id, "jobs_run_manual", "jobs", null, result as unknown as Record<string, unknown>);
  return { ok: true, message: `Jobs executados em ${result.ms} ms: ${JSON.stringify({ reconcile: result.reconcile, emails: result.emails })}` };
}

/**
 * Ferramenta de teste de webhook — somente fora de produção. Gera um evento
 * assinado com BRAVOPAY_WEBHOOK_SECRET e o processa pelo mesmo caminho do
 * endpoint real (validação de assinatura + idempotência).
 */
export async function testWebhookAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (isProductionDeploy()) return { error: "Indisponível em produção." };
  const secret = process.env.BRAVOPAY_WEBHOOK_SECRET;
  if (!secret) return { error: "Defina BRAVOPAY_WEBHOOK_SECRET." };
  const orderNumber = String(fd.get("orderNumber") ?? "").trim().toUpperCase();
  const type = String(fd.get("type") ?? "transaction.paid");
  const order = await db.order.findUnique({ where: { orderNumber } });
  if (!order) return { error: "Pedido não encontrado." };
  const status = { "transaction.paid": "PAID", "transaction.expired": "EXPIRED", "transaction.failed": "FAILED", "transaction.refunded": "REFUNDED" }[type] ?? "PENDING";
  const event = {
    id: `evt_test_${Date.now()}`,
    type,
    created: Math.floor(Date.now() / 1000),
    data: { id: order.bravopayTransactionId ?? `test_${order.id}`, status, amount_cents: order.totalCents, fee_cents: null, net_cents: null, currency: "BRL", method: "PIX", external_reference: order.externalReference, paid_at: status === "PAID" ? new Date().toISOString() : null },
  };
  const raw = JSON.stringify(event);
  const headers = new Headers({ "BravoPay-Signature": signWebhookPayload(raw, secret) });
  const result = await handleBravopayWebhook(raw, headers);
  await audit(admin.id, "webhook_test", "order", order.id, { type, status: result.status });
  revalidatePath(`/admin/pedidos/${order.id}`);
  return result.status === 200 ? { ok: true, message: `Evento ${type} processado (${JSON.stringify(result.body)}).` } : { error: `Falhou: ${result.status} ${JSON.stringify(result.body)}` };
}
