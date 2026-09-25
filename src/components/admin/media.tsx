"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { btnPrimary, btnSecondary, inputCls, labelCls } from "./ui";

import { CATEGORY_LABEL, MEDIA_CATEGORIES } from "@/utils/media";

export { CATEGORY_LABEL, MEDIA_CATEGORIES };

type Asset = { id: string; name: string; url: string; alt: string; category: string; device: string };

/** Redimensiona (máx. 2400px) e converte para WebP no navegador antes do upload. */
export async function prepareImage(file: File, maxSide = 2400): Promise<{ blob: Blob; width: number; height: number; name: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  let quality = 0.86;
  let blob: Blob | null = null;
  do {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
    quality -= 0.1;
  } while (blob && blob.size > 3.8 * 1024 * 1024 && quality > 0.4);
  if (!blob) throw new Error("Falha ao processar a imagem");
  return { blob, width, height, name: file.name.replace(/\.[^.]+$/, "") };
}

export async function uploadImage(file: File, meta: { category?: string; alt?: string; device?: string; page?: string; section?: string } = {}): Promise<Asset> {
  const { blob, width, height, name } = await prepareImage(file);
  const fd = new FormData();
  fd.append("file", new File([blob], `${name}.webp`, { type: "image/webp" }));
  fd.append("name", name);
  fd.append("width", String(width));
  fd.append("height", String(height));
  Object.entries(meta).forEach(([k, v]) => v && fd.append(k, v));
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { asset?: Asset; error?: string };
  if (!res.ok || !data.asset) throw new Error(data.error ?? "Falha no upload");
  return data.asset;
}

export function UploadButton({ category = "OUTROS", onUploaded, label = "Enviar imagem", multiple = false }: { category?: string; onUploaded: (a: Asset) => void; label?: string; multiple?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple={multiple}
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length) return;
          setBusy(true);
          setError(null);
          try {
            for (const f of files) onUploaded(await uploadImage(f, { category }));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Falha no upload");
          } finally {
            setBusy(false);
            if (ref.current) ref.current.value = "";
          }
        }}
      />
      <button type="button" className={btnPrimary} onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? "Enviando…" : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Modal para escolher uma imagem da biblioteca (ou enviar uma nova). */
export function MediaModal({ open, onClose, onSelect, category }: { open: boolean; onClose: () => void; onSelect: (a: Asset) => void; category?: string }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState(category ?? "");
  const [q, setQ] = useState("");
  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter) params.set("category", filter);
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/media?${params.toString()}`);
    const data = (await res.json().catch(() => ({ assets: [] }))) as { assets: Asset[] };
    setAssets(data.assets ?? []);
  }, [filter, q]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
          <p className="mr-auto font-semibold">Biblioteca de imagens</p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className={`${inputCls} !w-40`} />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputCls} !w-40`}>
            <option value="">Todas</option>
            {MEDIA_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
          <UploadButton category={filter || category || "OUTROS"} onUploaded={(a) => setAssets((prev) => [a, ...prev])} label="Enviar nova" />
          <button type="button" className={btnSecondary} onClick={onClose}>Fechar</button>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-4 lg:grid-cols-5">
          {assets.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-400">Nenhuma imagem. Envie a primeira.</p>}
          {assets.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onSelect(a);
                onClose();
              }}
              className="group overflow-hidden rounded-lg border border-slate-200 text-left hover:border-slate-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.alt} className="aspect-square w-full object-cover" loading="lazy" />
              <span className="block truncate px-2 py-1 text-xs text-slate-600">{a.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Campo de formulário de imagem: guarda a URL escolhida em um input hidden. */
export function ImageField({ name, label, defaultValue = "", category, hint }: { name: string; label: string; defaultValue?: string; category?: string; hint?: string }) {
  const [url, setUrl] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-slate-400">Sem imagem</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} onClick={() => setOpen(true)}>
            {url ? "Trocar" : "Escolher"}
          </button>
          {url && (
            <button type="button" className={btnSecondary} onClick={() => setUrl("")}>
              Remover
            </button>
          )}
        </div>
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <MediaModal open={open} onClose={() => setOpen(false)} onSelect={(a) => setUrl(a.url)} category={category} />
    </div>
  );
}
