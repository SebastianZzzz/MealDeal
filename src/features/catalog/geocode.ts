// Canadian postal code -> approximate point, so a student can set a shopping area without sharing GPS.
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const REVERSE = "https://nominatim.openstreetmap.org/reverse";

/** Neighbourhood-level name for a point, e.g. "Point Grey, Vancouver", so people can check we found them. */
export async function describeArea(lat: number, lng: number): Promise<string | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: "jsonv2", zoom: "14" });
  const response = await fetch(`${REVERSE}?${params}`, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
  const place = await response.json() as { address?: Record<string, string> };
  const a = place.address ?? {};
  const local = a.neighbourhood ?? a.suburb ?? a.quarter ?? a.city_district;
  const city = a.city ?? a.town ?? a.village ?? a.municipality;
  return [local, city].filter(Boolean).join(", ") || null;
}
const USER_AGENT = "MealDeal/0.1 (HackCamp 2026)";
const cache = new Map<string, { lat: number; lng: number } | null>();

export const POSTAL_CODE = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

/** "v6t1z4" -> "V6T 1Z4" */
export function normalizePostal(code: string): string {
  const compact = code.replace(/\s+/g, "").toUpperCase();
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}

// About 100 m: enough to find stores, not enough to pinpoint a home.
export const roundCoord = (value: number) => Math.round(value * 1000) / 1000;

export async function geocodePostal(code: string): Promise<{ lat: number; lng: number } | null> {
  const postal = normalizePostal(code);
  if (cache.has(postal)) return cache.get(postal)!;
  const params = new URLSearchParams({ postalcode: postal, countrycodes: "ca", format: "jsonv2", limit: "1" });
  let response = await fetch(`${NOMINATIM}?${params}`, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  let places = response.ok ? await response.json() as { lat: string; lon: string }[] : [];
  if (!places.length) {
    // Full codes are not always indexed; the first three characters (the area) are.
    const area = new URLSearchParams({ q: `${postal.slice(0, 3)}, Canada`, format: "jsonv2", limit: "1" });
    response = await fetch(`${NOMINATIM}?${area}`, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    places = response.ok ? await response.json() as { lat: string; lon: string }[] : [];
  }
  if (!response.ok && !places.length) throw new Error(`Nominatim responded ${response.status}`);
  const place = places[0];
  const point = place ? { lat: roundCoord(Number(place.lat)), lng: roundCoord(Number(place.lon)) } : null;
  cache.set(postal, point);
  return point;
}
