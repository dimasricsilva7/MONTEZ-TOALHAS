export type PublicOrder = {
  orderNumber: string;
  status: "PENDING_PAYMENT" | "PAID" | "EXPIRED" | "CANCELLED" | "REFUNDED" | "CHARGEBACK" | "FAILED";
  fulfillmentStatus: string;
  trackingCode: string | null;
  totalCents: number;
  subtotalCents: number;
  shippingCents: number;
  pixCopyPaste: string | null;
  pixExpiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  metaEventId: string | null;
  customerFirstName: string;
  paymentError: boolean;
  items: { name: string; sku: string; colorName: string | null; colorHex: string | null; quantity: number; unitPriceCents: number; totalPriceCents: number; kind: string }[];
};
