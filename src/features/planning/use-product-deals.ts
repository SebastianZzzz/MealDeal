"use client";

import { useEffect, useState } from "react";
import type { DealCheck, ShoppingItem } from "@/types";
import { parseProductDeal } from "./deals";

export function useProductDeals(items: ShoppingItem[]): Record<string, DealCheck> {
  const [deals, setDeals] = useState<Record<string, DealCheck>>({});
  const productsKey = JSON.stringify(items.map((item) => ({ id: item.productId, storeId: item.storeId })));
  useEffect(() => {
    const controller = new AbortController();
    const products = JSON.parse(productsKey) as { id: string; storeId: string }[];
    async function load() {
      const entries = await Promise.all(products.map(async (product) => {
        try {
          const response = await fetch(`/api/products/${encodeURIComponent(product.id)}/deal`, {
            cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3000)]),
          });
          const deal = response.ok ? parseProductDeal(await response.json(), product) : null;
          return [product.id, deal] as const;
        } catch {
          return [product.id, null] as const;
        }
      }));
      if (!controller.signal.aborted) {
        setDeals(Object.fromEntries(entries.filter((entry): entry is readonly [string, DealCheck] => entry[1] !== null)));
      }
    }
    void load();
    return () => { controller.abort(); };
  }, [productsKey]);
  return deals;
}
