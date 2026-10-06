/**
 * Testa upload de imagem (arquivo e link), "Online agora" e a página de Integrações.
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npx tsx scripts/e2e-media-online.ts [baseUrl] [shotsDir]
 */
import { chromium } from "playwright";
import sharp from "sharp";

const B = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3];
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@montez.local";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "senha-local-de-teste-123";
const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
let failures = 0;
const check = (c: unknown, m: string) => {
  console.log(`${c ? "✔" : "✘"} ${m}`);
  if (!c) failures++;
};

(async () => {
  const browser = await chromium.launch();

  // 1) Visitante "real" (celular) vindo do Instagram
  const visitor = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: MOBILE_UA });
  const vp = await visitor.newPage();
  await vp.goto(`${B}/?utm_source=instagram&utm_medium=social&utm_campaign=teste_online`, { waitUntil: "networkidle" });
  await vp.waitForTimeout(2500);
  await vp.goto(`${B}/produto/montez-m6`, { waitUntil: "networkidle" });
  await vp.waitForTimeout(2000);

  // 2) Admin
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  ctx.setDefaultTimeout(120000);
  const p = await ctx.newPage();
  await p.goto(`${B}/admin/login`);
  await p.fill("#email", EMAIL);
  await p.fill("#password", PASSWORD);
  await p.click("form button");
  await p.waitForURL(`${B}/admin`);

  // Online agora
  await p.waitForSelector("text=Online agora");
  await p.waitForFunction(() => /Online agora\s*[1-9]/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  const dash = await p.textContent("body");
  check(/Online agora\s*[1-9]/.test(dash ?? ""), "dashboard mostra visitante online");
  check(/Instagram/.test(dash ?? ""), "origem Instagram identificada");
  check(/Celular/.test(dash ?? ""), "dispositivo celular identificado");
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/online.png`, clip: { x: 0, y: 0, width: 1440, height: 700 } });

  // Upload por arquivo (JPEG 3000x2000 gerado na hora)
  const jpg = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 219, g: 201, b: 172 } } }).jpeg({ quality: 90 }).toBuffer();
  const up = await p.request.post(`${B}/api/admin/upload`, { headers: { Origin: B }, multipart: { file: { name: "toalha-areia.jpg", mimeType: "image/jpeg", buffer: jpg }, category: "PRODUTO", name: "toalha-areia" } });
  const upJson = (await up.json().catch(() => ({}))) as { asset?: { url: string } };
  check(up.ok() && upJson.asset?.url?.startsWith("/media/"), `upload por arquivo (${up.status()})`);
  if (upJson.asset) {
    const img = await p.request.get(`${B}${upJson.asset.url}`);
    const buf = await img.body();
    const meta = await sharp(buf).metadata();
    check(img.ok() && meta.format === "webp" && (meta.width ?? 0) <= 2000, `imagem servida em WebP ${meta.width}x${meta.height}`);
    check(/immutable/.test(img.headers()["cache-control"] ?? ""), "cache imutável de CDN");
  }

  // Upload pela interface (modal da biblioteca, no produto)
  await p.goto(`${B}/admin/produtos`);
  await p.click("table a:has-text('Editar')");
  await p.waitForSelector("text=Imagens do produto");
  await p.click("button:has-text('Escolher / enviar')");
  const [chooser] = await Promise.all([p.waitForEvent("filechooser"), p.click("button:has-text('Enviar do computador')")]);
  await chooser.setFiles({ name: "kit.jpg", mimeType: "image/jpeg", buffer: jpg });
  await p.waitForFunction(() => !document.querySelector("[role=dialog]"), null, { timeout: 60000 });
  await p.click("button:text-is('Adicionar')");
  await p.waitForSelector("text=Imagem adicionada", { timeout: 60000 }).catch(() => {});
  check(/Imagem adicionada/.test((await p.textContent("body")) ?? ""), "upload pela interface + vínculo ao produto");

  // Importação por link
  const link = await p.request.post(`${B}/api/admin/media/import`, { headers: { Origin: B }, data: { url: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Example.jpg", mode: "download", category: "PRODUTO" } });
  const linkJson = (await link.json().catch(() => ({}))) as { asset?: { url: string }; error?: string };
  check(link.ok() && linkJson.asset?.url?.startsWith("/media/"), `importação por link baixada (${link.status()} ${linkJson.error ?? ""})`);
  const ssrf = await p.request.post(`${B}/api/admin/media/import`, { headers: { Origin: B }, data: { url: "http://127.0.0.1:3000/admin", mode: "download" } });
  check(ssrf.status() === 422, "link para endereço interno bloqueado (SSRF)");
  const direct = await p.request.post(`${B}/api/admin/media/import`, { headers: { Origin: B }, data: { url: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Example.jpg", mode: "link" } });
  check(direct.ok(), "imagem por link direto");

  // Integrações
  await p.goto(`${B}/admin/integracoes`);
  const integ = (await p.textContent("body")) ?? "";
  check(/Banco de dados/.test(integ) && /Conectado/.test(integ), "página de integrações testa conexões");
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/integracoes.png`, fullPage: true });

  await browser.close();
  console.log(failures ? `\n${failures} falha(s)` : "\nTudo certo.");
  process.exitCode = failures ? 1 : 0;
})();
