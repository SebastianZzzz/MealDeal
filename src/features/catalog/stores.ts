import type { Store } from "@/types";

// Store discovery from OpenStreetMap via Nominatim search: free, no key, fast, and the data may be stored with attribution.
// Public Overpass servers were too slow (17-37 s) for a request-time lookup.
// Every physical store is its own record: chains do not always share prices across branches.

export interface NearbyStore extends Store {
  distanceKm: number;
}

// Chain names as they appear on Flipp flyers. Order matters: more specific names first.
const CHAINS: [RegExp, string][] = [
  [/save[\s-]?on[\s-]?foods/i, "Save-On-Foods"],
  [/no\s*frills/i, "No Frills"],
  [/urban\s*fare/i, "Urban Fare"],
  [/real canadian superstore|superstore/i, "Real Canadian Superstore"],
  [/t\s*&\s*t/i, "T&T Supermarket"],
  [/h\s*mart/i, "H Mart"],
  [/safeway/i, "Safeway"],
  [/freshco/i, "FreshCo"],
  [/walmart/i, "Walmart"],
  [/independent/i, "Your Independent Grocer"],
  [/nesters/i, "Nesters Market"],
  [/choices/i, "Choices Markets"],
  [/price\s*smart/i, "PriceSmart foods"],
  [/buy[\s-]?low/i, "Buy-Low Foods"],
  [/whole foods/i, "Whole Foods Market"],
  [/iga\b/i, "IGA"],
];

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "MealDeal/0.1 (HackCamp 2026)";
const CACHE_MS = 60 * 60 * 1000; // Nominatim policy: no heavy use, so cache each area for an hour
const cache = new Map<string, { at: number; stores: Store[] }>();

export function detectChain(name: string, brand?: string): string {
  const text = `${brand ?? ""} ${name}`;
  for (const [pattern, chain] of CHAINS) if (pattern.test(text)) return chain;
  return name;
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// "chain@location", e.g. "save-on-foods@5945-berton-avenue". Falls back to the OSM id when there is no address.
export function storeId(chain: string, location: string): string {
  return `${slugify(chain)}@${slugify(location)}`;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

interface NominatimPlace {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  address?: Record<string, string>;
}

// Bilingual street names come as "University Boulevard - šxʷyəθəstəm"; keep the English part.
const englishPart = (text: string) => text.split(" - ")[0].trim();

export function storeFromNominatim(place: NominatimPlace): Store | null {
  if (!place.name) return null;
  const a = place.address ?? {};
  const street = [a.house_number, a.road && englishPart(a.road)].filter(Boolean).join(" ");
  const chain = detectChain(place.name);
  return {
    id: storeId(chain, street || `osm-${place.osm_type[0]}${place.osm_id}`),
    name: street ? `${place.name} · ${street}` : place.name,
    chain,
    address: [street, a.city ?? a.town ?? a.village].filter(Boolean).join(", "),
    lat: Number(place.lat),
    lng: Number(place.lon),
  };
}

export async function fetchNearbyStores(center: { lat: number; lng: number }, km: number): Promise<NearbyStore[]> {
  const radiusKm = Math.min(Math.max(km, 0.5), 25);
  const key = `${center.lat.toFixed(3)},${center.lng.toFixed(3)},${radiusKm}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return sortByDistance(hit.stores, center).filter((s) => s.distanceKm <= radiusKm);

  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  const params = new URLSearchParams({
    q: "supermarket",
    format: "jsonv2",
    addressdetails: "1",
    limit: "50",
    bounded: "1",
    viewbox: [center.lng - dLng, center.lat + dLat, center.lng + dLng, center.lat - dLat].map((n) => n.toFixed(5)).join(","),
  });
  const response = await fetch(`${NOMINATIM}?${params}`, {
    headers: { "user-agent": USER_AGENT, "accept-language": "en" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Store lookup failed: Nominatim ${response.status}`);
  const places = (await response.json()) as NominatimPlace[];
  const stores = places.map(storeFromNominatim).filter((s): s is Store => s !== null);
  cache.set(key, { at: Date.now(), stores });
  return sortByDistance(stores, center).filter((s) => s.distanceKm <= radiusKm);
}

export function sortByDistance(stores: Store[], center: { lat: number; lng: number }): NearbyStore[] {
  return stores
    .map((store) => ({ ...store, distanceKm: Number(distanceKm(center, store).toFixed(2)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
