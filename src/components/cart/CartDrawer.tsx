"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/providers/CartProvider";
import { CartLines, CrossSell } from "./CartContents";
import { IconArrow, IconClose, IconPix } from "@/components/icons";
import { formatBRL } from "@/utils/format";

export function CartDrawer({ shippingNote }: { shippingNote: string }) {
  const { drawerOpen, setDrawerOpen, items, subtotalCents, count } = useCart();
  const pathname = usePathname();

  useEffect(() => setDrawerOpen(false), [pathname, setDrawerOpen]);
  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen, setDrawerOpen]);

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Carrinho">
      <button className="absolute inset-0 bg-ink/40 animate-fade-in" aria-label="Fechar carrinho" onClick={() => setDrawerOpen(false)} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col bg-ivory shadow-lift animate-slide-in">
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <p className="font-serif text-2xl text-ink">
            Seu carrinho {count > 0 && <span className="font-sans text-sm text-taupe">({count})</span>}
          </p>
          <button className="-mr-2 p-2" onClick={() => setDrawerOpen(false)} aria-label="Fechar carrinho">
            <IconClose />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <p className="font-serif text-2xl text-ink">Seu carrinho está vazio.</p>
            <p className="mt-2 text-sm text-taupe-dark">Escolha seu kit MONTEZ e a cor que combina com o seu banheiro.</p>
            <Link href="/kits" className="btn-primary mt-6" onClick={() => setDrawerOpen(false)}>
              Ver kits
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              <CartLines compact />
              <div className="pb-5">
                <CrossSell />
              </div>
            </div>
            <div className="border-t border-line bg-white/60 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-graphite/80">Subtotal</span>
                <span className="text-lg font-semibold tabular-nums text-ink">{formatBRL(subtotalCents)}</span>
              </div>
              <p className="mt-1 text-[12px] text-taupe-dark">{shippingNote}</p>
              <Link href="/checkout" className="btn-olive mt-4 w-full" onClick={() => setDrawerOpen(false)}>
                Finalizar compra <IconArrow size={18} />
              </Link>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-taupe-dark">
                <IconPix size={14} /> Pagamento via PIX com confirmação automática
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
