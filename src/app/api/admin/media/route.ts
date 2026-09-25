import { NextResponse, type NextRequest } from "next/server";
import { MediaCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cat = req.nextUrl.searchParams.get("category");
  const q = req.nextUrl.searchParams.get("q")?.slice(0, 80);
  const assets = await db.mediaAsset.findMany({
    where: {
      active: true,
      ...(cat && (Object.values(MediaCategory) as string[]).includes(cat) ? { category: cat as MediaCategory } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { alt: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 120,
    select: { id: true, name: true, url: true, alt: true, category: true, device: true },
  });
  return NextResponse.json({ assets });
}
