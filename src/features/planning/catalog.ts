import { z } from "zod";
import type { Food, Product, Store } from "@/types";
import { listProducts, listKnownStores } from "@/features/catalog";
import nutritionData from "../../../mock/foods.json";
import catalogMetadata from "../../../mock/catalog-meta.json";

const productSchema = z.object({
  id: z.string().min(1), storeId: z.string().min(1), foodId: z.string().optional(),
  name: z.string().min(1), brand: z.string().optional(),
  packageSizeG: z.number().finite().positive(), packageUnit: z.enum(["g", "ml", "piece"]),
  packagePrice: z.number().finite().nonnegative(), pricePer100: z.number().finite().nonnegative(),
  isSale: z.boolean(), validUntil: z.string().optional(), source: z.enum(["flyer", "report"]),
  confidence: z.number().min(0).max(1), reportedAt: z.string(), reportedBy: z.string().optional(),
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

function assertUnique(items: { id: string }[], label: string): void {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error(`Duplicate IDs in ${label}.`);
  }
}

export interface Catalog { products: Product[]; stores: Store[]; foods: Food[]; isSample: boolean }

export async function loadCatalog(): Promise<Catalog> {
  // B owns expiry filtering and combines flyer seeds with confirmed price-tag reports.
  const [rawProducts, rawStores] = await Promise.all([listProducts(), listKnownStores()]);
  const products = z.array(productSchema).parse(rawProducts);
  const stores = z.array(storeSchema).parse(rawStores);
  const foods = z.array(foodSchema).parse(nutritionData);
  assertUnique(products, "products");
  assertUnique(stores, "stores");
  assertUnique(foods, "foods");
  const { isSample } = z.object({ isSample: z.boolean() }).parse(catalogMetadata);
  return { products, stores, foods, isSample };
}
