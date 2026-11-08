import type { Product, Store } from "@/types";
import seedProducts from "../../../mock/products.json";
import seedStores from "../../../mock/stores.json";
import {
  insertStore,
  recordPrice,
  selectProduct,
  selectProducts,
  selectStore,
  selectStores,
  type Queryable,
} from "./catalog-sql.ts";
import { sortByDistance, type NearbyStore } from "./stores.ts";

// Catalog data access. With DATABASE_URL set, everything lives in Tiger Data (A's shared pool).
// Without it (local dev), the flyer seed plus an in-memory list of confirmed reports is used.
// Callers (planning, routes) see the same functions either way.

interface Pool extends Queryable {
  connect(): Promise<Queryable & { release(): void }>;
}

async function database(): Promise<Pool | null> {
  if (!process.env.DATABASE_URL) return null;
  const { db } = await import("@/lib/db");
  return db as unknown as Pool;
}

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
  const db = await database();
  return db ? selectStores(db) : [...memory().stores.values()];
}

export async function getStore(id: string): Promise<Store | undefined> {
  const db = await database();
  return db ? selectStore(db, id) : memory().stores.get(id);
}

export async function saveStore(store: Store): Promise<Store> {
  const db = await database();
  if (db) {
    await insertStore(db, store);
    return (await selectStore(db, store.id)) ?? store;
  }
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
  const db = await database();
  if (db) return selectProducts(db, query);
  const storeIds = query.storeIds ? new Set(query.storeIds) : undefined;
  return [...memory().products.values()].filter(
    (product) =>
      (!storeIds || storeIds.has(product.storeId)) &&
      (!query.category || product.category === query.category) &&
      (query.includeExpired || !isExpired(product, query.now)),
  );
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const db = await database();
  return db ? selectProduct(db, id) : memory().products.get(id);
}

// A confirmed report replaces the current price for the same product at the same store
// and, with a database, also adds a row to the price history.
export async function saveProduct(product: Product): Promise<Product> {
  const db = await database();
  if (!db) {
    memory().products.set(product.id, product);
    return product;
  }
  const client = await db.connect(); // a transaction needs one connection
  try {
    await recordPrice(client, product);
  } finally {
    client.release();
  }
  return (await selectProduct(db, product.id)) ?? product;
}
