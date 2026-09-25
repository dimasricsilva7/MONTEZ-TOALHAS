import { NextResponse, type NextRequest } from "next/server";

/**
 * Primeira barreira do admin: sem cookie de sessão → login (páginas) ou 401 (API).
 * A validação real da sessão (hash no banco, expiração) acontece no servidor em
 * cada página/ação via requireAdmin().
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("mz_admin")?.value);

  if (pathname.startsWith("/api/admin")) {
    if (!hasSession) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.next();
  }
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
