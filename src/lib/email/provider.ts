import "server-only";

export type OutgoingEmail = { to: string; subject: string; html: string; text: string };
export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

/**
 * Provedor configurável por EMAIL_PROVIDER:
 *  - resend  → EMAIL_API_KEY (API REST da Resend, sem SDK)
 *  - smtp    → SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE
 *  - console → apenas registra no log (desenvolvimento)
 * Credenciais nunca ficam no código.
 */
export function emailProvider(): "resend" | "smtp" | "console" | "none" {
  const p = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();
  if (p === "resend" && process.env.EMAIL_API_KEY) return "resend";
  if (p === "smtp" && process.env.SMTP_HOST) return "smtp";
  if (p === "console") return "console";
  return "none";
}

export async function deliver(email: OutgoingEmail): Promise<SendResult> {
  const from = process.env.EMAIL_FROM;
  const replyTo = process.env.EMAIL_REPLY_TO || undefined;
  const provider = emailProvider();

  if (provider === "none") return { ok: false, error: "Provedor de e-mail não configurado (EMAIL_PROVIDER/EMAIL_API_KEY)." };
  if (!from && provider !== "console") return { ok: false, error: "EMAIL_FROM não configurado." };

  if (provider === "console") {
    console.info(`[email:console] para=${email.to.replace(/(.{2}).*@/, "$1***@")} assunto="${email.subject}"`);
    return { ok: true, id: `console_${Date.now()}` };
  }

  if (provider === "resend") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.EMAIL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html, text: email.text, ...(replyTo ? { reply_to: replyTo } : {}) }),
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${json.message ?? "erro"}`.slice(0, 300) };
      return { ok: true, id: json.id ?? null };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "erro de rede" };
    }
  }

  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    const info = await transport.sendMail({ from, to: email.to, replyTo, subject: email.subject, html: email.html, text: email.text });
    return { ok: true, id: info.messageId ?? null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 300) : "erro SMTP" };
  }
}
