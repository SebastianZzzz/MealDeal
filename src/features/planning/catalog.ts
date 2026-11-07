import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Food, Product, Store } from "@/types";

const productSchema = z.object({
  id: z.string().min(1), storeId: z.string().min(1), foodId: z.string().optional(),
  name: z.string().min(1), brand: z.string().optional(),
  packageSizeG: z.number().finite().positive(), packageUnit: z.enum(["g", "ml", "piece"]),
  packagePrice: z.number().finite().nonnegative(), pricePer100: z.number().finite().nonnegative(),
  isSale: z.boolean(), validUntil: z.string().optional(), source: z.enum(["flyer", "report"]),
  confidence: z.number().min(0).max(1), reportedAt: z.string(), reportedBy: z.string().optional(),
  imageUrl: z.string().optional(),
  category: z.enum(["grain", "protein", "vegetable", "fruit", "dairy", "sauce", "ready_meal", "other"]).optional(),
});
const storeSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), chain: z.string(), address: z.string(),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
});
const foodSchema = z.object({
  id: z.string().min(1), name: z.string(), kcal: z.number().finite().nonnegative(),
  proteinG: z.number().finite().nonnegative(), fatG: z.number().finite().nonnegative(),
  carbG: z.number().finite().nonnegative(), dbRef: z.string().optional(),
});

async function readJson(name: string): Promise<unknown> {
  const filename = path.join(process.cwd(), "mock", name);
  return JSON.parse(await readFile(filename, "utf8"));
}

function assertUnique(items: { id: string }[], label: string): void {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error(`Duplicate IDs in ${label}.`);
  }
}

export interface Catalog { products: Product[]; stores: Store[]; foods: Food[]; isSample: boolean }

export async function loadCatalog(): Promise<Catalog> {
  // B can replace these three JSON arrays without changing planning logic.
  const [rawProducts, rawStores, rawFoods, metadata] = await Promise.all([
    readJson("products.json"), readJson("stores.json"), readJson("foods.json"), readJson("catalog-meta.json"),
  ]);
  const products = z.array(productSchema).parse(rawProducts);
  const stores = z.array(storeSchema).parse(rawStores);
  const foods = z.array(foodSchema).parse(rawFoods);
  assertUnique(products, "products");
  assertUnique(stores, "stores");
  assertUnique(foods, "foods");
  const { isSample } = z.object({ isSample: z.boolean() }).parse(metadata);
  return { products, stores, foods, isSample };
}
