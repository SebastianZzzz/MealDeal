import type { Product, Store } from "@/types";

// SQL for the catalog tables (db/migrations/20261107220000_catalog.sql).
// Takes any pg-style client, so both the app (A's shared pool) and Node scripts (a plain pg Client) use it.

export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const num = (value: unknown) => Number(value);
const iso = (value: unknown) => (value instanceof Date ? value : new Date(String(value))).toISOString();
const opt = <T>(value: T | null | undefined) => (value === null || value === undefined ? undefined : value);

export function rowToStore(row: Record<string, unknown>): Store {
  return {
    id: String(row.id),
    name: String(row.name),
    chain: String(row.chain),
    address: String(row.address ?? ""),
    lat: num(row.lat),
    lng: num(row.lng),
  };
}

// pg returns numeric columns as strings; convert back to the Product contract.
export function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    storeId: String(row.store_id),
    foodId: opt(row.food_id as string | null),
    name: String(row.name),
    brand: opt(row.brand as string | null),
    packageSizeG: num(row.package_size_g),
    packageUnit: row.package_unit as Product["packageUnit"],
    packagePrice: num(row.package_price),
    pricePer100: num(row.price_per_100),
    isSale: Boolean(row.is_sale),
    validUntil: row.valid_until ? iso(row.valid_until) : undefined,
    source: row.source as Product["source"],
    confidence: num(row.confidence),
    reportedBy: opt(row.reported_by as string | null),
    reportedAt: iso(row.reported_at),
    category: opt(row.category as Product["category"] | null),
  };
}

export async function selectStores(db: Queryable): Promise<Store[]> {
  const { rows } = await db.query("select id, name, chain, address, lat, lng from stores order by id");
  return rows.map(rowToStore);
}

export async function selectStore(db: Queryable, id: string): Promise<Store | undefined> {
  const { rows } = await db.query("select id, name, chain, address, lat, lng from stores where id = $1", [id]);
  return rows[0] ? rowToStore(rows[0]) : undefined;
}

// First writer wins: a store's identity does not change once known.
export async function insertStore(db: Queryable, store: Store): Promise<void> {
  await db.query(
    `insert into stores (id, name, chain, address, lat, lng) values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do nothing`,
    [store.id, store.name, store.chain, store.address, store.lat, store.lng],
  );
}

export interface ProductFilter {
  storeIds?: string[];
  category?: Product["category"];
  includeExpired?: boolean;
  now?: Date;
}

export async function selectProducts(db: Queryable, filter: ProductFilter = {}): Promise<Product[]> {
  const { rows } = await db.query(
    `select * from products
     where ($1::text[] is null or store_id = any($1))
       and ($2::text is null or category = $2)
       and ($3::boolean or valid_until is null or valid_until >= $4)
     order by id`,
    [filter.storeIds ?? null, filter.category ?? null, Boolean(filter.includeExpired), filter.now ?? new Date()],
  );
  return rows.map(rowToProduct);
}

export async function selectProduct(db: Queryable, id: string): Promise<Product | undefined> {
  const { rows } = await db.query("select * from products where id = $1", [id]);
  return rows[0] ? rowToProduct(rows[0]) : undefined;
}

// Upsert the current price. An older report (e.g. a back-dated tag) never overwrites a newer price.
export async function upsertProduct(db: Queryable, p: Product): Promise<void> {
  await db.query(
    `insert into products (id, store_id, food_id, name, brand, package_size_g, package_unit, package_price,
       price_per_100, is_sale, valid_until, source, confidence, reported_by, reported_at, category)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     on conflict (id) do update set
       food_id = coalesce(excluded.food_id, products.food_id), name = excluded.name, brand = excluded.brand,
       package_size_g = excluded.package_size_g, package_unit = excluded.package_unit,
       package_price = excluded.package_price, price_per_100 = excluded.price_per_100, is_sale = excluded.is_sale,
       valid_until = excluded.valid_until, source = excluded.source, confidence = excluded.confidence,
       reported_by = excluded.reported_by, reported_at = excluded.reported_at,
       category = coalesce(excluded.category, products.category), updated_at = now()
     where products.reported_at <= excluded.reported_at`,
    [
      p.id, p.storeId, p.foodId ?? null, p.name, p.brand ?? null, p.packageSizeG, p.packageUnit, p.packagePrice,
      p.pricePer100, p.isSale, p.validUntil ?? null, p.source, p.confidence, p.reportedBy ?? null, p.reportedAt,
      p.category ?? null,
    ],
  );
}

// One history row per (product, source, time). Re-imports of the same flyer are ignored.
export async function insertObservation(
  db: Queryable,
  p: Pick<Product, "id" | "storeId" | "packagePrice" | "pricePer100" | "isSale">,
  source: "flyer" | "report" | "sample",
  time: string,
): Promise<void> {
  await db.query(
    `insert into price_observations (time, product_id, store_id, package_price, price_per_100, is_sale, source)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (product_id, source, time) do nothing`,
    [time, p.id, p.storeId, p.packagePrice, p.pricePer100, p.isSale, source],
  );
}

// Price history for one product in [since, until), oldest first.
export async function selectHistory(
  db: Queryable,
  productId: string,
  since: string,
  until: string,
): Promise<{ pricePer100: number; observedAt: string; source: "flyer" | "report" | "sample" }[]> {
  const { rows } = await db.query(
    `select time, price_per_100, source from price_observations
     where product_id = $1 and time >= $2 and time < $3
     order by time`,
    [productId, since, until],
  );
  return rows.map((row) => ({
    pricePer100: num(row.price_per_100),
    observedAt: iso(row.time),
    source: row.source as "flyer" | "report" | "sample",
  }));
}

// Current price plus its history row, atomically.
export async function recordPrice(db: Queryable, product: Product): Promise<void> {
  await db.query("begin");
  try {
    await upsertProduct(db, product);
    await insertObservation(db, product, product.source, product.reportedAt);
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}
