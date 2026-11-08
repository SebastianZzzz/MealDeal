import type { DealCheck, Product } from "@/types";
import { parseProductDeal } from "./deals";

async function fetchProductDeal(product: Product, origin: string): Promise<DealCheck | null> {
  try {
    const response = await fetch(new URL(`/api/products/${encodeURIComponent(product.id)}/deal`, origin), {
      cache: "no-store", signal: AbortSignal.timeout(1500),
    });
    return response.ok ? parseProductDeal(await response.json(), product) : null;
  } catch {
    return null;
  }
}

export async function loadProductDeals(products: Product[]): Promise<Record<string, DealCheck>> {
  // Only trusted app configuration supplies the server-side destination.
  const origin = process.env.APP_BASE_URL;
  if (!origin || !/^https?:\/\//.test(origin)) {
    return {};
  }
  const entries = await Promise.all(products.map(async (product) => {
    const deal = await fetchProductDeal(product, origin);
    return [product.id, deal] as const;
  }));
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, DealCheck] => entry[1] !== null));
}
