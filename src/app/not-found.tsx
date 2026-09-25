import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-ivory px-6 text-center">
      <p className="font-serif text-[22px] tracking-brand text-ink">MONTEZ</p>
      <h1 className="mt-8 font-serif text-4xl text-ink">Página não encontrada.</h1>
      <p className="mt-3 max-w-sm text-graphite/75">O endereço pode ter mudado ou o link expirou.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn-primary">Ir para o início</Link>
        <Link href="/kits" className="btn-outline">Ver kits</Link>
      </div>
    </div>
  );
}
