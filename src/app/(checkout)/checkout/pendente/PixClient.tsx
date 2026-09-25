"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicOrder } from "@/types/order";
import { IconCheck, IconClock, IconCopy, IconPix, IconShield } from "@/components/icons";
import { formatBRL } from "@/utils/format";
import { track } from "@/lib/client/tracking";

type Props = { initial: PublicOrder; qrSvg: string | null; query: string; title: string; note: string; mock: boolean };

const MAX_POLL_MS = 65 * 60 * 1000;

/** Intervalo de polling com backoff: 5s nos 2 primeiros minutos, 10s até 15 min, depois 20s. */
function intervalFor(elapsed: number) {
  if (elapsed < 2 * 60_000) return 5000;
  if (elapsed < 15 * 60_000) return 10_000;
  return 20_000;
}

function useCountdown(target: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!target) return;
    const end = new Date(target).getTime();
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

export function PixClient({ initial, qrSvg, query, title, note, mock }: Props) {
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const started = useRef(Date.now());
  const left = useCountdown(order.pixExpiresAt);

  const fetchStatus = useCallback(
    async (extra = "") => {
      const res = await fetch(`/api/orders/status?${query}${extra}`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as PublicOrder;
      setOrder(data);
      return data;
    },
    [query]
  );

  useEffect(() => {
    if (order.status === "PAID") router.replace(`/checkout/sucesso?${query}`);
  }, [order.status, query, router]);

  useEffect(() => {
    track("pix_qr_view", { valueCents: initial.totalCents, props: { order: initial.orderNumber } });
  }, [initial.orderNumber, initial.totalCents]);

  // Polling de segurança — para em pagamento, expiração ou timeout. Nunca infinito.
  useEffect(() => {
    if (order.status !== "PENDING_PAYMENT" || !order.pixCopyPaste) return;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const loop = async () => {
      const elapsed = Date.now() - started.current;
      const expired = order.pixExpiresAt && Date.now() > new Date(order.pixExpiresAt).getTime() + 2 * 60_000;
      if (elapsed > MAX_POLL_MS || expired) {
        setStopped(true);
        return;
      }
      if (document.visibilityState === "visible") await fetchStatus().catch(() => null);
      if (!cancelled) timer = setTimeout(loop, intervalFor(Date.now() - started.current));
    };
    timer = setTimeout(loop, 5000);
    const onVisible = () => document.visibilityState === "visible" && fetchStatus().catch(() => null);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [order.status, order.pixCopyPaste, order.pixExpiresAt, fetchStatus]);

  const copy = async () => {
    if (!order.pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(order.pixCopyPaste);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = order.pixCopyPaste;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    track("pix_copy", { valueCents: order.totalCents, props: { order: order.orderNumber } });
    setTimeout(() => setCopied(false), 3000);
  };

  // "Já paguei": apenas força uma nova consulta ao servidor. Nunca marca como pago.
  const checkNow = async () => {
    setChecking(true);
    setCheckMsg(null);
    const data = await fetchStatus("&force=1").catch(() => null);
    setChecking(false);
    if (data?.status !== "PAID") setCheckMsg("Ainda não recebemos a confirmação. Pagamentos PIX costumam confirmar em poucos segundos — esta página atualiza sozinha.");
    setStopped(false);
    started.current = Date.now() - 2 * 60_000;
  };

  const retry = async () => {
    setChecking(true);
    await fetchStatus("&retry=1").catch(() => null);
    setChecking(false);
    router.refresh();
  };

  const mm = left != null ? String(Math.floor(left / 60000)).padStart(2, "0") : "--";
  const ss = left != null ? String(Math.floor((left % 60000) / 1000)).padStart(2, "0") : "--";
  const isExpired = order.status === "EXPIRED" || (left === 0 && order.status === "PENDING_PAYMENT");

  if (order.status !== "PENDING_PAYMENT" && order.status !== "PAID") {
    return (
      <div className="container max-w-lg py-16 text-center">
        <h1 className="font-serif text-4xl text-ink">{order.status === "EXPIRED" ? "Este PIX expirou." : "Pagamento não concluído."}</h1>
        <p className="mt-3 text-graphite/75">O pedido {order.orderNumber} não foi pago dentro do prazo. Você pode fazer um novo pedido em poucos passos.</p>
        <Link href="/kits" className="btn-primary mt-8">Fazer novo pedido</Link>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-8 md:py-14">
      <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:gap-12">
        <section className="rounded-3xl border border-line bg-white p-6 text-center shadow-card md:p-10">
          <p className="eyebrow">Pedido {order.orderNumber}</p>
          <h1 className="mt-2 font-serif text-[36px] leading-tight text-ink md:text-[44px]">{title}</h1>
          <p className="mt-2 text-[15px] text-graphite/75">
            Valor: <strong className="text-ink">{formatBRL(order.totalCents)}</strong>
          </p>

          {mock && (
            <p className="mx-auto mt-4 max-w-sm rounded-lg bg-amber-50 p-2 text-[12px] text-amber-800">
              Ambiente de teste: este PIX é fictício e não pode ser pago.
            </p>
          )}

          {order.paymentError || !order.pixCopyPaste ? (
            <div className="mt-8">
              <p className="text-[15px] text-red-700">Não foi possível gerar seu PIX. Tente novamente.</p>
              <button className="btn-primary mt-5" onClick={retry} disabled={checking}>
                {checking ? "Gerando…" : "Tentar novamente"}
              </button>
            </div>
          ) : (
            <>
              <div className={`mx-auto mt-6 w-full max-w-[260px] rounded-2xl border border-line p-3 ${isExpired ? "opacity-30" : ""}`}>
                {qrSvg ? <div aria-label="QR Code PIX" role="img" dangerouslySetInnerHTML={{ __html: qrSvg }} /> : null}
              </div>
              <p className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold ${isExpired ? "bg-red-50 text-red-700" : "bg-cream text-graphite"}`}>
                <IconClock size={16} /> {isExpired ? "PIX expirado" : `Expira em ${mm}:${ss}`}
              </p>

              <div className="mt-6 text-left">
                <label htmlFor="pix-code" className="label">PIX copia e cola</label>
                <textarea id="pix-code" readOnly value={order.pixCopyPaste} rows={3} className="input !min-h-0 resize-none break-all py-3 font-mono text-[12px] leading-5" onFocus={(e) => e.currentTarget.select()} />
              </div>
              <button className="btn-olive mt-4 w-full !min-h-[56px] text-[14px]" onClick={copy} disabled={isExpired}>
                {copied ? (
                  <>
                    <IconCheck size={18} /> Código copiado!
                  </>
                ) : (
                  <>
                    <IconCopy size={18} /> Copiar PIX
                  </>
                )}
              </button>

              <p className="mt-5 text-[13px] text-graphite/75">{note}</p>
              {!stopped && !isExpired && (
                <p className="mt-2 flex items-center justify-center gap-2 text-[12px] text-taupe-dark">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-olive opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-olive" />
                  </span>
                  Aguardando confirmação do pagamento
                </p>
              )}
              <button className="btn-outline mt-5 w-full" onClick={checkNow} disabled={checking}>
                {checking ? "Consultando…" : "Já paguei"}
              </button>
              {checkMsg && <p className="mt-3 text-[13px] text-graphite/75" role="status">{checkMsg}</p>}
            </>
          )}
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-line bg-cream/60 p-6">
            <p className="font-serif text-xl text-ink">Como pagar</p>
            <ol className="mt-4 space-y-3 text-[14px] text-graphite/85">
              {["Abra o app do seu banco e escolha pagar com PIX.", "Escaneie o QR Code ou cole o código copia e cola.", "Confirme o pagamento. A confirmação aparece aqui automaticamente."].map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-ivory">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6">
            <p className="font-serif text-xl text-ink">Resumo</p>
            <ul className="mt-3 divide-y divide-line text-[14px]">
              {order.items.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-3 py-2.5">
                  <span>
                    {i.quantity}× {i.name}
                    {i.colorName && <span className="block text-[12px] text-taupe-dark">Cor: {i.colorName}</span>}
                  </span>
                  <span className="font-semibold tabular-nums">{formatBRL(i.totalPriceCents)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between border-t border-line pt-3 font-semibold text-ink">
              <span>Total</span>
              <span>{formatBRL(order.totalCents)}</span>
            </p>
          </div>
          <p className="flex items-center gap-2 px-1 text-[12px] text-taupe-dark">
            <IconShield size={16} className="text-olive" /> Pagamento processado com segurança. Você também pode acompanhar este pedido em Rastrear pedido.
          </p>
          <p className="flex items-center gap-2 px-1 text-[12px] text-taupe-dark">
            <IconPix size={16} className="text-olive" /> Nenhum dado bancário é solicitado pela MONTEZ.
          </p>
        </aside>
      </div>
    </div>
  );
}
