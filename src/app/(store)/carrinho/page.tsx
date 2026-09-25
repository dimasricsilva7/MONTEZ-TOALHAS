import type { Metadata } from "next";
import { CartPageClient } from "./CartPageClient";
import { getSettings } from "@/server/content";

export const metadata: Metadata = { title: "Carrinho", robots: { index: false } };

export default async function CartPage() {
  const s = await getSettings();
  const shipping = Number(s.shipping_flat_cents) || 0;
  return <CartPageClient shippingCents={shipping} />;
}
