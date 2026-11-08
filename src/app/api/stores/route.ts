import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, validationError } from "@/lib/api-error";
import { DEMO_CENTER, findNearbyStores } from "@/features/catalog/nearby";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).default(DEMO_CENTER.lat),
  lng: z.coerce.number().min(-180).max(180).default(DEMO_CENTER.lng),
  km: z.coerce.number().min(0.5).max(25).default(5),
});

// GET /api/stores?lat&lng&km — grocery stores nearby, nearest first.
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return validationError(parsed.error, "Location must be a valid latitude, longitude and distance.");
  const { lat, lng, km } = parsed.data;
  let result;
  try {
    result = await findNearbyStores({ lat, lng }, km);
  } catch (error) {
    console.error("GET /api/stores failed", error instanceof Error ? error.message : error);
    return apiError("DATABASE_UNAVAILABLE", "Stores can't be loaded right now. Try again shortly.");
  }
  return NextResponse.json({ ...result, attribution: "Store data © OpenStreetMap contributors" });
}
