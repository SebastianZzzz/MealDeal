import { apiError } from "@/lib/api-error";
import { geocodePostal, normalizePostal, POSTAL_CODE } from "@/features/catalog/geocode";

// GET /api/geocode?postal=V6T1Z4 -> { lat, lng, postal } rounded to about 100 m.
export async function GET(request: Request) {
  const postal = new URL(request.url).searchParams.get("postal")?.trim() ?? "";
  if (!POSTAL_CODE.test(postal)) {
    return apiError("VALIDATION_FAILED", "Enter a Canadian postal code like V6T 1Z4.", { postal: "Use the format A1A 1A1." });
  }
  try {
    const point = await geocodePostal(postal);
    if (!point) return apiError("NOT_FOUND", "We couldn't find that postal code. Try your current location instead.");
    return Response.json({ ...point, postal: normalizePostal(postal) }, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch (error) {
    console.error("GET /api/geocode failed", error instanceof Error ? error.message : error);
    return apiError("UPSTREAM_FAILED", "Location lookup is unavailable right now. Try again, or use your current location.");
  }
}
