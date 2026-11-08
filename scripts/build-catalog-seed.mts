// Builds mock/stores.json and mock/products.json from real data:
// stores from OpenStreetMap around Ponderosa (UBC), prices from this week's flyers on Flipp.
// Usage: npm run seed:catalog
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Product, Store } from "../src/types.ts";
import { fetchFlippDetail, flippToProduct, searchFlipp } from "../src/features/catalog/flipp.ts";
import { fetchNearbyStores } from "../src/features/catalog/stores.ts";

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

  const products: Product[] = [];
  for (const { q, match, exclude, category } of QUERIES) {
    const items = await searchFlipp(q, POSTAL_CODE);
    for (const store of picked) {
      const candidates = items.filter(
        (item) => item.merchant_name === store.chain && match.test(item.name ?? "") && !exclude?.test(item.name ?? ""),
      );
      const parsed: Product[] = [];
      for (const item of candidates.slice(0, 8)) {
        const product = flippToProduct(item, await fetchFlippDetail(item.flyer_item_id), store, category);
        // Planning only accepts gram-based products for now (no piece/ml mass mapping yet).
        if (product && product.packageUnit === "g") parsed.push(product);
      }
      parsed.sort((a, b) => a.pricePer100 - b.pricePer100);
      for (const product of parsed.slice(0, PER_QUERY_PER_STORE)) {
        if (!products.some((p) => p.id === product.id)) products.push(product);
      }
    }
    console.log(`${q}: ${products.length} products so far`);
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
