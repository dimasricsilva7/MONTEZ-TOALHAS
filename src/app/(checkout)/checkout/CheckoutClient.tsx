"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/providers/CartProvider";
import { ProductVisual } from "@/components/product/ProductVisual";
import { QtyStepper } from "@/components/cart/CartContents";
import { IconArrow, IconCheck, IconPix, IconShield } from "@/components/icons";
import { formatBRL } from "@/utils/format";
import { isValidCep, isValidCpf, isValidPhone, maskCep, maskCpf, maskPhone, onlyDigits, UF_LIST } from "@/utils/validators";
import { gaEvent, getClientContext, metaEvent, newEventId, randomId, track } from "@/lib/client/tracking";

type Bump = { id: string; title: string; description: string | null; priceCents: number; imageUrl: string | null };

type Form = {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

const EMPTY: Form = { name: "", email: "", cpf: "", phone: "", cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" };
const DRAFT_KEY = "mz_checkout_draft";
const TOKEN_KEY = "mz_checkout_token";

function validateStep(step: number, f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  if (step >= 1) {
    if (f.name.trim().split(/\s+/).filter(Boolean).length < 2) e.name = "Informe nome e sobrenome";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "E-mail inválido";
    if (!isValidCpf(f.cpf)) e.cpf = "CPF inválido";
    if (!isValidPhone(f.phone)) e.phone = "Telefone inválido";
  }
  if (step >= 2) {
    if (!isValidCep(f.cep)) e.cep = "CEP inválido";
    if (f.street.trim().length < 2) e.street = "Informe o endereço";
    if (!f.number.trim()) e.number = "Informe o número";
    if (!f.district.trim()) e.district = "Informe o bairro";
    if (f.city.trim().length < 2) e.city = "Informe a cidade";
    if (!(UF_LIST as readonly string[]).includes(f.state)) e.state = "UF";
  }
  return e;
}

export function CheckoutClient({ shippingCents, bumps, note }: { shippingCents: number; bumps: Bump[]; note: string }) {
  const { items, subtotalCents, ready, setQuantity, remove, clear } = useCart();
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedBumps, setSelectedBumps] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const numberRef = useRef<HTMLInputElement>(null);
  const tracked = useRef(false);
  const bumpViewed = useRef(false);

  const bumpTotal = useMemo(() => bumps.filter((b) => selectedBumps.includes(b.id)).reduce((s, b) => s + b.priceCents, 0), [bumps, selectedBumps]);
  const totalCents = subtotalCents + bumpTotal + shippingCents;

  useEffect(() => {
    try {
      const d = sessionStorage.getItem(DRAFT_KEY);
      if (d) setForm({ ...EMPTY, ...(JSON.parse(d) as Partial<Form>) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* ignore */
    }
  }, [form]);

  useEffect(() => {
    if (!ready || tracked.current || !items.length) return;
    tracked.current = true;
    const contents = items.map((i) => ({ id: i.product.sku, quantity: i.quantity, item_price: i.product.priceCents / 100 }));
    const value = subtotalCents / 100;
    metaEvent(
      "InitiateCheckout",
      { currency: "BRL", value, content_type: "product", content_ids: items.map((i) => i.product.sku), contents, num_items: items.reduce((s, i) => s + i.quantity, 0) },
      { mirror: true, internal: { name: "begin_checkout", valueCents: subtotalCents } }
    );
    track("view_checkout", { valueCents: subtotalCents });
    gaEvent("begin_checkout", { currency: "BRL", value, items: items.map((i) => ({ item_id: i.product.sku, item_name: i.product.commercialName, quantity: i.quantity })) });
  }, [ready, items, subtotalCents]);

  useEffect(() => {
    if (step === 3 && bumps.length && !bumpViewed.current) {
      bumpViewed.current = true;
      track("order_bump_view", { props: { count: bumps.length } });
    }
  }, [step, bumps.length]);

  const set = (key: keyof Form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  const lookupCep = async (cep: string) => {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          street: data.logradouro || f.street,
          district: data.bairro || f.district,
          city: data.localidade || f.city,
          state: data.uf || f.state,
        }));
        setTimeout(() => numberRef.current?.focus(), 50);
      } else {
        setErrors((e) => ({ ...e, cep: "CEP não encontrado — preencha o endereço manualmente" }));
      }
    } catch {
      /* preenchimento manual */
    } finally {
      setCepLoading(false);
    }
  };

  const next = (target: number) => {
    const e = validateStep(target - 1, form);
    if (Object.values(e).some(Boolean)) {
      setErrors(e);
      const first = Object.keys(e)[0];
      document.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setStep(target);
    requestAnimationFrame(() => document.getElementById(`step-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const submit = async () => {
    const e = validateStep(2, form);
    if (Object.values(e).some(Boolean)) {
      setErrors(e);
      setStep(e.name || e.email || e.cpf || e.phone ? 1 : 2);
      return;
    }
    setSubmitting(true);
    setServerError(null);

    let token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = randomId(32);
      sessionStorage.setItem(TOKEN_KEY, token);
    }
    const paymentEventId = newEventId("addpaymentinfo");
    const ctx = getClientContext();

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutToken: token,
          customer: { name: form.name.trim(), email: form.email.trim(), cpf: form.cpf, phone: form.phone },
          address: { cep: form.cep, street: form.street, number: form.number, complement: form.complement, district: form.district, city: form.city, state: form.state },
          items: items.map((i) => ({ productId: i.productId, colorId: i.colorId, quantity: i.quantity })),
          bumpIds: selectedBumps,
          paymentEventId,
          context: ctx,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { orderNumber?: string; token?: string; error?: string; fields?: Record<string, string> };
      if (!res.ok || !data.orderNumber || !data.token) {
        if (data.fields) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.fields)) mapped[k.split(".").pop()!] = v;
          setErrors(mapped);
        }
        // Se o pedido já foi criado (PIX falhou), o mesmo token permite nova tentativa sem duplicar.
        setServerError(data.error ?? "Não foi possível gerar seu PIX. Tente novamente.");
        setSubmitting(false);
        return;
      }
      metaEvent(
        "AddPaymentInfo",
        { currency: "BRL", value: totalCents / 100, content_type: "product", content_ids: items.map((i) => i.product.sku) },
        { eventId: paymentEventId, internal: { name: "add_payment_info", valueCents: totalCents } }
      );
      gaEvent("add_payment_info", { currency: "BRL", value: totalCents / 100, payment_type: "PIX" });
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(DRAFT_KEY);
      clear();
      router.push(`/checkout/pendente?pedido=${encodeURIComponent(data.orderNumber)}&t=${encodeURIComponent(data.token)}`);
    } catch {
      setServerError("Falha de conexão. Verifique sua internet e tente novamente.");
      setSubmitting(false);
    }
  };

  if (!ready) return <div className="container min-h-[60vh]" />;

  if (!items.length && !submitting) {
    return (
      <div className="container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <h1 className="font-serif text-4xl text-ink">Seu carrinho está vazio.</h1>
        <Link href="/kits" className="btn-primary mt-8">Escolher meu kit</Link>
      </div>
    );
  }

  const field = (name: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, mask?: (v: string) => string) => (
    <div className={props.className}>
      <label htmlFor={`f-${name}`} className="label">
        {label}
      </label>
      <input
        id={`f-${name}`}
        name={name}
        value={form[name]}
        onChange={(e) => set(name, mask ? mask(e.target.value) : e.target.value)}
        className={`input ${errors[name] ? "input-error" : ""}`}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `e-${name}` : undefined}
        {...props}
      />
      {errors[name] && (
        <p id={`e-${name}`} className="mt-1 text-[12px] text-red-600">
          {errors[name]}
        </p>
      )}
    </div>
  );

  const StepHeader = ({ n, title, done }: { n: number; title: string; done: boolean }) => (
    <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => (done || n < step ? setStep(n) : undefined)} disabled={!done && n > step}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step === n ? "bg-ink text-ivory" : done ? "bg-olive text-ivory" : "bg-linen text-taupe-dark"}`}>
        {done && step !== n ? <IconCheck size={16} /> : n}
      </span>
      <span className={`font-serif text-[23px] ${step >= n ? "text-ink" : "text-taupe"}`}>{title}</span>
    </button>
  );

  return (
    <div className="container py-6 md:py-12">
      <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
        <div className="space-y-4">
          {/* 1. Identificação */}
          <section id="step-1" className="scroll-mt-20 rounded-2xl border border-line bg-white p-5 shadow-card md:p-7">
            <StepHeader n={1} title="Identificação" done={step > 1} />
            {step === 1 ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {field("name", "Nome completo", { autoComplete: "name", className: "sm:col-span-2" })}
                {field("email", "E-mail", { type: "email", autoComplete: "email", inputMode: "email", className: "sm:col-span-2" })}
                {field("cpf", "CPF", { inputMode: "numeric", autoComplete: "off", placeholder: "000.000.000-00" }, maskCpf)}
                {field("phone", "WhatsApp / Telefone", { type: "tel", inputMode: "tel", autoComplete: "tel-national", placeholder: "(00) 00000-0000" }, maskPhone)}
                <p className="text-[12px] leading-5 text-taupe-dark sm:col-span-2">Usamos seus dados apenas para emitir o pedido, gerar o PIX e enviar atualizações da entrega.</p>
                <button type="button" className="btn-primary sm:col-span-2" onClick={() => next(2)}>
                  Continuar <IconArrow size={18} />
                </button>
              </div>
            ) : (
              <p className="mt-2 pl-11 text-[13px] text-graphite/70">{form.name} · {form.email}</p>
            )}
          </section>

          {/* 2. Endereço */}
          <section id="step-2" className="scroll-mt-20 rounded-2xl border border-line bg-white p-5 shadow-card md:p-7">
            <StepHeader n={2} title="Endereço de entrega" done={step > 2} />
            {step === 2 ? (
              <div className="mt-6 grid grid-cols-6 gap-4">
                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor="f-cep" className="label">CEP</label>
                  <input
                    id="f-cep"
                    name="cep"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="00000-000"
                    value={form.cep}
                    onChange={(e) => {
                      const v = maskCep(e.target.value);
                      set("cep", v);
                      if (onlyDigits(v).length === 8) lookupCep(v);
                    }}
                    className={`input ${errors.cep ? "input-error" : ""}`}
                  />
                  {cepLoading && <p className="mt-1 text-[12px] text-taupe-dark">Buscando endereço…</p>}
                  {errors.cep && <p className="mt-1 text-[12px] text-red-600">{errors.cep}</p>}
                </div>
                {field("street", "Endereço", { autoComplete: "address-line1", className: "col-span-6" })}
                <div className="col-span-2">
                  <label htmlFor="f-number" className="label">Número</label>
                  <input ref={numberRef} id="f-number" name="number" value={form.number} onChange={(e) => set("number", e.target.value)} className={`input ${errors.number ? "input-error" : ""}`} inputMode="numeric" />
                  {errors.number && <p className="mt-1 text-[12px] text-red-600">{errors.number}</p>}
                </div>
                {field("complement", "Complemento (opcional)", { autoComplete: "address-line2", className: "col-span-4" })}
                {field("district", "Bairro", { className: "col-span-6 sm:col-span-3" })}
                {field("city", "Cidade", { autoComplete: "address-level2", className: "col-span-4 sm:col-span-2" })}
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor="f-state" className="label">UF</label>
                  <select id="f-state" name="state" value={form.state} onChange={(e) => set("state", e.target.value)} className={`input !px-2 ${errors.state ? "input-error" : ""}`}>
                    <option value="">—</option>
                    {UF_LIST.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
                <button type="button" className="btn-primary col-span-6" onClick={() => next(3)}>
                  Continuar <IconArrow size={18} />
                </button>
              </div>
            ) : step > 2 ? (
              <p className="mt-2 pl-11 text-[13px] text-graphite/70">
                {form.street}, {form.number}{form.complement ? ` — ${form.complement}` : ""} · {form.city}/{form.state}
              </p>
            ) : null}
          </section>

          {/* 3. Pedido + order bumps + pagamento */}
          <section id="step-3" className="scroll-mt-20 rounded-2xl border border-line bg-white p-5 shadow-card md:p-7">
            <StepHeader n={3} title="Revisão e pagamento" done={false} />
            {step === 3 && (
              <div className="mt-6">
                {bumps.length > 0 && (
                  <div className="space-y-3">
                    <p className="eyebrow">Aproveite e complete seu banheiro</p>
                    {bumps.map((b) => {
                      const on = selectedBumps.includes(b.id);
                      return (
                        <label key={b.id} className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition ${on ? "border-olive bg-olive-light/60" : "border-line hover:border-taupe"}`}>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) => {
                              setSelectedBumps((prev) => (e.target.checked ? [...prev, b.id] : prev.filter((x) => x !== b.id)));
                              if (e.target.checked) track("order_bump_accept", { valueCents: b.priceCents, props: { bumpId: b.id, stage: "selected" } });
                            }}
                            className="h-5 w-5 shrink-0 accent-[#4B5637]"
                          />
                          {b.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={b.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold text-ink">{b.title}</span>
                            {b.description && <span className="block text-[12.5px] text-taupe-dark">{b.description}</span>}
                          </span>
                          <span className="shrink-0 text-[15px] font-semibold text-ink">{formatBRL(b.priceCents)}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 rounded-xl bg-cream/70 p-4">
                  <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                    <IconPix size={20} className="text-olive" /> Pagamento via PIX
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-graphite/75">{note} Após gerar o PIX, você terá o QR Code e o código copia e cola.</p>
                </div>

                {serverError && (
                  <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[14px] text-red-700" role="alert">
                    {serverError}
                  </p>
                )}

                <button type="button" className="btn-olive mt-6 w-full !min-h-[56px] text-[14px]" onClick={submit} disabled={submitting}>
                  {submitting ? "Gerando seu PIX…" : `Gerar PIX — ${formatBRL(totalCents)}`}
                </button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[12px] text-taupe-dark">
                  <IconShield size={14} /> Ao continuar, você concorda com os <Link href="/termos" className="underline">termos</Link> e a <Link href="/politica-de-privacidade" className="underline">política de privacidade</Link>.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Resumo */}
        <aside className="order-first h-fit rounded-2xl border border-line bg-cream/60 p-5 md:p-6 lg:sticky lg:top-8 lg:order-none">
          <p className="font-serif text-2xl text-ink">Seu pedido</p>
          <ul className="mt-4 divide-y divide-line">
            {items.map((i) => (
              <li key={`${i.productId}-${i.colorId}`} className="flex gap-3 py-3">
                <ProductVisual product={i.product} color={i.color} className="h-16 w-16 shrink-0 rounded-lg" sizes="64px" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ink">{i.product.commercialName}</p>
                  <p className="text-[12px] text-taupe-dark">{i.product.pieceCount} peças · {i.color.name}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <QtyStepper small value={i.quantity} onChange={(v) => setQuantity(i.productId, i.colorId, v)} />
                    <button className="text-[11px] text-taupe underline" onClick={() => remove(i.productId, i.colorId)}>remover</button>
                  </div>
                </div>
                <p className="text-[14px] font-semibold tabular-nums">{formatBRL(i.lineTotalCents)}</p>
              </li>
            ))}
            {bumps
              .filter((b) => selectedBumps.includes(b.id))
              .map((b) => (
                <li key={b.id} className="flex justify-between py-3 text-[13px]">
                  <span className="text-graphite/80">{b.title}</span>
                  <span className="font-semibold tabular-nums">{formatBRL(b.priceCents)}</span>
                </li>
              ))}
          </ul>
          <dl className="mt-2 space-y-2 border-t border-line pt-4 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-graphite/75">Subtotal</dt>
              <dd className="tabular-nums">{formatBRL(subtotalCents + bumpTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-graphite/75">Frete</dt>
              <dd>{shippingCents ? formatBRL(shippingCents) : "Grátis"}</dd>
            </div>
            <div className="flex justify-between pt-2 text-lg font-semibold text-ink">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatBRL(totalCents)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
