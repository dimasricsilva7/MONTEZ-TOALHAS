"use client";

import Link from "next/link";
import { useCart } from "@/components/providers/CartProvider";
import { CartLines, CrossSell } from "@/components/cart/CartContents";
import { IconArrow, IconPix, IconShield } from "@/components/icons";
import { formatBRL } from "@/utils/format";

export function CartPageClient({ shippingCents }: { shippingCents: number }) {
  const { items, subtotalCents, ready } = useCart();

  if (!ready) return <div className="container min-h-[50vh] py-16" />;

  if (!items.length) {
    return (
      <div className="container flex min-h-[55vh] flex-col items-center justify-center py-16 text-center">
        <h1 className="font-serif text-4xl text-ink">Seu carrinho está vazio.</h1>
        <p className="mt-3 text-graphite/75">Escolha seu kit MONTEZ e a cor que combina com o seu banheiro.</p>
        <Link href="/kits" className="btn-primary mt-8">
          Ver kits <IconArrow size={18} />
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-10 md:py-14">
      <h1 className="font-serif text-[38px] text-ink md:text-5xl">Carrinho</h1>
      <div className="mt-8 grid gap-10 md:grid-cols-[1.6fr_1fr]">
        <div>
          <CartLines />
          <div className="mt-6">
            <CrossSell />
          </div>
        </div>
        <aside className="h-fit rounded-2xl border border-line bg-white/80 p-6 shadow-card md:sticky md:top-24">
          <p className="font-serif text-2xl text-ink">Resumo</p>
          <dl className="mt-5 space-y-3 text-[15px]">
            <div className="flex justify-between">
              <dt className="text-graphite/75">Subtotal</dt>
              <dd className="tabular-nums">{formatBRL(subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-graphite/75">Frete</dt>
              <dd>{shippingCents ? formatBRL(shippingCents) : "Grátis"}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold text-ink">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatBRL(subtotalCents + shippingCents)}</dd>
            </div>
          </dl>
          <Link href="/checkout" className="btn-olive mt-6 w-full" data-cta="cart_checkout">
            Finalizar compra <IconArrow size={18} />
          </Link>
          <ul className="mt-5 space-y-2 text-[13px] text-taupe-dark">
            <li className="flex items-center gap-2">
              <IconPix size={16} className="text-olive" /> PIX com confirmação automática
            </li>
            <li className="flex items-center gap-2">
              <IconShield size={16} className="text-olive" /> Seus dados protegidos
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
