import { NextResponse } from "next/server";
import { z } from "zod";
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
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { lat, lng, km } = parsed.data;
  const result = await findNearbyStores({ lat, lng }, km);
  return NextResponse.json({ ...result, attribution: "Store data © OpenStreetMap contributors" });
}
