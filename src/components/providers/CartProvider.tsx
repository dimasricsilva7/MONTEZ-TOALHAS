"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, CatalogColor, CatalogProduct } from "@/types/catalog";
import { gaEvent, metaEvent, track } from "@/lib/client/tracking";

type CartItemView = CartLine & { product: CatalogProduct; color: CatalogColor; lineTotalCents: number };

type CartCtx = {
  catalog: CatalogProduct[];
  colors: CatalogColor[];
  lines: CartLine[];
  items: CartItemView[];
  count: number;
  subtotalCents: number;
  ready: boolean;
  add: (productId: string, colorId: string, quantity?: number, opts?: { openDrawer?: boolean }) => void;
  setQuantity: (productId: string, colorId: string, quantity: number) => void;
  remove: (productId: string, colorId: string) => void;
  clear: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  selectedColorId: string | null;
  selectColor: (colorId: string, source?: string) => void;
};

const Ctx = createContext<CartCtx | null>(null);
const CART_KEY = "mz_cart_v1";
const COLOR_KEY = "mz_color";

export function CartProvider({ catalog, colors, children }: { catalog: CatalogProduct[]; colors: CatalogColor[]; children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setLines((JSON.parse(raw) as CartLine[]).filter((l) => l && l.productId && l.colorId && l.quantity > 0));
      const c = localStorage.getItem(COLOR_KEY);
      if (c) setSelectedColorId(c);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines, ready]);

  const items = useMemo<CartItemView[]>(() => {
    return lines.flatMap((l) => {
      const product = catalog.find((p) => p.id === l.productId);
      const color = colors.find((c) => c.id === l.colorId);
      if (!product || !color || !product.variants.some((v) => v.colorId === color.id)) return [];
      return [{ ...l, product, color, lineTotalCents: product.priceCents * l.quantity }];
    });
  }, [lines, catalog, colors]);

  const add = useCallback<CartCtx["add"]>(
    (productId, colorId, quantity = 1, opts = {}) => {
      const product = catalog.find((p) => p.id === productId);
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.productId === productId && l.colorId === colorId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: Math.min(10, next[idx].quantity + quantity) };
          return next;
        }
        return [...prev, { productId, colorId, quantity: Math.min(10, quantity) }];
      });
      if (product) {
        const value = (product.priceCents * quantity) / 100;
        metaEvent(
          "AddToCart",
          { currency: "BRL", value, content_type: "product", content_ids: [product.sku], contents: [{ id: product.sku, quantity }], content_name: product.commercialName },
          { mirror: true, internal: { name: "add_to_cart", productId: product.id, valueCents: product.priceCents * quantity, props: { colorId } } }
        );
        gaEvent("add_to_cart", { currency: "BRL", value, items: [{ item_id: product.sku, item_name: product.commercialName, quantity }] });
      }
      if (opts.openDrawer !== false) setDrawerOpen(true);
    },
    [catalog]
  );

  const setQuantity = useCallback((productId: string, colorId: string, quantity: number) => {
    setLines((prev) =>
      prev.map((l) => (l.productId === productId && l.colorId === colorId ? { ...l, quantity: Math.max(1, Math.min(10, quantity)) } : l))
    );
  }, []);

  const remove = useCallback(
    (productId: string, colorId: string) => {
      setLines((prev) => prev.filter((l) => !(l.productId === productId && l.colorId === colorId)));
      const product = catalog.find((p) => p.id === productId);
      track("remove_from_cart", { productId, props: { colorId, sku: product?.sku ?? null } });
    },
    [catalog]
  );

  const clear = useCallback(() => setLines([]), []);

  const selectColor = useCallback((colorId: string, source = "unknown") => {
    setSelectedColorId(colorId);
    try {
      localStorage.setItem(COLOR_KEY, colorId);
    } catch {
      /* ignore */
    }
    track("select_color", { props: { colorId, source } });
  }, []);

  const value: CartCtx = {
    catalog,
    colors,
    lines,
    items,
    count: items.reduce((s, i) => s + i.quantity, 0),
    subtotalCents: items.reduce((s, i) => s + i.lineTotalCents, 0),
    ready,
    add,
    setQuantity,
    remove,
    clear,
    drawerOpen,
    setDrawerOpen,
    selectedColorId: selectedColorId && colors.some((c) => c.id === selectedColorId) ? selectedColorId : null,
    selectColor,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart fora do CartProvider");
  return ctx;
}
