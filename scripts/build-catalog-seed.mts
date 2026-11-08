// Builds mock/stores.json and mock/products.json from real data:
// stores from OpenStreetMap around Ponderosa (UBC), prices from this week's flyers on Flipp.
// Gemini labels each product with a preset category (it never sees prices for this),
// and links it to a nutrition-database food when the code rules can't.
// Usage: npm run seed:catalog (reads GEMINI_API_KEY from the environment or .env.local)
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Product, Store } from "../src/types.ts";
import { fetchFlippDetail, flippToProduct, searchFlipp } from "../src/features/catalog/flipp.ts";
import { fetchNearbyStores } from "../src/features/catalog/stores.ts";
import { applyClassification, classifyProducts, type Classification } from "../src/features/catalog/classify.ts";
import { assignFoods } from "../src/features/catalog/nutrition.ts";
import { readFoods } from "./match-foods.mts";

const CENTER = { lat: 49.2644, lng: -123.2537 }; // Ponderosa Commons, UBC
const RADIUS_KM = 5;
const POSTAL_CODE = "V6T1Z4";
const CHAINS = ["Save-On-Foods", "No Frills", "Urban Fare"];
const PER_QUERY_PER_STORE = 2;

// Staples a tight budget is built from. `match` must appear in the flyer item name; `exclude` filters look-alikes.
const QUERIES: { q: string; match: RegExp; exclude?: RegExp; category: Product["category"] }[] = [
  { q: "rice", match: /\brice\b/i, exclude: /krispies|cake|cracker|express|noodle|vinegar|pudding/i, category: "grain" },
  { q: "pasta", match: /pasta|spaghetti|penne|macaroni|fusilli/i, exclude: /sauce/i, category: "grain" },
  { q: "noodles", match: /noodle/i, exclude: /cup|soup/i, category: "grain" },
  { q: "oats", match: /\boats?\b|oatmeal/i, exclude: /bar|cookie|milk|cereal|crisp/i, category: "grain" },
  { q: "bread", match: /bread/i, exclude: /crumb|stick/i, category: "grain" },
  { q: "chicken", match: /chicken/i, exclude: /broth|stock|soup|taco|nugget|strip|wing sauce|pie|dog|cat|schnitzel|dip/i, category: "protein" },
  { q: "ground beef", match: /ground (beef|chuck)|lean ground/i, category: "protein" },
  { q: "pork", match: /pork/i, exclude: /rind|sausage roll|dog|cat/i, category: "protein" },
  { q: "tofu", match: /tofu/i, category: "protein" },
  { q: "lentils", match: /lentil/i, exclude: /soup|chip/i, category: "protein" },
  { q: "beans", match: /beans?\b/i, exclude: /coffee|jelly|green bean|espresso/i, category: "protein" },
  { q: "potatoes", match: /potato/i, exclude: /chip|fries|salad|instant|flakes|betty crocker|scalloped/i, category: "vegetable" },
  { q: "onions", match: /onion/i, exclude: /ring|soup/i, category: "vegetable" },
  { q: "carrots", match: /carrot/i, exclude: /cake/i, category: "vegetable" },
  { q: "broccoli", match: /broccoli/i, category: "vegetable" },
  { q: "cabbage", match: /cabbage|bok choy|choy/i, category: "vegetable" },
  { q: "tomatoes", match: /tomato/i, exclude: /sauce|soup|ketchup|juice/i, category: "vegetable" },
  { q: "spinach", match: /spinach/i, exclude: /dip/i, category: "vegetable" },
  { q: "frozen vegetables", match: /vegetable|veggie|peas|corn|mixed/i, exclude: /chip|broth|oil|soup/i, category: "vegetable" },
  { q: "bananas", match: /banana/i, exclude: /bread|chip/i, category: "fruit" },
  { q: "apples", match: /apple/i, exclude: /juice|sauce|pie|chip/i, category: "fruit" },
  { q: "cheese", match: /cheese/i, exclude: /cake|puff|string|crackers/i, category: "dairy" },
  { q: "yogurt", match: /yogurt|yoghurt/i, exclude: /bar|tube|drink/i, category: "dairy" },
];

async function main() {
  const nearby = await fetchNearbyStores(CENTER, RADIUS_KM);
  // Nearest branch of each chain that has a flyer on Flipp.
  const picked: Store[] = [];
  for (const chain of CHAINS) {
    const store = nearby.find((s) => s.chain === chain);
    if (store) {
      const { distanceKm, ...rest } = store;
      picked.push(rest);
      console.log(`store: ${rest.chain} (${distanceKm} km)`);
    } else console.warn(`no ${chain} within ${RADIUS_KM} km`);
  }

  // 1. Collect parsed candidates per (query, store).
  const groups: { q: string; candidates: Product[] }[] = [];
  for (const { q, match, exclude, category } of QUERIES) {
    const items = await searchFlipp(q, POSTAL_CODE);
    for (const store of picked) {
      const matching = items.filter(
        (item) => item.merchant_name === store.chain && match.test(item.name ?? "") && !exclude?.test(item.name ?? ""),
      );
      const candidates: Product[] = [];
      for (const item of matching.slice(0, 8)) {
        const product = flippToProduct(item, await fetchFlippDetail(item.flyer_item_id), store, category);
        // Planning only accepts gram-based products for now (no piece/ml mass mapping yet).
        if (product && product.packageUnit === "g") candidates.push(product);
      }
      groups.push({ q, candidates });
    }
  }

  // 2. Gemini labels each candidate with a category and drops non-meal items (desserts, snacks, drinks).
  //    Without a key, the search-term category is kept and nothing is dropped.
  const unique = [...new Map(groups.flatMap((g) => g.candidates).map((p) => [p.id, p])).values()];
  let labels = new Map<string, Classification>();
  if (process.env.GEMINI_API_KEY) {
    labels = await classifyProducts(unique.map((p) => ({ id: p.id, name: p.name, brand: p.brand })));
    console.log(`classified ${labels.size}/${unique.length} candidates with Gemini`);
  } else console.warn("GEMINI_API_KEY not set: keeping search-term categories");

  // 3. Cheapest per 100 g for each (query, store).
  const products: Product[] = [];
  for (const { candidates } of groups) {
    const usable = candidates
      .filter((p) => labels.get(p.id)?.mealFood !== false)
      .map((p) => applyClassification(p, labels.get(p.id)))
      .sort((a, b) => a.pricePer100 - b.pricePer100);
    for (const dropped of candidates.filter((p) => labels.get(p.id)?.mealFood === false)) {
      console.log(`  skip (not meal food): ${dropped.name}`);
    }
    for (const product of usable.slice(0, PER_QUERY_PER_STORE)) {
      if (!products.some((p) => p.id === product.id)) products.push(product);
    }
  }

  const mock = path.join(process.cwd(), "mock");
  await writeFile(path.join(mock, "stores.json"), `${JSON.stringify(picked, null, 2)}\n`);
  await writeFile(path.join(mock, "products.json"), `${JSON.stringify(products, null, 2)}\n`);
  console.log(`wrote ${picked.length} stores, ${products.length} products`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
