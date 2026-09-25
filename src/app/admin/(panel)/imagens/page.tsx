import type { Metadata } from "next";
import { MediaCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { EmptyState, PageHeader, inputCls } from "@/components/admin/ui";
import { CATEGORY_LABEL, MEDIA_CATEGORIES } from "@/utils/media";
import { MediaUploader, MediaEditor } from "./MediaClient";

export const metadata: Metadata = { title: "Imagens" };

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ categoria?: string; q?: string }> }) {
  const sp = await searchParams;
  const cat = (Object.values(MediaCategory) as string[]).includes(sp.categoria ?? "") ? (sp.categoria as MediaCategory) : undefined;
  const assets = await db.mediaAsset.findMany({
    where: { ...(cat ? { category: cat } : {}), ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { alt: { contains: sp.q, mode: "insensitive" } }] } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader title="Imagens" description="Biblioteca de mídia. Envios são convertidos para WebP e redimensionados automaticamente." actions={<MediaUploader category={cat ?? "OUTROS"} />} />
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={sp.q} placeholder="Buscar por nome ou alt" className={`${inputCls} !w-60`} />
        <select name="categoria" defaultValue={cat ?? ""} className={`${inputCls} !w-48`}>
          <option value="">Todas as categorias</option>
          {MEDIA_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </select>
        <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Filtrar</button>
      </form>
      {assets.length === 0 ? (
        <EmptyState title="Nenhuma imagem ainda" text="Envie fotos do hero, dos produtos por cor, lifestyle e texturas. Depois selecione-as em Conteúdo e Produtos." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {assets.map((a) => (
            <MediaEditor key={a.id} asset={{ id: a.id, name: a.name, url: a.url, alt: a.alt, category: a.category, device: a.device, page: a.page ?? "", section: a.section ?? "", active: a.active, size: a.size, width: a.width, height: a.height }} />
          ))}
        </div>
      )}
    </>
  );
}
