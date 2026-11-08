import type { ListingDraft } from "./inventory";
import { listingDraftSchema } from "./draft-schema";

export const PICKUP_DELAYS = [0, 30, 60, 120] as const;
export const PICKUP_DURATIONS = [30, 60, 120] as const;

export type SampleMeal = Omit<ListingDraft, "pickupStart" | "pickupEnd"> & { id: string };
export type SampleChoices = {
  price: number; origPrice: number; qtyLeft: number; delay: number; duration: number;
};

export function buildSampleDraft(meal: SampleMeal, choices: SampleChoices, now: number): ListingDraft {
  if (!PICKUP_DELAYS.some((value) => value === choices.delay)
    || !PICKUP_DURATIONS.some((value) => value === choices.duration)) {
    throw new Error("Choose one of the pickup windows.");
  }
  // Resolve times on publish, so a long-open form never submits a stale window.
  const start = now + choices.delay * 60000;
  return listingDraftSchema(now).parse({
    merchantName: meal.merchantName, title: meal.title, address: meal.address,
    lat: meal.lat, lng: meal.lng, allergens: [...meal.allergens], description: meal.description,
    origPrice: choices.origPrice, price: choices.price, qtyLeft: choices.qtyLeft,
    pickupStart: new Date(start).toISOString(),
    pickupEnd: new Date(start + choices.duration * 60000).toISOString(),
  });
}
