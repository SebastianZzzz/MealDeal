import { apiError } from "@/lib/api-error";
import { describeArea, geocodePostal, normalizePostal, POSTAL_CODE, roundCoord } from "@/features/catalog/geocode";

// GET /api/geocode?postal=V6T1Z4        -> { lat, lng, postal, area } (about 100 m)
// GET /api/geocode?lat=49.26&lng=-123.25 -> { lat, lng, area }        (confirms "Use my location")
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const postal = params.get("postal")?.trim();
  try {
    if (postal !== undefined) {
      if (!POSTAL_CODE.test(postal)) {
        return apiError("VALIDATION_FAILED", "Enter a Canadian postal code like V6T 1Z4.", { postal: "Use the format A1A 1A1." });
      }
      const point = await geocodePostal(postal);
      if (!point) return apiError("NOT_FOUND", "We couldn't find that postal code. Try your current location instead.");
      const area = await describeArea(point.lat, point.lng).catch(() => null);
      return Response.json({ ...point, postal: normalizePostal(postal), area }, { headers: { "Cache-Control": "public, max-age=86400" } });
    }
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (!params.has("lat") || !params.has("lng") || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return apiError("VALIDATION_FAILED", "Send a postal code, or a latitude and longitude.");
    }
    const point = { lat: roundCoord(lat), lng: roundCoord(lng) };
    return Response.json({ ...point, area: await describeArea(point.lat, point.lng) });
  } catch (error) {
    console.error("GET /api/geocode failed", error instanceof Error ? error.message : error);
    return apiError("UPSTREAM_FAILED", "Location lookup is unavailable right now. Try again, or enter a postal code.");
  }
}
