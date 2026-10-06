import "server-only";

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export const isProductionDeploy = () =>
  process.env.VERCEL_ENV === "production" || (process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV);

/**
 * Modo mock da BravoPay: gera PIX fictício para testar o fluxo sem cobrança
 * real. Bloqueado em deploy de produção — lá só a API real é aceita.
 */
export function bravopayMode(): "live" | "mock" | "disabled" {
  if (process.env.BRAVOPAY_MODE === "mock") return isProductionDeploy() ? "disabled" : "mock";
  return process.env.BRAVOPAY_API_KEY ? "live" : "disabled";
}

export type EnvCheck = { key: string; ok: boolean; required: boolean; hint: string };

/** Diagnóstico exibido no admin (nunca expõe valores, apenas presença). */
export function envHealth(): EnvCheck[] {
  const has = (k: string) => Boolean(process.env[k]);
  return [
    { key: "DATABASE_URL", ok: has("DATABASE_URL"), required: true, hint: "Postgres (Neon/Supabase)" },
    { key: "NEXT_PUBLIC_SITE_URL", ok: has("NEXT_PUBLIC_SITE_URL"), required: true, hint: "URL pública do site" },
    { key: "AUTH_SECRET", ok: has("AUTH_SECRET"), required: true, hint: "Segredo para hashes/assinaturas" },
    { key: "BRAVOPAY_API_KEY", ok: has("BRAVOPAY_API_KEY"), required: true, hint: "Chave da API BravoPay (bp_live_...)" },
    { key: "BRAVOPAY_WEBHOOK_SECRET", ok: has("BRAVOPAY_WEBHOOK_SECRET"), required: false, hint: "Segredo do webhook (whsec_...)" },
    { key: "BRAVOPAY_PRODUCT_ID", ok: has("BRAVOPAY_PRODUCT_ID"), required: false, hint: "ID do produto BravoPay (atribuição UTMify)" },
    { key: "CRON_SECRET", ok: has("CRON_SECRET"), required: true, hint: "Protege os endpoints de jobs" },
    { key: "EMAIL_PROVIDER", ok: has("EMAIL_PROVIDER"), required: true, hint: "resend | smtp | console" },
    { key: "EMAIL_FROM", ok: has("EMAIL_FROM"), required: true, hint: "Remetente verificado" },
    { key: "EMAIL_API_KEY", ok: has("EMAIL_API_KEY") || process.env.EMAIL_PROVIDER === "smtp", required: false, hint: "Chave Resend (se EMAIL_PROVIDER=resend)" },
    { key: "BLOB_READ_WRITE_TOKEN", ok: has("BLOB_READ_WRITE_TOKEN"), required: false, hint: "Vercel Blob (opcional — imagens ficam no banco)" },
    { key: "NEXT_PUBLIC_META_PIXEL_ID", ok: has("NEXT_PUBLIC_META_PIXEL_ID"), required: false, hint: "Meta Pixel" },
    { key: "META_CONVERSIONS_API_TOKEN", ok: has("META_CONVERSIONS_API_TOKEN"), required: false, hint: "Meta CAPI (servidor)" },
    { key: "NEXT_PUBLIC_GA_MEASUREMENT_ID", ok: has("NEXT_PUBLIC_GA_MEASUREMENT_ID"), required: false, hint: "Google Analytics 4" },
  ];
}
