"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { IconBag, IconClose, IconMenu, IconSearch, IconUser } from "@/components/icons";
import { useCart } from "@/components/providers/CartProvider";

export const NAV = [
  { href: "/", label: "Início" },
  { href: "/kits", label: "Toalhas" },
  { href: "/#kits", label: "Kits" },
  { href: "/#qualidade", label: "Nossa Qualidade" },
  { href: "/cuidados", label: "Cuidados" },
  { href: "/faq", label: "FAQ" },
];

export function Header() {
  const { count, setDrawerOpen, ready } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  return (
    <header className={`sticky top-0 z-40 border-b transition-colors duration-300 ${scrolled ? "border-line bg-ivory/95 backdrop-blur-md" : "border-transparent bg-ivory"}`}>
      <div className="container flex h-16 items-center justify-between gap-4 md:h-[76px]">
        <button className="-ml-2 p-2 lg:hidden" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>
          <IconMenu size={24} />
        </button>

        <Logo className="lg:mr-8" />

        <nav className="hidden flex-1 items-center justify-center gap-8 lg:flex" aria-label="Principal">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-[13px] font-medium tracking-wide text-graphite/80 transition hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="-mr-2 flex items-center gap-0.5">
          <button className="hidden p-2.5 text-graphite/80 hover:text-ink sm:inline-flex" aria-label="Buscar" onClick={() => setSearchOpen((v) => !v)}>
            <IconSearch />
          </button>
          <Link href="/rastrear-pedido" className="hidden p-2.5 text-graphite/80 hover:text-ink sm:inline-flex" aria-label="Meus pedidos">
            <IconUser />
          </Link>
          <button className="relative p-2.5 text-ink" aria-label={`Carrinho${count ? ` com ${count} itens` : ""}`} onClick={() => setDrawerOpen(true)}>
            <IconBag size={22} />
            {ready && count > 0 && (
              <span key={count} className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] animate-pop items-center justify-center rounded-full bg-olive px-1 text-[10px] font-bold text-ivory">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-line bg-ivory animate-fade-in">
          <form
            className="container flex items-center gap-3 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchRef.current?.value.trim();
              router.push(q ? `/kits?q=${encodeURIComponent(q)}` : "/kits");
            }}
          >
            <IconSearch className="text-taupe" />
            <input ref={searchRef} name="q" placeholder="Buscar kits, cores, medidas…" className="h-11 flex-1 bg-transparent text-[16px] outline-none placeholder:text-taupe/70" />
            <button type="button" className="p-2" aria-label="Fechar busca" onClick={() => setSearchOpen(false)}>
              <IconClose size={18} />
            </button>
          </form>
        </div>
      )}

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-ink/40 animate-fade-in" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-ivory shadow-lift" style={{ animation: "fade-in .25s ease both" }}>
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <Logo />
              <button className="p-2" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}>
                <IconClose />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-5 py-4" aria-label="Menu mobile">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="flex items-center justify-between border-b border-line/70 py-4 font-serif text-[22px] text-ink">
                  {item.label}
                </Link>
              ))}
              <form
                className="mt-6 flex items-center gap-2 rounded-full border border-line bg-white px-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = new FormData(e.currentTarget).get("q")?.toString().trim();
                  router.push(q ? `/kits?q=${encodeURIComponent(q)}` : "/kits");
                  setMenuOpen(false);
                }}
              >
                <IconSearch size={18} className="text-taupe" />
                <input name="q" placeholder="Buscar" className="h-12 flex-1 bg-transparent text-[16px] outline-none" />
              </form>
            </nav>
            <div className="border-t border-line px-5 py-4 text-sm">
              <Link href="/rastrear-pedido" className="flex items-center gap-2 py-2 text-graphite">
                <IconUser size={18} /> Rastrear pedido
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
