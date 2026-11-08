import { z } from "zod";
import type { DealCheck, Product } from "@/types";

const dealSchema = z.object({
  productId: z.string().min(1), storeId: z.string().min(1),
  currentPer100: z.number().finite().nonnegative(),
  medianPer100: z.number().finite().nonnegative().optional(),
  diffPct: z.number().finite().optional(),
  observations: z.number().int().nonnegative(), hasSampleData: z.boolean(),
  verdict: z.enum(["real_deal", "normal", "pricier", "not_enough_data"]),
});

export function parseProductDeal(raw: unknown, product: Pick<Product, "id" | "storeId">): DealCheck | null {
  const parsed = dealSchema.safeParse(raw);
  if (!parsed.success || parsed.data.productId !== product.id || parsed.data.storeId !== product.storeId) {
    return null;
  }
  return parsed.data;
}

export function preferRealDeals(products: Product[], deals: Record<string, DealCheck>): Product[] {
  return [...products].sort((a, b) => Number(deals[b.id]?.verdict === "real_deal") - Number(deals[a.id]?.verdict === "real_deal"));
}

export function dealLabel(deal: DealCheck): string {
  const labels: Record<DealCheck["verdict"], string> = {
    real_deal: "Real deal", normal: "Typical price", pricier: "Above usual price",
    not_enough_data: "Not enough price history",
  };
  return `${labels[deal.verdict]}${deal.hasSampleData ? " · sample price history" : ""}`;
}
