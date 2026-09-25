import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { findOrderByAccess, toPublicOrder } from "@/server/orders";
import { getContent } from "@/server/content";
import { SuccessClient } from "./SuccessClient";

export const metadata: Metadata = { title: "Pedido confirmado" };
export const dynamic = "force-dynamic";

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ pedido?: string; t?: string }> }) {
  const { pedido, t } = await searchParams;
  const order = await findOrderByAccess(pedido, t);
  if (!order) notFound();
  const q = `pedido=${encodeURIComponent(order.orderNumber!)}&t=${encodeURIComponent(order.accessToken)}`;
  if (order.status !== "PAID") redirect(`/checkout/pendente?${q}`);

  const [c, upsell, address] = await Promise.all([
    getContent(),
    order.source === "STOREFRONT"
      ? db.upsell.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, headline: true, title: true, description: true, priceCents: true, imageUrl: true } })
      : null,
    Promise.resolve(order.shippingAddress as { city?: string; state?: string }),
  ]);
  const alreadyTaken = upsell ? await db.order.count({ where: { parentOrderId: order.id } }) : 0;

  return (
    <SuccessClient
      order={toPublicOrder(order)}
      query={q}
      title={c.success_title}
      text={c.success_text}
      upsell={alreadyTaken ? null : upsell}
      destination={address.city ? `${address.city}/${address.state}` : null}
    />
  );
}
