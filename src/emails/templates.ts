/**
 * Templates transacionais MONTEZ — HTML inline compatível com clientes de e-mail.
 * Todo conteúdo dinâmico passa por esc() para evitar injeção de HTML.
 */
import { formatBRL } from "@/utils/format";

export const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export type EmailOrder = {
  orderNumber: string;
  customerName: string;
  totalCents: number;
  shippingCents: number;
  statusLabel: string;
  items: { name: string; color: string | null; quantity: number; totalCents: number }[];
  address: { street: string; number: string; complement?: string | null; district: string; city: string; state: string; cep: string };
  trackingCode?: string | null;
};

const C = { bg: "#F4EEE5", card: "#FFFFFF", ink: "#1B1A18", muted: "#6F6152", line: "#E4DBCD", olive: "#4B5637" };

function layout(title: string, preheader: string, body: string, store: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:${C.bg};font-family:Helvetica,Arial,sans-serif;color:${C.ink};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td align="center" style="padding:8px 0 24px;font-family:Georgia,serif;font-size:26px;letter-spacing:10px;color:${C.ink};">MONTEZ<div style="font-family:Helvetica,Arial,sans-serif;font-size:9px;letter-spacing:4px;color:${C.muted};margin-top:6px;">HOTEL COLLECTION</div></td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:32px 28px;">${body}</td></tr>
<tr><td align="center" style="padding:20px 8px;font-size:11px;line-height:17px;color:${C.muted};">${esc(store)} · Este é um e-mail transacional referente ao seu pedido.</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;"><tr><td style="background:${C.ink};border-radius:999px;"><a href="${esc(href)}" style="display:inline-block;padding:14px 28px;color:#fff;text-decoration:none;font-size:13px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">${esc(label)}</a></td></tr></table>`;
}

function itemsTable(o: EmailOrder) {
  const rows = o.items
    .map(
      (i) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:14px;">${esc(i.name)}${i.color ? `<div style="font-size:12px;color:${C.muted};">Cor: ${esc(i.color)}</div>` : ""}</td><td style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:14px;text-align:center;">${i.quantity}</td><td style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:14px;text-align:right;">${formatBRL(i.totalCents)}</td></tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
<tr><td style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted};padding-bottom:6px;">Produto</td><td style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted};text-align:center;">Qtd.</td><td style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted};text-align:right;">Valor</td></tr>
${rows}
<tr><td colspan="2" style="padding:10px 0 0;font-size:13px;color:${C.muted};">Frete</td><td style="padding:10px 0 0;text-align:right;font-size:13px;">${o.shippingCents ? formatBRL(o.shippingCents) : "Grátis"}</td></tr>
<tr><td colspan="2" style="padding:6px 0 0;font-size:15px;font-weight:bold;">Total</td><td style="padding:6px 0 0;text-align:right;font-size:15px;font-weight:bold;">${formatBRL(o.totalCents)}</td></tr>
</table>`;
}

function addressBlock(o: EmailOrder) {
  const a = o.address;
  return `<p style="font-size:13px;line-height:20px;color:${C.muted};margin:16px 0 0;"><strong style="color:${C.ink};">Endereço de entrega</strong><br>${esc(a.street)}, ${esc(a.number)}${a.complement ? ` — ${esc(a.complement)}` : ""}<br>${esc(a.district)} · ${esc(a.city)}/${esc(a.state)} · CEP ${esc(a.cep)}</p>`;
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

export function purchaseConfirmationEmail(o: EmailOrder, trackUrl: string, store: string) {
  const subject = "Seu pedido MONTEZ foi confirmado.";
  const body = `<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 8px;">Pedido confirmado.</h1>
<p style="font-size:15px;line-height:23px;margin:0;">Olá, ${esc(firstName(o.customerName))}! Recebemos o seu pagamento e o pedido <strong>${esc(o.orderNumber)}</strong> já está com a nossa equipe.</p>
<p style="font-size:13px;color:${C.muted};margin:12px 0 0;">Status: <strong style="color:${C.olive};">${esc(o.statusLabel)}</strong></p>
${itemsTable(o)}${addressBlock(o)}
${button(trackUrl, "Acompanhar pedido")}
<p style="font-size:13px;line-height:20px;color:${C.muted};margin:16px 0 0;">Assim que o pedido for despachado, você recebe o código de rastreio. Obrigado por escolher a MONTEZ.</p>`;
  const text = `Pedido confirmado — ${o.orderNumber}\n\nOlá, ${firstName(o.customerName)}! Recebemos o seu pagamento.\n\n${o.items
    .map((i) => `${i.quantity}x ${i.name}${i.color ? ` (${i.color})` : ""} — ${formatBRL(i.totalCents)}`)
    .join("\n")}\nTotal: ${formatBRL(o.totalCents)}\n\nAcompanhe: ${trackUrl}`;
  return { subject, html: layout(subject, `Pedido ${o.orderNumber} confirmado`, body, store), text };
}

export function pixRecoveryEmail(o: EmailOrder, resumeUrl: string, store: string) {
  const subject = "Seu pedido MONTEZ está esperando por você";
  const body = `<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 8px;">Seu pedido está reservado.</h1>
<p style="font-size:15px;line-height:23px;margin:0;">Olá, ${esc(firstName(o.customerName))}! Notamos que o PIX do pedido <strong>${esc(o.orderNumber)}</strong> ainda não foi pago. Se quiser concluir, é só voltar ao pagamento pelo botão abaixo.</p>
${itemsTable(o)}
${button(resumeUrl, "Voltar ao pagamento")}
<p style="font-size:12px;line-height:18px;color:${C.muted};margin:16px 0 0;">Se você já pagou, desconsidere este e-mail — a confirmação chega automaticamente. Se o código PIX tiver expirado, você pode fazer um novo pedido em poucos passos.</p>`;
  const text = `Seu pedido ${o.orderNumber} está esperando por você.\nTotal: ${formatBRL(o.totalCents)}\nVoltar ao pagamento: ${resumeUrl}`;
  return { subject, html: layout(subject, "Conclua o pagamento do seu pedido MONTEZ", body, store), text };
}

export function orderStatusEmail(o: EmailOrder, trackUrl: string, store: string) {
  const subject = `Atualização do pedido ${o.orderNumber}`;
  const body = `<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:24px;margin:0 0 8px;">Atualização do seu pedido</h1>
<p style="font-size:15px;line-height:23px;margin:0;">Olá, ${esc(firstName(o.customerName))}! O status do pedido <strong>${esc(o.orderNumber)}</strong> agora é: <strong style="color:${C.olive};">${esc(o.statusLabel)}</strong>.</p>
${o.trackingCode ? `<p style="font-size:14px;margin:14px 0 0;">Código de rastreio: <strong>${esc(o.trackingCode)}</strong></p>` : ""}
${itemsTable(o)}
${button(trackUrl, "Ver meu pedido")}`;
  const text = `Pedido ${o.orderNumber}: ${o.statusLabel}.${o.trackingCode ? ` Rastreio: ${o.trackingCode}.` : ""}\n${trackUrl}`;
  return { subject, html: layout(subject, `Pedido ${o.orderNumber}: ${o.statusLabel}`, body, store), text };
}
