import type { Product, Store } from "@/types";
import { normalizePrice } from "./pricing.ts";
import { slugify } from "./stores.ts";

// Flipp's public flyer search (unofficial, undocumented). Used only for one-off flyer imports, never per user request.
// Flyer prices are chain-wide for a region, so each item is attached to every nearby branch of that chain.

const FLIPP = "https://backflipp.wishabi.com/flipp";
const HEADERS = { "user-agent": "Mozilla/5.0 (MealDeal HackCamp 2026)" };

export interface FlippItem {
  id: number;
  flyer_item_id: number;
  merchant_name: string;
  name: string | null;
  current_price: number | null;
  pre_price_text: string | null;
  post_price_text: string | null;
  sale_story: string | null;
  valid_from: string;
  valid_to: string;
}

export interface FlippDetail {
  description?: string | null;
  price_text?: string | null;
  valid_from?: string;
  valid_to?: string;
}

export async function searchFlipp(query: string, postalCode: string): Promise<FlippItem[]> {
  const url = `${FLIPP}/items/search?${new URLSearchParams({ locale: "en-ca", postal_code: postalCode, q: query })}`;
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Flipp search ${response.status}`);
  const data = (await response.json()) as { items?: FlippItem[] };
  return (data.items ?? []).filter((item) => item.name && item.current_price);
}

export async function fetchFlippDetail(flyerItemId: number): Promise<FlippDetail> {
  const response = await fetch(`${FLIPP}/items/${flyerItemId}`, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Flipp item ${response.status}`);
  const data = (await response.json()) as { item?: FlippDetail };
  return data.item ?? {};
}

// Flipp splits the price across fields, e.g. pre "3 for" + current 5 -> "3 for $5"; current 2.99 + post "lb" -> "$2.99 lb".
export function flippPriceText(item: FlippItem): string {
  return [item.pre_price_text, `$${item.current_price}`, item.post_price_text].filter(Boolean).join(" ");
}

export function tidyName(name: string): string {
  const trimmed = name
    .replace(/[®™]/g, "")
    .replace(/\s+/g, " ")
    // Drop a printed size at the end: "TILDA BASMATI RICE, 4.54 kg", "TOFU, 150/300 G", "BEEF, 2 X 450g"
    .replace(/,\s*[\d.,/x×\s-]*\s*(kg|g|ml|l|lbs?|pk|ct)\b.*$/i, "")
    .replace(/[,\s]+$/, "")
    .trim();
  const letters = trimmed.replace(/[^a-z]/gi, "");
  const upper = letters.replace(/[^A-Z]/g, "").length;
  if (letters.length === 0 || upper / letters.length < 0.7) return trimmed;
  // Mostly-caps flyer text -> Title Case
  return trimmed.toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (_, gap: string, c: string) => gap + c.toUpperCase());
}

export function productId(storeId: string, name: string, packageSizeG: number, unit: Product["packageUnit"]): string {
  return `${storeId}:${slugify(name)}-${Math.round(packageSizeG)}${unit}`;
}

// Size is usually in the detail description ("Canada or USA, 3 lbs") or the item name ("BREAD, 600 G").
export function flippToProduct(
  item: FlippItem,
  detail: FlippDetail,
  store: Store,
  category: Product["category"],
): Product | null {
  const name = tidyName(item.name ?? "");
  const priceText = flippPriceText(item);
  const normalized =
    normalizePrice(detail.description, priceText) ??
    normalizePrice(item.name, priceText) ??
    normalizePrice(item.post_price_text, priceText);
  if (!name || !normalized) return null;
  return {
    id: productId(store.id, name, normalized.packageSizeG, normalized.packageUnit),
    storeId: store.id,
    name,
    packageSizeG: normalized.packageSizeG,
    packageUnit: normalized.packageUnit,
    packagePrice: normalized.packagePrice,
    pricePer100: normalized.pricePer100,
    isSale: true, // everything in a weekly flyer is a promoted price
    validUntil: detail.valid_to ?? item.valid_to,
    source: "flyer",
    confidence: normalized.soldByWeight ? 0.9 : 1,
    reportedAt: detail.valid_from ?? item.valid_from,
    category,
  };
}
