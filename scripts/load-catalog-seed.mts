// Loads mock/stores.json and mock/products.json into Tiger Data, with one flyer history row per product.
// Safe to re-run: stores are inserted once, products keep the newest price, history rows are de-duplicated.
// Usage: npm run db:migrate && npm run db:seed:catalog
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import type { Product, Store } from "../src/types.ts";
import { insertStore, recordPrice } from "../src/features/catalog/catalog-sql.ts";

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
  for (const store of stores) await insertStore(client, store);
  for (const product of products) await recordPrice(client, product);
  const { rows } = await client.query(
    "select (select count(*) from stores) as stores, (select count(*) from products) as products, (select count(*) from price_observations) as observations",
  );
  console.log(`loaded ${stores.length} stores, ${products.length} products; database now has`, rows[0]);
} finally {
  await client.end();
}
