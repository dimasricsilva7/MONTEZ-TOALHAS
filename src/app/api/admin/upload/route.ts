import { NextResponse, type NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { MediaCategory, MediaDevice } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/request";
import { slugify } from "@/utils/format";

export const dynamic = "force-dynamic";

const MAX = 4 * 1024 * 1024; // limite de corpo de função da Vercel (~4,5 MB)
const TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/avif": "avif" };

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Formato inválido. Use WEBP, JPG, PNG ou AVIF." }, { status: 422 });
  if (file.size > MAX) return NextResponse.json({ error: "Arquivo acima de 4 MB." }, { status: 422 });

  const category = (Object.values(MediaCategory) as string[]).includes(String(fd?.get("category"))) ? (String(fd!.get("category")) as MediaCategory) : "OUTROS";
  const device = (Object.values(MediaDevice) as string[]).includes(String(fd?.get("device"))) ? (String(fd!.get("device")) as MediaDevice) : "ALL";
  const baseName = String(fd?.get("name") || file.name.replace(/\.[^.]+$/, "")).slice(0, 120);
  const key = `media/${category.toLowerCase()}/${Date.now()}-${slugify(baseName).slice(0, 50) || "imagem"}.${ext}`;

  let url: string;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, file, { access: "public", contentType: file.type, cacheControlMaxAge: 31536000 });
    url = blob.url;
  } else if (process.env.NODE_ENV !== "production") {
    // Desenvolvimento sem Blob: salva em public/uploads (não usar em produção)
    const dest = path.join(process.cwd(), "public", "uploads", key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, Buffer.from(await file.arrayBuffer()));
    url = `/uploads/${key}`;
  } else {
    return NextResponse.json({ error: "Armazenamento não configurado (BLOB_READ_WRITE_TOKEN)." }, { status: 500 });
  }

  const asset = await db.mediaAsset.create({
    data: {
      name: baseName,
      url,
      pathname: key,
      alt: String(fd?.get("alt") ?? "").slice(0, 200),
      category,
      device,
      page: String(fd?.get("page") ?? "").slice(0, 60) || null,
      section: String(fd?.get("section") ?? "").slice(0, 60) || null,
      mimeType: file.type,
      size: file.size,
      width: Number(fd?.get("width")) || null,
      height: Number(fd?.get("height")) || null,
    },
  });
  await audit(admin.id, "media_uploaded", "media", asset.id, { name: asset.name, category });
  return NextResponse.json({ asset });
}
