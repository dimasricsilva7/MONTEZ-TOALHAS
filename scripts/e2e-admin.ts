/**
 * Teste do painel admin em navegador headless (Playwright) contra servidor local.
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npx tsx scripts/e2e-admin.ts [baseUrl] [shotsDir]
 */
import { chromium, type Page } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@montez.local";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "senha-local-de-teste-123";
let failures = 0;
const check = (c: unknown, m: string) => {
  console.log(`${c ? "✔" : "✘"} ${m}`);
  if (!c) failures++;
};

async function pageOk(page: Page, path: string) {
  const errors: string[] = [];
  const onErr = (e: Error) => errors.push(e.message);
  page.on("pageerror", onErr);
  const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
  const body = await page.textContent("body");
  page.off("pageerror", onErr);
  const ok = res?.status() === 200 && !/Application error|Unhandled Runtime Error|Build Error/i.test(body ?? "") && errors.length === 0;
  check(ok, `admin ${path} carrega (${res?.status()})${errors.length ? ` erros: ${errors[0]}` : ""}`);
  return ok;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  ctx.setDefaultTimeout(180000);
  ctx.setDefaultNavigationTimeout(180000);

  // Sem sessão → redireciona ao login
  await page.goto(`${BASE}/admin/pedidos`);
  check(page.url().includes("/admin/login"), "rota protegida redireciona para login");
  const api = await page.request.get(`${BASE}/api/admin/media`);
  check(api.status() === 401, "API admin sem sessão retorna 401");

  // Senha errada
  await page.fill("#email", EMAIL);
  await page.fill("#password", "senha-errada-123");
  await page.click("form button");
  await page.waitForSelector("form [role=alert]", { timeout: 30000 });
  check(/inválidos/.test((await page.textContent("form [role=alert]")) ?? ""), "senha errada é recusada");

  // Login correto
  await page.fill("#password", PASSWORD);
  await page.click("form button");
  await page.waitForURL(`${BASE}/admin`, { timeout: 180000 });
  check(true, "login com sucesso");
  const cookie = (await ctx.cookies()).find((c) => c.name === "mz_admin");
  check(cookie?.httpOnly && cookie.sameSite === "Strict", "cookie de sessão HttpOnly + SameSite=Strict");

  for (const p of ["/admin", "/admin?periodo=30d", "/admin?periodo=custom&de=2026-09-01&ate=2026-09-30", "/admin/pedidos", "/admin/produtos", "/admin/produtos/novo", "/admin/cores", "/admin/imagens", "/admin/conteudo", "/admin/conteudo?secao=hero", "/admin/conteudo/faq", "/admin/conteudo/avaliacoes", "/admin/clientes", "/admin/analytics", "/admin/emails", "/admin/order-bumps", "/admin/upsells", "/admin/configuracoes", "/admin/auditoria"]) {
    await pageOk(page, p);
    if (SHOTS && ["/admin", "/admin/pedidos", "/admin/analytics"].includes(p)) await page.screenshot({ path: `${SHOTS}/admin${p.replace(/\//g, "_")}.png`, fullPage: true });
  }

  // Detalhe do primeiro pedido
  await page.goto(`${BASE}/admin/pedidos`);
  const first = page.locator("table a:has-text('Detalhes')").first();
  if (await first.count()) {
    await first.click();
    await page.waitForURL((u) => u.pathname.startsWith("/admin/pedidos/"));
    await page.waitForSelector("h1:has-text('Pedido MONTEZ-')");
    check(/Pedido MONTEZ-/.test((await page.textContent("h1")) ?? ""), "detalhe do pedido abre");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/admin_pedido_detalhe.png`, fullPage: true });
    // Reenviar e-mail com confirmação
    await page.click("button:has-text('Reenviar e-mail')");
    await page.click("button:has-text('Enviar agora')");
    await page.waitForSelector("text=/E-mail enviado|menos de 5 minutos/", { timeout: 60000 }).catch(() => {});
    const txt = (await page.textContent("body")) ?? "";
    check(/E-mail enviado|menos de 5 minutos/.test(txt), "reenvio manual de e-mail (com confirmação)");
    await page.click("button:has-text('Reenviar e-mail')");
    await page.click("button:has-text('Enviar agora')");
    await page.waitForSelector("text=/menos de 5 minutos/", { timeout: 60000 }).catch(() => {});
    check(/menos de 5 minutos/.test((await page.textContent("body")) ?? ""), "anti-spam bloqueia reenvio imediato");
    await page.keyboard.press("Escape");
  }

  // Conteúdo: altera a barra superior e verifica na loja
  await page.goto(`${BASE}/admin/conteudo?secao=announcement`);
  const marker = `Teste E2E ${Date.now()}`;
  await page.fill("input[name=announcement_bar]", marker);
  await page.click("button:has-text('Salvar')");
  await page.waitForSelector("form [role=status]", { timeout: 30000 });
  const store = await ctx.newPage();
  await store.goto(BASE + "/", { waitUntil: "networkidle" });
  check(((await store.textContent("body")) ?? "").includes(marker), "alteração de conteúdo aparece na loja");
  await page.click("button:has-text('Restaurar padrão')").catch(() => {});
  page.once("dialog", (d) => d.accept());
  await page.click("button:has-text('Restaurar padrão')").catch(() => {});
  await page.waitForTimeout(1500);

  // Logout
  await page.goto(`${BASE}/admin`);
  await page.click("aside button:has-text('Sair')");
  await page.waitForURL(/\/admin\/login/);
  check(true, "logout");
  await page.goto(`${BASE}/admin`);
  check(page.url().includes("/admin/login"), "sessão encerrada após logout");

  await browser.close();
  console.log(failures ? `\n${failures} falha(s)` : "\nAdmin: todas as verificações passaram.");
  process.exitCode = failures ? 1 : 0;
})();
