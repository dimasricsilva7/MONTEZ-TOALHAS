import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CONTENT_DEFAULTS, SETTING_DEFAULTS } from "@/lib/content-defaults";

export type SiteContent = Record<string, string>;

const toStr = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

export const getContent = unstable_cache(
  async (): Promise<SiteContent> => {
    const rows = await db.siteContent.findMany().catch(() => []);
    const map: SiteContent = { ...CONTENT_DEFAULTS };
    for (const r of rows) map[r.key] = toStr(r.value);
    return map;
  },
  ["site-content"],
  { tags: ["content"], revalidate: 300 }
);

export const getSettings = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const rows = await db.setting.findMany().catch(() => []);
    const map: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const r of rows) map[r.key] = toStr(r.value);
    return map;
  },
  ["settings"],
  { tags: ["settings"], revalidate: 300 }
);

/** Leitura sem cache (jobs, checkout): valores sempre atuais. */
export async function getSettingsFresh(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany();
  const map: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) map[r.key] = toStr(r.value);
  return map;
}

export function settingInt(settings: Record<string, string>, key: string, fallback: number): number {
  const n = Number.parseInt(settings[key] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

export const isOn = (v: string | undefined) => v === "true";

export const getFaqs = unstable_cache(
  async () => db.faq.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }).catch(() => []),
  ["faqs"],
  { tags: ["faq"], revalidate: 300 }
);

export const getReviews = unstable_cache(
  async () =>
    db.review
      .findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 24 })
      .catch(() => []),
  ["reviews"],
  { tags: ["reviews"], revalidate: 300 }
);
