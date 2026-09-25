export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  EXPIRED: "PIX expirado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  CHARGEBACK: "Chargeback",
  FAILED: "Falhou",
};

export const FULFILLMENT_LABEL: Record<string, string> = {
  UNFULFILLED: "Aguardando preparação",
  PREPARING: "Em preparação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
};

export const EMAIL_TYPE_LABEL: Record<string, string> = {
  PURCHASE_CONFIRMATION: "Confirmação de compra",
  PIX_RECOVERY: "Recuperação de PIX",
  ORDER_STATUS: "Atualização do pedido",
  MANUAL: "Manual",
};

export const EMAIL_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Agendado",
  SENDING: "Enviando",
  SENT: "Enviado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  SKIPPED: "Não enviado",
};

/** Rótulo combinado para o cliente: pagamento + etapa de envio. */
export function customerStatusLabel(status: string, fulfillment: string) {
  if (status === "PAID") return fulfillment === "UNFULFILLED" ? "Pagamento confirmado" : FULFILLMENT_LABEL[fulfillment] ?? "Pago";
  return ORDER_STATUS_LABEL[status] ?? status;
}
