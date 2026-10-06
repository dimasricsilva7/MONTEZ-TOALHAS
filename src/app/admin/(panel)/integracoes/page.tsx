import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader, btnSecondary } from "@/components/admin/ui";
import { integrationChecks, type CheckState } from "@/server/admin/integrations";

export const metadata: Metadata = { title: "Integrações" };
export const dynamic = "force-dynamic";

const STATE: Record<CheckState, { label: string; dot: string; badge: string }> = {
  ok: { label: "Conectado", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  warning: { label: "Atenção", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  pending: { label: "Pendente", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700 ring-slate-500/20" },
  error: { label: "Erro", dot: "bg-red-500", badge: "bg-red-50 text-red-700 ring-red-600/20" },
};

export default async function IntegrationsPage() {
  const checks = await integrationChecks();
  const ok = checks.filter((c) => c.state === "ok").length;
  return (
    <>
      <PageHeader
        title="Integrações"
        description={`${ok} de ${checks.length} conectadas · testes feitos agora, ao abrir esta página (somente leitura, sem cobranças).`}
        actions={<Link href="/admin/integracoes" className={btnSecondary}>Testar novamente</Link>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {checks.map((c) => {
          const s = STATE[c.state];
          return (
            <section key={c.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{c.name}</h2>
                    <p className="mt-0.5 text-sm text-slate-600">{c.summary}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.badge}`}>{s.label}</span>
              </div>
              {c.details && c.details.length > 0 && (
                <ul className="mt-3 space-y-1 pl-5 text-xs text-slate-600">
                  {c.details.map((d, i) => (
                    <li key={i} className="list-disc break-words">{d}</li>
                  ))}
                </ul>
              )}
              {c.action && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><strong>O que fazer:</strong> {c.action}</p>}
              {c.vars.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.vars.map((v) => (
                    <code key={v.key} className={`rounded px-1.5 py-0.5 text-[11px] ${v.set ? "bg-emerald-50 text-emerald-800" : v.required ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"}`} title={v.set ? "Configurada" : v.required ? "Obrigatória — falta" : "Opcional — não definida"}>
                      {v.set ? "✓" : v.required ? "✗" : "○"} {v.key}
                    </code>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-slate-500">
        Segredos ficam só nas variáveis de ambiente da Vercel (Project → Settings → Environment Variables); aqui aparece apenas se existem e se funcionam. Depois de alterar uma variável na Vercel, faça um novo deploy para ela valer.
      </p>
    </>
  );
}
