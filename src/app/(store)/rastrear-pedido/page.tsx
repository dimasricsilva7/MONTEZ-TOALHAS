"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function TrackOrderPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    const res = await fetch("/api/order-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber: String(fd.get("orderNumber") ?? ""), email: String(fd.get("email") ?? "") }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { url?: string; error?: string };
    setLoading(false);
    if (res?.ok && data.url) router.push(data.url);
    else setError(data?.error ?? "Não foi possível consultar agora. Tente novamente.");
  };

  return (
    <>
      <section className="border-b border-line bg-linen-texture">
        <div className="container max-w-xl py-12 text-center md:py-16">
          <p className="eyebrow">Meus pedidos</p>
          <h1 className="mt-3 font-serif text-[40px] leading-tight text-ink md:text-[52px]">Rastrear pedido</h1>
          <p className="mt-3 text-[15px] text-graphite/75">Informe o número do pedido e o e-mail usado na compra.</p>
        </div>
      </section>
      <div className="container max-w-md py-12">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="orderNumber" className="label">Número do pedido</label>
            <input id="orderNumber" name="orderNumber" required placeholder="MONTEZ-2026-000001" className="input uppercase" autoCapitalize="characters" />
          </div>
          <div>
            <label htmlFor="email" className="label">E-mail</label>
            <input id="email" name="email" type="email" required className="input" autoComplete="email" />
          </div>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>{loading ? "Consultando…" : "Consultar pedido"}</button>
        </form>
      </div>
    </>
  );
}
