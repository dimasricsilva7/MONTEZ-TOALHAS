import "server-only";

/** "149,90" | "149.90" | "R$ 1.049,90" → centavos. Retorna null se inválido. */
export function parseMoney(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[R$\s]/g, "").trim();
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);
export const optStr = (fd: FormData, k: string, max = 500) => str(fd, k, max) || null;
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
export const int = (fd: FormData, k: string, fallback = 0) => {
  const n = Number.parseInt(String(fd.get(k) ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
};

export function jsonArray<T>(fd: FormData, k: string): T[] {
  try {
    const v = JSON.parse(String(fd.get(k) ?? "[]"));
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export const centsToInput = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
