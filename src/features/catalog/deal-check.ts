import type { DealCheck } from "@/types";
import { DEAL_WINDOW_DAYS, evaluateDeal } from "./deal.ts";
import { getProduct, listHistory } from "./repo.ts";

// Server-side deal check for one product. Returns null when the product is unknown.
export async function getDealCheck(productId: string): Promise<DealCheck | null> {
  const product = await getProduct(productId);
  if (!product) return null;
  const currentAt = new Date(product.reportedAt);
  const since = new Date(currentAt.getTime() - DEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const history = await listHistory(product.id, since, currentAt);
  return evaluateDeal(
    { productId: product.id, storeId: product.storeId, pricePer100: product.pricePer100, observedAt: product.reportedAt },
    history,
  );
}
