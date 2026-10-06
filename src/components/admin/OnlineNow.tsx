"use client";

import { useEffect, useState } from "react";

type Row = { label: string; n: number };
type Visitor = { id: string; page: string; source: string; campaign: string | null; device: string; browser: string | null; os: string | null; pageViews: number; minutes: number };
type Data = { online: number; todaySessions: number; inCheckout: number; pages: Row[]; sources: Row[]; devices: Row[]; visitors: Visitor[]; at: string };

function Breakdown({ title, rows, total }: { title: string; rows: Row[]; total: number }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">—</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex justify-between text-sm">
                <span className="truncate text-slate-700">{r.label}</span>
                <span className="font-semibold tabular-nums">{r.n}</span>
              </div>
              <div className="mt-0.5 h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full bg-[#2a78d6]" style={{ width: `${Math.max(4, (r.n / Math.max(1, total)) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Visitantes no site agora (atualiza a cada 10 s enquanto a aba do admin está visível). */
export function OnlineNow({ detailed = false }: { detailed?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/admin/online", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as Data;
        if (alive) {
          setData(json);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      }
    };
    load();
    const id = setInterval(load, 10_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <p className="text-sm font-semibold text-slate-900">Online agora</p>
          <p className="text-3xl font-bold tabular-nums text-slate-900">{data?.online ?? "–"}</p>
          {data && data.inCheckout > 0 && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">{data.inCheckout} no checkout</span>}
        </div>
        <p className="text-xs text-slate-500">
          {error ? "Sem conexão — tentando de novo…" : data ? `${data.todaySessions} visitas hoje · atualizado ${new Date(data.at).toLocaleTimeString("pt-BR")}` : "Carregando…"}
        </p>
      </div>
      {data && (
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <Breakdown title="Origem" rows={data.sources} total={data.online} />
          <Breakdown title="Dispositivo" rows={data.devices} total={data.online} />
          <Breakdown title="Página atual" rows={data.pages} total={data.online} />
        </div>
      )}
      {detailed && data && data.visitors.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Visitante</th>
                <th className="py-2">Está em</th>
                <th className="py-2">Origem</th>
                <th className="py-2">Dispositivo</th>
                <th className="py-2 text-right">Páginas</th>
                <th className="py-2 text-right">No site há</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.visitors.map((v) => (
                <tr key={v.id}>
                  <td className="py-2 font-mono text-xs text-slate-500">#{v.id}</td>
                  <td className="py-2">{v.page}</td>
                  <td className="py-2">
                    {v.source}
                    {v.campaign && <span className="block text-xs text-slate-500">{v.campaign}</span>}
                  </td>
                  <td className="py-2">
                    {v.device}
                    <span className="block text-xs text-slate-500">{[v.os, v.browser].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{v.pageViews}</td>
                  <td className="py-2 text-right tabular-nums">{v.minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-[11px] text-slate-400">Conta abas abertas nos últimos 90 segundos. Robôs são ignorados. Nenhum dado pessoal é exibido.</p>
    </section>
  );
}
