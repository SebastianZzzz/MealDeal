// Links every product in mock/products.json to a nutrition-database food in mock/foods.json.
// Code rules first; Gemini picks from our list (or "none") for the rest. Gemini never sees prices or produces nutrients.
// Usage: npm run seed:foods (reads GEMINI_API_KEY from the environment or .env.local)
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Food, Product } from "../src/types.ts";
import { assignFoods } from "../src/features/catalog/nutrition.ts";

const mock = path.join(process.cwd(), "mock");

export async function readFoods(): Promise<Food[]> {
  return JSON.parse(await readFile(path.join(mock, "foods.json"), "utf8"));
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/").replace(/^(?=[A-Za-z]:)/, "/")}`) {
  const products: Product[] = JSON.parse(await readFile(path.join(mock, "products.json"), "utf8"));
  const assigned = await assignFoods(products, await readFoods(), { useGemini: true });
  for (const product of assigned) console.log(`${(product.foodId ?? "(none)").padEnd(24)} ${product.name}`);
  await writeFile(path.join(mock, "products.json"), `${JSON.stringify(assigned, null, 2)}\n`);
  console.log(`linked ${assigned.filter((product) => product.foodId).length} of ${assigned.length} products to a food`);
}
