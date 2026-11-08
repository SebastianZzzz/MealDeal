// Public surface of the catalog feature (B). Other features import from "@/features/catalog" only.
export { listProducts, getProduct, listKnownStores, getStore, isExpired } from "./repo.ts";
export { normalizePrice, parsePrice, parseSize } from "./pricing.ts";
export { distanceKm, type NearbyStore } from "./stores.ts";
