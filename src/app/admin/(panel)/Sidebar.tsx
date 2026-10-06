"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "../login/actions";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/produtos", label: "Produtos" },
  { href: "/admin/cores", label: "Cores" },
  { href: "/admin/imagens", label: "Imagens" },
  { href: "/admin/conteudo", label: "Conteúdo" },
  { href: "/admin/conteudo/faq", label: "FAQ", sub: true },
  { href: "/admin/conteudo/avaliacoes", label: "Avaliações", sub: true },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/emails", label: "E-mails" },
  { href: "/admin/order-bumps", label: "Order Bumps" },
  { href: "/admin/upsells", label: "Upsells" },
  { href: "/admin/integracoes", label: "Integrações" },
  { href: "/admin/configuracoes", label: "Configurações" },
  { href: "/admin/auditoria", label: "Auditoria" },
];

export function Sidebar({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || (pathname.startsWith(`${href}/`) && !NAV.some((n) => n.href !== href && n.href.startsWith(href) && pathname.startsWith(n.href))));

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Admin">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`block rounded-lg px-3 py-2 text-sm transition ${item.sub ? "ml-3 text-[13px]" : ""} ${isActive(item.href) ? "bg-slate-900 font-semibold text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-slate-200 p-4">
      <p className="truncate text-sm font-medium text-slate-900">{name}</p>
      <p className="truncate text-xs text-slate-500">{email}</p>
      <div className="mt-3 flex gap-2">
        <Link href="/" target="_blank" className="flex-1 rounded-lg border border-slate-300 py-1.5 text-center text-xs font-medium text-slate-700 hover:bg-slate-50">
          Ver loja
        </Link>
        <form action={logoutAction} className="flex-1">
          <button className="w-full rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Sair</button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <button onClick={() => setOpen(true)} className="-ml-1 rounded-lg p-2 hover:bg-slate-100" aria-label="Abrir menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <span className="font-serif text-lg tracking-[0.3em]">MONTEZ</span>
        <span className="w-8" />
      </div>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-6">
          <span className="font-serif text-lg tracking-[0.3em]">MONTEZ</span>
          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">ADMIN</span>
        </div>
        {nav}
        {footer}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} aria-label="Fechar menu" />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center border-b border-slate-200 px-5 font-serif tracking-[0.3em]">MONTEZ</div>
            {nav}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
