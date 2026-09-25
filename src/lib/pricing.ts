/** Cálculo de totais — puro, usado no servidor (fonte da verdade) e nos testes. */
export type PricedLine = { unitPriceCents: number; quantity: number };

export function computeTotals(lines: PricedLine[], shippingCents: number, discountCents = 0) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);
  return { subtotalCents, discountCents, shippingCents, totalCents };
}

export function formatOrderNumber(year: number, seq: number) {
  return `MONTEZ-${year}-${String(seq).padStart(6, "0")}`;
}
