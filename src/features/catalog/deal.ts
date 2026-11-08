import type { DealCheck, DealVerdict, PriceObservation } from "@/types";

// "Is this sale actually cheap?" Current price per 100 g vs the median of this product's
// earlier prices at the same store over the last 28 days. Pure code, never Gemini.

export const DEAL_WINDOW_DAYS = 28;
export const MIN_OBSERVATIONS = 3;
const THRESHOLD_PCT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export type HistoryPoint = Pick<PriceObservation, "pricePer100" | "observedAt" | "source">;

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function verdictFor(diffPct: number): Exclude<DealVerdict, "not_enough_data"> {
  if (diffPct <= -THRESHOLD_PCT) return "real_deal";
  if (diffPct >= THRESHOLD_PCT) return "pricier";
  return "normal";
}

// `history` may include the current observation itself; anything at or after `currentAt` is ignored,
// so the current price is never compared with itself.
export function evaluateDeal(
  current: { productId: string; storeId: string; pricePer100: number; observedAt: string },
  history: HistoryPoint[],
): DealCheck {
  const currentTime = new Date(current.observedAt).getTime();
  const windowStart = currentTime - DEAL_WINDOW_DAYS * DAY_MS;
  const earlier = history.filter((point) => {
    const t = new Date(point.observedAt).getTime();
    return t < currentTime && t >= windowStart;
  });

  const base = {
    productId: current.productId,
    storeId: current.storeId,
    currentPer100: current.pricePer100,
    observations: earlier.length,
    hasSampleData: earlier.some((point) => point.source === "sample"),
  };
  if (earlier.length < MIN_OBSERVATIONS) return { ...base, verdict: "not_enough_data" };

  const medianPer100 = median(earlier.map((point) => point.pricePer100));
  const diffPct = medianPer100 > 0 ? ((current.pricePer100 - medianPer100) / medianPer100) * 100 : 0;
  return {
    ...base,
    medianPer100: Number(medianPer100.toFixed(4)),
    diffPct: Number(diffPct.toFixed(1)),
    verdict: verdictFor(diffPct),
  };
}
