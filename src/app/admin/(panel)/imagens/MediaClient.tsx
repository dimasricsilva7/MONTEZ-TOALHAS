"use client";

import { useRouter } from "next/navigation";
import { ActionForm, ConfirmAction, SubmitButton } from "@/components/admin/client";
import { UploadButton } from "@/components/admin/media";
import { CATEGORY_LABEL, MEDIA_CATEGORIES } from "@/utils/media";
import { inputCls, labelCls } from "@/components/admin/ui";
import { deleteMediaAction, updateMediaAction } from "./actions";

export function MediaUploader({ category }: { category: string }) {
  const router = useRouter();
  return <UploadButton category={category} multiple label="Enviar imagens" onUploaded={() => router.refresh()} />;
}

type A = { id: string; name: string; url: string; alt: string; category: string; device: string; page: string; section: string; active: boolean; size: number | null; width: number | null; height: number | null };

export function MediaEditor({ asset }: { asset: A }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <a href={asset.url} target="_blank" rel="noopener noreferrer" className="block bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.url} alt={asset.alt} className={`aspect-[4/3] w-full object-cover ${asset.active ? "" : "opacity-40"}`} loading="lazy" />
      </a>
      <div className="p-3">
        <p className="mb-2 text-[11px] text-slate-500">
          {asset.width && asset.height ? `${asset.width}×${asset.height}px · ` : ""}
          {asset.size ? `${Math.round(asset.size / 1024)} KB` : ""}
        </p>
        <ActionForm action={updateMediaAction} className="space-y-2">
          <input type="hidden" name="id" value={asset.id} />
          <input name="name" defaultValue={asset.name} className={inputCls} aria-label="Nome" />
          <input name="alt" defaultValue={asset.alt} placeholder="Texto alternativo (acessibilidade/SEO)" className={inputCls} aria-label="Alt" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Categoria</label>
              <select name="category" defaultValue={asset.category} className={inputCls}>
                {MEDIA_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Dispositivo</label>
              <select name="device" defaultValue={asset.device} className={inputCls}>
                <option value="ALL">Todos</option>
                <option value="DESKTOP">Desktop</option>
                <option value="MOBILE">Mobile</option>
              </select>
            </div>
            <input name="page" defaultValue={asset.page} placeholder="Página" className={inputCls} aria-label="Página" />
            <input name="section" defaultValue={asset.section} placeholder="Seção" className={inputCls} aria-label="Seção" />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={asset.active} /> Ativa
            </label>
            <button type="button" className="text-xs text-slate-500 underline" onClick={() => navigator.clipboard.writeText(asset.url)}>
              Copiar URL
            </button>
          </div>
          <SubmitButton className="h-9 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white">Salvar</SubmitButton>
        </ActionForm>
        <div className="mt-2">
          <ConfirmAction action={deleteMediaAction} label="Excluir" danger confirmLabel="Excluir imagem" description="A imagem será removida do armazenamento e dos produtos que a usam." hidden={{ id: asset.id }} />
        </div>
      </div>
    </div>
  );
}
