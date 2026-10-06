"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Barra fixa no celular: aparece depois do topo e some quando os kits já estão na tela. */
export function HomeStickyCta({ label, fromPrice, freeShipping }: { label: string; fromPrice: string; freeShipping: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const kits = document.getElementById("kits");
    let kitsVisible = false;
    const io = kits ? new IntersectionObserver(([e]) => { kitsVisible = e.isIntersecting; update(); }, { threshold: 0.15 }) : null;
    if (kits && io) io.observe(kits);
    function update() {
      setShow(window.scrollY > 520 && !kitsVisible);
    }
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", update);
      io?.disconnect();
    };
  }, []);
  return (
    <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ivory/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-300 md:hidden ${show ? "translate-y-0" : "translate-y-full"}`}>
      <Link href="/#kits" className="btn-olive w-full !flex-col !gap-0 !py-1.5 leading-tight" data-cta="home_sticky">
        <span>{label}</span>
        <span className="text-[10.5px] font-medium normal-case tracking-normal opacity-85">a partir de {fromPrice}{freeShipping ? " · frete grátis" : ""}</span>
      </Link>
    </div>
  );
}
