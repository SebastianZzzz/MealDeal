import type { Product, Store } from "@/types";
import seedProducts from "../../../mock/products.json";
import seedStores from "../../../mock/stores.json";
import { sortByDistance, type NearbyStore } from "./stores.ts";

// Catalog data access. Until the Tiger Data pool (src/lib/db.ts) lands, this is the flyer seed
// plus an in-memory list of confirmed reports (lost on server restart; fine for local dev).
// Swap the bodies of these functions for SQL later; callers do not change.

interface MemoryCatalog {
  stores: Map<string, Store>;
  products: Map<string, Product>;
}

// Survive hot reloads in dev by keeping the in-memory catalog on globalThis.
const globalCatalog = globalThis as typeof globalThis & { __mealdealCatalog?: MemoryCatalog };

function memory(): MemoryCatalog {
  if (!globalCatalog.__mealdealCatalog) {
    globalCatalog.__mealdealCatalog = {
      stores: new Map((seedStores as Store[]).map((store) => [store.id, store])),
      products: new Map((seedProducts as Product[]).map((product) => [product.id, product])),
    };
  }
  return globalCatalog.__mealdealCatalog;
}

export async function listKnownStores(): Promise<Store[]> {
  return [...memory().stores.values()];
}

export async function getStore(id: string): Promise<Store | undefined> {
  return memory().stores.get(id);
}

export async function saveStore(store: Store): Promise<Store> {
  const stores = memory().stores;
  if (!stores.has(store.id)) stores.set(store.id, store);
  return stores.get(store.id)!;
}

export async function knownStoresNear(center: { lat: number; lng: number }, km: number): Promise<NearbyStore[]> {
  return sortByDistance(await listKnownStores(), center).filter((store) => store.distanceKm <= km);
}

export interface ProductQuery {
  storeIds?: string[];
  category?: Product["category"];
  includeExpired?: boolean;
  now?: Date;
}

export function isExpired(product: Product, now = new Date()): boolean {
  if (!product.validUntil) return false;
  // Date-only values are valid through the end of that day in Vancouver.
  const end = /^\d{4}-\d{2}-\d{2}$/.test(product.validUntil) ? `${product.validUntil}T23:59:59-08:00` : product.validUntil;
  return new Date(end).getTime() < now.getTime();
}

export async function listProducts(query: ProductQuery = {}): Promise<Product[]> {
  const storeIds = query.storeIds ? new Set(query.storeIds) : undefined;
  return [...memory().products.values()].filter(
    (product) =>
      (!storeIds || storeIds.has(product.storeId)) &&
      (!query.category || product.category === query.category) &&
      (query.includeExpired || !isExpired(product, query.now)),
  );
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return memory().products.get(id);
}

// A confirmed report replaces the current price for the same product at the same store.
export async function saveProduct(product: Product): Promise<Product> {
  memory().products.set(product.id, product);
  return product;
}
