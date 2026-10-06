import "server-only";
import { db } from "@/lib/db";
import { bravopayMode, siteUrl } from "@/lib/env";
import { emailProvider } from "@/lib/email/provider";

export type CheckState = "ok" | "pending" | "error" | "warning";
export type IntegrationCheck = {
  id: string;
  name: string;
  state: CheckState;
  summary: string;
  details?: string[];
  vars: { key: string; set: boolean; required: boolean }[];
  action?: string;
};

const has = (k: string) => Boolean(process.env[k]);
const v = (key: string, required = true) => ({ key, set: has(key), required });

async function timed<T>(p: Promise<T>, ms = 6000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), ms))]);
}

async function checkDatabase(): Promise<IntegrationCheck> {
  const started = Date.now();
  try {
    await timed(db.$queryRaw`SELECT 1`);
    const [products, orders] = await Promise.all([db.product.count(), db.order.count({ where: { deletedAt: null } })]);
    return { id: "db", name: "Banco de dados (Postgres)", state: "ok", summary: `Conectado (${Date.now() - started} ms) · ${products} produtos · ${orders} pedidos`, vars: [v("DATABASE_URL"), v("DATABASE_URL_UNPOOLED")] };
  } catch (e) {
    return { id: "db", name: "Banco de dados (Postgres)", state: "error", summary: `Falha: ${e instanceof Error ? e.message.slice(0, 120) : "erro"}`, vars: [v("DATABASE_URL"), v("DATABASE_URL_UNPOOLED")] };
  }
}

async function checkBravopay(): Promise<IntegrationCheck> {
  const vars = [v("BRAVOPAY_API_KEY"), v("BRAVOPAY_PRODUCT_ID", false)];
  const mode = bravopayMode();
  if (mode === "mock") return { id: "bravopay", name: "Pagamento PIX (BravoPay)", state: "warning", summary: "Modo de teste (PIX fictício)", vars };
  if (mode === "disabled") return { id: "bravopay", name: "Pagamento PIX (BravoPay)", state: "pending", summary: "Sem chave — o checkout está bloqueado", vars, action: "Defina BRAVOPAY_API_KEY na Vercel." };
  try {
    const base = (process.env.BRAVOPAY_BASE_URL || "https://bravopay.club/api/v1").replace(/\/$/, "");
    const res = await timed(fetch(`${base}/transactions?limit=1`, { headers: { Authorization: `Bearer ${process.env.BRAVOPAY_API_KEY}` }, cache: "no-store" }));
    if (res.status === 401 || res.status === 403) return { id: "bravopay", name: "Pagamento PIX (BravoPay)", state: "error", summary: "Chave recusada pela BravoPay", vars, action: "Confira BRAVOPAY_API_KEY." };
    if (!res.ok) return { id: "bravopay", name: "Pagamento PIX (BravoPay)", state: "warning", summary: `BravoPay respondeu ${res.status}`, vars };
    const [pending, paid] = await Promise.all([
      db.order.count({ where: { status: "PENDING_PAYMENT", deletedAt: null } }),
      db.order.count({ where: { status: "PAID", deletedAt: null } }),
    ]);
    return { id: "bravopay", name: "Pagamento PIX (BravoPay)", state: "ok", summary: "Conectado — API real (cobranças de verdade)", details: [`${paid} pedido(s) pago(s) · ${pending} aguardando pagamento`], vars };
  } catch (e) {
    return { id: "bravopay", name: "Pagamento PIX (BravoPay)", state: "error", summary: `Sem resposta: ${e instanceof Error ? e.message : "erro"}`, vars };
  }
}

async function checkWebhook(): Promise<IntegrationCheck> {
  const vars = [v("BRAVOPAY_WEBHOOK_SECRET")];
  const url = `${siteUrl()}/api/webhooks/bravopay`;
  const [last, lastOk] = await Promise.all([
    db.webhookEvent.findFirst({ orderBy: { receivedAt: "desc" }, select: { receivedAt: true, eventType: true, status: true } }),
    db.webhookEvent.findFirst({ where: { status: "PROCESSED" }, orderBy: { receivedAt: "desc" }, select: { receivedAt: true } }),
  ]);
  const details = [`URL para cadastrar: ${url}`, last ? `Último evento: ${last.eventType} (${last.status}) em ${last.receivedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Nenhum evento recebido ainda"];
  if (!has("BRAVOPAY_WEBHOOK_SECRET"))
    return {
      id: "webhook",
      name: "Webhook BravoPay (confirmação instantânea)",
      state: "pending",
      summary: "Não cadastrado — pagamentos confirmados pela consulta à API (alguns segundos a mais)",
      details,
      vars,
      action: "No painel BravoPay → Integrações, cadastre a URL acima com os eventos transaction.* e copie o segredo (whsec_…) para BRAVOPAY_WEBHOOK_SECRET.",
    };
  return { id: "webhook", name: "Webhook BravoPay (confirmação instantânea)", state: lastOk ? "ok" : "warning", summary: lastOk ? "Recebendo eventos" : "Segredo definido — aguardando o primeiro evento", details, vars };
}

async function checkMeta(): Promise<IntegrationCheck> {
  const pixels = [
    { id: process.env.NEXT_PUBLIC_META_PIXEL_ID, token: process.env.META_CONVERSIONS_API_TOKEN },
    { id: process.env.NEXT_PUBLIC_META_PIXEL_ID_SECONDARY, token: process.env.META_CONVERSIONS_API_TOKEN_SECONDARY || process.env.META_CONVERSIONS_API_TOKEN },
  ].filter((p) => p.id);
  const vars = [v("NEXT_PUBLIC_META_PIXEL_ID"), v("META_CONVERSIONS_API_TOKEN"), v("NEXT_PUBLIC_META_PIXEL_ID_SECONDARY", false), v("META_CONVERSIONS_API_TOKEN_SECONDARY", false), v("META_TEST_EVENT_CODE", false)];
  if (!pixels.length) return { id: "meta", name: "Meta Pixel + Conversions API", state: "pending", summary: "Nenhum pixel configurado", vars };
  const details: string[] = [];
  let bad = 0;
  for (const p of pixels) {
    if (!p.token) {
      details.push(`Pixel ${p.id}: navegador OK · CAPI sem token`);
      bad++;
      continue;
    }
    try {
      // Valida o token sem enviar evento: com "data" vazio, um token válido recebe
      // "param data must be non-empty" (código 100); um inválido recebe erro de autenticação (190).
      const res = await timed(
        fetch(`https://graph.facebook.com/v21.0/${p.id}/events?access_token=${encodeURIComponent(p.token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: [] }),
          cache: "no-store",
        })
      );
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } };
      const tokenOk = json.error?.code === 100 && /non-empty/i.test(json.error.message ?? "");
      if (tokenOk) details.push(`Pixel ${p.id}: navegador + Conversions API OK`);
      else {
        bad++;
        details.push(`Pixel ${p.id}: token CAPI recusado — ${json.error?.message?.slice(0, 90) ?? res.status}`);
      }
    } catch {
      details.push(`Pixel ${p.id}: não foi possível validar o token agora`);
    }
  }
  const events = await db.analyticsEvent.count({ where: { name: "page_view", createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } });
  details.push(`${events} visualizações de página registradas nas últimas 24 h`);
  return { id: "meta", name: "Meta Pixel + Conversions API", state: bad ? "warning" : "ok", summary: `${pixels.length} pixel(s) ativo(s)`, details, vars };
}

async function checkEmail(): Promise<IntegrationCheck> {
  const provider = emailProvider();
  const vars = [v("EMAIL_PROVIDER"), v("EMAIL_FROM"), v("EMAIL_API_KEY", provider !== "smtp"), v("EMAIL_REPLY_TO", false)];
  const counts = await db.emailEvent.groupBy({ by: ["status"], _count: true });
  const c = (s: string) => counts.find((x) => x.status === s)?._count ?? 0;
  const details = [`${c("SENT")} enviados · ${c("SCHEDULED")} agendados · ${c("FAILED")} com falha`];
  if (provider === "none")
    return {
      id: "email",
      name: "E-mails automáticos",
      state: "pending",
      summary: "Sem provedor — confirmação e recuperação de PIX não são enviadas",
      details,
      vars,
      action: "Defina EMAIL_PROVIDER=resend, EMAIL_API_KEY (chave da Resend) e EMAIL_FROM com um domínio verificado na Resend.",
    };
  if (provider === "console") return { id: "email", name: "E-mails automáticos", state: "warning", summary: "Modo console (só registra, não envia)", details, vars };
  if (provider === "resend") {
    try {
      const res = await timed(fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${process.env.EMAIL_API_KEY}` }, cache: "no-store" }));
      if (res.status === 401 || res.status === 403) return { id: "email", name: "E-mails automáticos", state: "error", summary: "Chave da Resend recusada", details, vars };
      const json = (await res.json().catch(() => ({}))) as { data?: { name: string; status: string }[] };
      const from = process.env.EMAIL_FROM ?? "";
      const domain = from.match(/@([^>\s]+)/)?.[1];
      const d = json.data?.find((x) => x.name === domain);
      if (domain && d && d.status !== "verified") return { id: "email", name: "E-mails automáticos", state: "warning", summary: `Domínio ${domain} ainda não verificado na Resend`, details, vars };
      return { id: "email", name: "E-mails automáticos", state: "ok", summary: `Resend conectado · remetente ${from}`, details, vars };
    } catch {
      return { id: "email", name: "E-mails automáticos", state: "warning", summary: "Não foi possível validar a Resend agora", details, vars };
    }
  }
  return { id: "email", name: "E-mails automáticos", state: "ok", summary: "SMTP configurado", details, vars };
}

async function checkMedia(): Promise<IntegrationCheck> {
  const [total, inDb] = await Promise.all([db.mediaAsset.count(), db.mediaAsset.count({ where: { storage: "db" } })]);
  return {
    id: "media",
    name: "Imagens",
    state: "ok",
    summary: `Armazenadas na própria loja (banco + CDN) · ${total} imagem(ns)`,
    details: [`${inDb} enviadas/baixadas · ${total - inDb} por link externo ou antigas`, "Não depende do Vercel Blob (suspenso no plano atual)."],
    vars: [v("BLOB_READ_WRITE_TOKEN", false)],
  };
}

async function checkJobs(): Promise<IntegrationCheck> {
  const tick = await db.jobLock.findUnique({ where: { name: "tick" } });
  const ago = tick ? Math.round((Date.now() - tick.lockedAt.getTime()) / 60_000) : null;
  return {
    id: "jobs",
    name: "Tarefas automáticas (reconciliação de PIX e e-mails)",
    state: has("CRON_SECRET") ? (ago != null && ago <= 30 ? "ok" : "warning") : "error",
    summary: ago == null ? "Ainda não executou" : `Última execução há ${ago} min`,
    details: [
      "Rodam a partir das visitas do site (1×/min), pelo GitHub Actions e pelo cron diário da Vercel.",
      `Para garantir execução a cada minuto mesmo sem visitas, cadastre ${siteUrl()}/api/tick no cron-job.org (gratuito).`,
    ],
    vars: [v("CRON_SECRET")],
  };
}

function checkSite(): IntegrationCheck {
  return {
    id: "site",
    name: "Site e segurança",
    state: has("NEXT_PUBLIC_SITE_URL") && has("AUTH_SECRET") ? "ok" : "error",
    summary: siteUrl(),
    vars: [v("NEXT_PUBLIC_SITE_URL"), v("AUTH_SECRET"), v("ADMIN_EMAIL", false), v("ADMIN_PASSWORD_HASH", false)],
  };
}

function checkGa(): IntegrationCheck {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  return { id: "ga", name: "Google Analytics 4 (opcional)", state: id ? "ok" : "pending", summary: id ? `Ativo (${id})` : "Desativado — o analytics próprio do admin já cobre o essencial", vars: [v("NEXT_PUBLIC_GA_MEASUREMENT_ID", false)] };
}

export async function integrationChecks(): Promise<IntegrationCheck[]> {
  const safe = (p: Promise<IntegrationCheck>, id: string, name: string) =>
    p.catch((e): IntegrationCheck => ({ id, name, state: "error", summary: e instanceof Error ? e.message.slice(0, 120) : "erro", vars: [] }));
  return Promise.all([
    Promise.resolve(checkSite()),
    safe(checkDatabase(), "db", "Banco de dados"),
    safe(checkBravopay(), "bravopay", "BravoPay"),
    safe(checkWebhook(), "webhook", "Webhook"),
    safe(checkMeta(), "meta", "Meta"),
    safe(checkEmail(), "email", "E-mails"),
    safe(checkMedia(), "media", "Imagens"),
    safe(checkJobs(), "jobs", "Tarefas"),
    Promise.resolve(checkGa()),
  ]);
}
