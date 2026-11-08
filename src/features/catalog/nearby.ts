import { knownStoresNear } from "./repo.ts";
import { fetchNearbyStores, type NearbyStore } from "./stores.ts";

// Ponderosa Commons, UBC: used when the browser cannot share a location.
export const DEMO_CENTER = { lat: 49.2644, lng: -123.2537 };

export interface NearbyResult {
  stores: NearbyStore[];
  live: boolean; // false when the OpenStreetMap lookup failed and only known stores are returned
}

// Known stores (seed + reported) merged with a live OpenStreetMap lookup, nearest first.
export async function findNearbyStores(center: { lat: number; lng: number }, km: number): Promise<NearbyResult> {
  const known = await knownStoresNear(center, km);
  try {
    const live = await fetchNearbyStores(center, km);
    const byId = new Map<string, NearbyStore>(live.map((store) => [store.id, store]));
    for (const store of known) byId.set(store.id, store); // keep our stored copy when ids match
    return { stores: [...byId.values()].sort((a, b) => a.distanceKm - b.distanceKm), live: true };
  } catch {
    return { stores: known, live: false };
  }
}
