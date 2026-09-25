import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { findOrderByAccess, toPublicOrder } from "@/server/orders";
import { getContent } from "@/server/content";
import { PixClient } from "./PixClient";

export const metadata: Metadata = { title: "Pagamento via PIX" };
export const dynamic = "force-dynamic";

export default async function PixPendingPage({ searchParams }: { searchParams: Promise<{ pedido?: string; t?: string }> }) {
  const { pedido, t } = await searchParams;
  const order = await findOrderByAccess(pedido, t);
  if (!order) notFound();
  const q = `pedido=${encodeURIComponent(order.orderNumber!)}&t=${encodeURIComponent(order.accessToken)}`;
  if (order.status === "PAID") redirect(`/checkout/sucesso?${q}`);

  const c = await getContent();
  const qrSvg = order.pixCopyPaste
    ? await QRCode.toString(order.pixCopyPaste, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1B1A18", light: "#FFFFFF" } })
    : null;

  return (
    <PixClient
      initial={toPublicOrder(order)}
      qrSvg={qrSvg}
      query={q}
      title={c.pix_title}
      note={c.pix_note}
      mock={order.bravopayTransactionId?.startsWith("mock_tx_") ?? false}
    />
  );
}
