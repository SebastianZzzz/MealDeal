import type { SurplusListing } from "@/types";
import { distanceKm } from "./inventory";

export const money = (amount: number) => new Intl.NumberFormat("en-CA", {
  style: "currency", currency: "CAD",
}).format(amount);

export const pickup = (value: string) => new Intl.DateTimeFormat("en-CA", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  timeZone: "America/Vancouver", timeZoneName: "short",
}).format(new Date(value));

export function availability(item: SurplusListing, now: number) {
  if (Date.parse(item.pickupEnd) <= now) {
    return "Pickup ended";
  }
  if (item.qtyLeft === 0) {
    return "Sold out";
  }
  return `${item.qtyLeft} left`;
}

export function available(item: SurplusListing, now: number) {
  return item.qtyLeft > 0 && Date.parse(item.pickupEnd) > now;
}

export function sortedListings(items: SurplusListing[], now: number, onlyAvailable: boolean,
  origin: { lat: number; lng: number } | null) {
  const filtered = items.filter((item) => !onlyAvailable || available(item, now));
  return filtered.sort((a, b) => {
    // Available meals lead even when the user includes ended or sold-out offers.
    const stockOrder = Number(available(b, now)) - Number(available(a, now));
    if (stockOrder !== 0) {
      return stockOrder;
    }
    const order = origin ? distanceKm(origin, a) - distanceKm(origin, b) : a.price - b.price;
    return order || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
}
