import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { SETTING_DEFAULTS, SETTING_FIELDS } from "@/lib/content-defaults";
import { bravopayMode, envHealth, isProductionDeploy, siteUrl } from "@/lib/env";
import { Badge, Card, Field, PageHeader, btnSecondary, inputCls, textareaCls } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/client";
import { ImageField } from "@/components/admin/media";
import { centsToInput } from "@/server/admin/forms";
import { changePasswordAction, createAdminAction, runJobsAction, saveSettingsAction, testWebhookAction, toggleAdminAction } from "./actions";
import { formatDate } from "@/utils/format";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const [rows, admins, lastWebhooks, pending] = await Promise.all([
    db.setting.findMany(),
    db.adminUser.findMany({ orderBy: { createdAt: "asc" } }),
    db.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 8 }),
    db.order.findMany({ where: { status: "PENDING_PAYMENT", deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10, select: { orderNumber: true } }),
  ]);
  const values: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) values[r.key] = typeof r.value === "string" ? r.value : String(r.value ?? "");
  const groups = [...new Set(SETTING_FIELDS.map((f) => f.group))];
  const health = envHealth();
  const mode = bravopayMode();
  const prod = isProductionDeploy();

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid gap-6 xl:grid-cols-2">
        {groups.map((g) => (
          <Card key={g} title={g}>
            <ActionForm action={saveSettingsAction} className="grid gap-4">
              <input type="hidden" name="group" value={g} />
              {SETTING_FIELDS.filter((f) => f.group === g).map((f) => {
                const v = values[f.key] ?? "";
                if (f.type === "boolean")
                  return (
                    <label key={f.key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name={f.key} defaultChecked={v === "true"} /> {f.label}
                      {f.help && <span className="text-xs text-slate-500">— {f.help}</span>}
                    </label>
                  );
                if (f.type === "image") return <ImageField key={f.key} name={f.key} label={f.label} defaultValue={v} category="OUTROS" hint={f.help} />;
                if (f.type === "textarea") return <Field key={f.key} label={f.label} hint={f.help}><textarea name={f.key} defaultValue={v} rows={3} className={textareaCls} /></Field>;
                return (
                  <Field key={f.key} label={f.label} hint={f.help}>
                    <input name={f.key} defaultValue={f.type === "money" ? centsToInput(Number(v) || 0) : v} inputMode={f.type === "text" ? undefined : "decimal"} className={inputCls} />
                  </Field>
                );
              })}
              <div><SubmitButton>Salvar</SubmitButton></div>
            </ActionForm>
          </Card>
        ))}

        <Card title="Integrações e variáveis de ambiente">
          <p className="mb-3 text-sm text-slate-600">
            Segredos ficam apenas nas variáveis de ambiente da Vercel (nunca no código). Aqui é mostrada só a presença de cada uma. Para o teste ao vivo de cada conexão, abra <Link href="/admin/integracoes" className="font-semibold underline">Integrações</Link>.
          </p>
          <ul className="divide-y divide-slate-100 text-sm">
            {health.map((h) => (
              <li key={h.key} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <code className="text-xs font-semibold">{h.key}</code>
                  <span className="block text-xs text-slate-500">{h.hint}</span>
                </span>
                {h.ok ? <Badge tone="green">Configurada</Badge> : h.required ? <Badge tone="red">Pendente</Badge> : <Badge>Opcional</Badge>}
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
            <p>
              Modo BravoPay: <strong>{mode === "live" ? "API real" : mode === "mock" ? "mock (teste, sem cobrança)" : "desativado (sem chave)"}</strong>
            </p>
            <p className="mt-1">
              URL do webhook para cadastrar na BravoPay: <code className="select-all break-all text-xs">{siteUrl()}/api/webhooks/bravopay</code>
            </p>
            <p className="mt-1 text-xs text-slate-500">Eventos: transaction.created, paid, refunded, chargeback, expired, failed e receipt_uploaded.</p>
          </div>
        </Card>

        <Card title="Webhooks recebidos (últimos)">
          {lastWebhooks.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum webhook recebido ainda.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {lastWebhooks.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {w.eventType}
                    <span className="block font-mono text-[11px] text-slate-400">{w.eventId}</span>
                  </span>
                  <span className="text-right">
                    <Badge tone={w.status === "PROCESSED" ? "green" : w.status === "FAILED" ? "red" : "slate"}>{w.status}</Badge>
                    <span className="block text-xs text-slate-500">{formatDate(w.receivedAt, true)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Tarefas agendadas (jobs)">
          <p className="mb-3 text-sm text-slate-600">E-mails agendados, reconciliação de PIX pendentes e limpeza rodam automaticamente (cron). Você pode forçar uma execução agora.</p>
          <ActionForm action={runJobsAction}>
            <SubmitButton className={btnSecondary} pendingText="Executando…">Executar jobs agora</SubmitButton>
          </ActionForm>
        </Card>

        {!prod && (
          <Card title="Teste de webhook (somente desenvolvimento/preview)">
            <p className="mb-3 text-sm text-slate-600">Gera um evento assinado com o segredo configurado e o processa pelo mesmo fluxo do endpoint real. Indisponível em produção.</p>
            <ActionForm action={testWebhookAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Pedido">
                <input name="orderNumber" list="pending-orders" required className={inputCls} placeholder="MONTEZ-2026-000001" />
                <datalist id="pending-orders">{pending.map((o) => <option key={o.orderNumber} value={o.orderNumber!} />)}</datalist>
              </Field>
              <Field label="Evento">
                <select name="type" className={inputCls}>
                  <option value="transaction.paid">transaction.paid</option>
                  <option value="transaction.expired">transaction.expired</option>
                  <option value="transaction.failed">transaction.failed</option>
                  <option value="transaction.refunded">transaction.refunded</option>
                </select>
              </Field>
              <SubmitButton>Enviar evento</SubmitButton>
            </ActionForm>
          </Card>
        )}

        <Card title="Minha senha">
          <ActionForm action={changePasswordAction} className="grid gap-3" resetOnSuccess>
            <Field label="Senha atual"><input type="password" name="current" required autoComplete="current-password" className={inputCls} /></Field>
            <Field label="Nova senha (mín. 12 caracteres)"><input type="password" name="next" required minLength={12} autoComplete="new-password" className={inputCls} /></Field>
            <Field label="Confirmar nova senha"><input type="password" name="confirm" required minLength={12} autoComplete="new-password" className={inputCls} /></Field>
            <div><SubmitButton>Alterar senha</SubmitButton></div>
          </ActionForm>
        </Card>

        <Card title="Administradores">
          <ul className="mb-4 divide-y divide-slate-100 text-sm">
            {admins.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {a.name} <span className="text-slate-500">· {a.email}</span>
                  <span className="block text-xs text-slate-500">{a.role} · último acesso {a.lastLoginAt ? formatDate(a.lastLoginAt, true) : "—"}</span>
                </span>
                {admin.role === "OWNER" && a.id !== admin.id ? (
                  <ActionForm action={toggleAdminAction} className="">
                    <input type="hidden" name="id" value={a.id} />
                    <SubmitButton className={`${btnSecondary} !h-8 text-xs`}>{a.active ? "Desativar" : "Ativar"}</SubmitButton>
                  </ActionForm>
                ) : (
                  <Badge tone={a.active ? "green" : "slate"}>{a.active ? "Ativo" : "Inativo"}</Badge>
                )}
              </li>
            ))}
          </ul>
          {admin.role === "OWNER" && (
            <ActionForm action={createAdminAction} className="grid gap-3 sm:grid-cols-2" resetOnSuccess>
              <Field label="Nome"><input name="name" required className={inputCls} /></Field>
              <Field label="E-mail"><input name="email" type="email" required className={inputCls} /></Field>
              <Field label="Senha inicial"><input name="password" type="password" required minLength={12} className={inputCls} autoComplete="new-password" /></Field>
              <Field label="Papel">
                <select name="role" className={inputCls}>
                  <option value="ADMIN">Admin</option>
                  <option value="EDITOR">Editor</option>
                </select>
              </Field>
              <div><SubmitButton>Adicionar administrador</SubmitButton></div>
            </ActionForm>
          )}
        </Card>
      </div>
    </>
  );
}
