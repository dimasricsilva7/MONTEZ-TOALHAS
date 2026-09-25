"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-ivory px-6 text-center">
      <h1 className="font-serif text-4xl text-ink">Algo não saiu como esperado.</h1>
      <p className="mt-3 max-w-sm text-graphite/75">Tente novamente em instantes. Se o problema continuar, fale com o nosso atendimento.</p>
      <button onClick={reset} className="btn-primary mt-8">Tentar novamente</button>
    </div>
  );
}
