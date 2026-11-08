// Loads mock/stores.json and mock/products.json into Tiger Data, with one flyer history row per product
// plus labeled sample history for a few products (see sample-history.ts).
// Safe to re-run: stores are inserted once, products keep the newest price, history rows are de-duplicated.
// Usage: npm run db:migrate && npm run db:seed:catalog
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import type { Food, Product, Store } from "../src/types.ts";
import { insertObservation, insertStore, recordPrice, upsertFood } from "../src/features/catalog/catalog-sql.ts";
import { sampleHistory } from "../src/features/catalog/sample-history.ts";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error("DATABASE_URL is required");

// Same connection settings as scripts/migrate.mjs and src/lib/db.ts.
const url = new URL(rawUrl);
url.searchParams.delete("sslmode");
const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });

const readJson = async <T>(name: string) =>
  JSON.parse(await readFile(path.join(process.cwd(), "mock", name), "utf8")) as T;

try {
  await client.connect();
  const stores = await readJson<Store[]>("stores.json");
  const products = await readJson<Product[]>("products.json");
  const foods = await readJson<Food[]>("foods.json");
  for (const food of foods) await upsertFood(client, food);
  for (const store of stores) await insertStore(client, store);
  for (const product of products) await recordPrice(client, product);
  // Labeled demo history (source "sample") so the deal check has data on day one.
  for (const row of sampleHistory(products)) {
    await insertObservation(client, { id: row.productId, storeId: row.storeId, packagePrice: row.packagePrice, pricePer100: row.pricePer100, isSale: row.isSale }, "sample", row.observedAt);
  }
  const { rows } = await client.query(
    "select (select count(*) from foods) as foods, (select count(*) from products where food_id is not null) as products_with_food, (select count(*) from stores) as stores, (select count(*) from products) as products, (select count(*) from price_observations) as observations",
  );
  console.log(`loaded ${foods.length} foods, ${stores.length} stores, ${products.length} products; database now has`, rows[0]);
} finally {
  await client.end();
}
