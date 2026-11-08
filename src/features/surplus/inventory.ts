import type { SurplusListing } from "../../types";

// v2: new sample dishes; bumping the key reloads them in browsers that already stored v1.
export const SURPLUS_KEY = "mealdeal.surplus.v2";
type LocalStorage = Pick<Storage, "getItem" | "setItem">;
export type ExclusiveLock = <T>(work: () => T) => Promise<T>;
export type ListingDraft = Omit<SurplusListing, "id" | "isSample" | "createdAt">;
export type ReserveResult = { ok: true; listing: SurplusListing } | { ok: false; reason: "missing" | "sold_out" | "expired" };

function isText(value: unknown, max = 200): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function isMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100000
    && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}

export function validDraft(value: unknown): value is ListingDraft {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return isText(item.merchantName, 100) && isText(item.address, 300) && isText(item.title, 150)
    && typeof item.lat === "number" && Number.isFinite(item.lat) && Math.abs(item.lat) <= 90
    && typeof item.lng === "number" && Number.isFinite(item.lng) && Math.abs(item.lng) <= 180
    && isMoney(item.origPrice) && isMoney(item.price) && item.price <= item.origPrice
    && typeof item.qtyLeft === "number" && Number.isInteger(item.qtyLeft) && item.qtyLeft >= 0 && item.qtyLeft <= 10000
    && typeof item.pickupStart === "string" && Number.isFinite(Date.parse(item.pickupStart))
    && typeof item.pickupEnd === "string" && Date.parse(item.pickupEnd) > Date.parse(item.pickupStart)
    && Array.isArray(item.allergens) && item.allergens.length <= 30 && item.allergens.every((allergen) => isText(allergen, 80))
    && (item.description === undefined || (typeof item.description === "string" && item.description.length <= 1000));
}

/** All writers share a lock. Read/check/decrement/write happens inside one lock. */
export function createInventory(storage: LocalStorage, exclusive: ExclusiveLock, seeds: SurplusListing[]) {
  function read(): SurplusListing[] {
    const raw = storage.getItem(SURPLUS_KEY);
    if (raw === null) return structuredClone(seeds);
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.every((item) => item && isText(item.id) && typeof item.isSample === "boolean" && typeof item.createdAt === "string" && validDraft(item))
      || new Set(value.map((item) => item.id)).size !== value.length) throw new Error("Saved listings could not be read. No inventory was changed.");
    return value as SurplusListing[];
  }

  function write(items: SurplusListing[]) { storage.setItem(SURPLUS_KEY, JSON.stringify(items)); }

  return {
    read,
    initialize: () => exclusive(() => {
      const items = read();
      if (storage.getItem(SURPLUS_KEY) === null) write(items);
      return items;
    }),
    post: (draft: ListingDraft, id: string, now: number) => exclusive(() => {
      if (!validDraft(draft) || draft.qtyLeft < 1 || Date.parse(draft.pickupEnd) <= now || !isText(id)) throw new Error("Check prices, quantity, location, and the future pickup window.");
      const items = read();
      if (items.some((item) => item.id === id)) throw new Error("This listing already exists.");
      const listing: SurplusListing = { ...draft, id, isSample: true, createdAt: new Date(now).toISOString() };
      write([listing, ...items]);
      return listing;
    }),
    reserve: (id: string, clock: number | (() => number)): Promise<ReserveResult> => exclusive(() => {
      const now = typeof clock === "function" ? clock() : clock;
      const items = read();
      const listing = items.find((item) => item.id === id);
      if (!listing) return { ok: false, reason: "missing" };
      if (Date.parse(listing.pickupEnd) <= now) return { ok: false, reason: "expired" };
      // Equivalent to the future database condition: WHERE qty_left > 0.
      if (listing.qtyLeft <= 0) return { ok: false, reason: "sold_out" };
      listing.qtyLeft -= 1;
      write(items);
      return { ok: true, listing };
    }),
  };
}

export function distanceKm(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(destination.lat - origin.lat);
  const dLng = radians(destination.lng - origin.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(origin.lat)) * Math.cos(radians(destination.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
