import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getContent, getSettings } from "@/server/content";
import { CheckoutClient } from "./CheckoutClient";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const [settings, content, bumps] = await Promise.all([
    getSettings(),
    getContent(),
    db.orderBump.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, title: true, description: true, priceCents: true, imageUrl: true } }),
  ]);
  return <CheckoutClient shippingCents={Math.max(0, Number(settings.shipping_flat_cents) || 0)} bumps={bumps} note={content.checkout_note} />;
}
