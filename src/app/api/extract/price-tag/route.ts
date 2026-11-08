import { NextResponse } from "next/server";
import { z } from "zod";
import type { PriceTagResult } from "@/types";
import { ExtractionError, extractPriceTag, type ExtractedItem } from "@/features/catalog/extract";
import { apiError, validationError } from "@/lib/api-error";
import { getIdentity } from "@/lib/session";
import { DEMO_CENTER, findNearbyStores } from "@/features/catalog/nearby";
import type { NearbyStore } from "@/features/catalog/stores";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel request bodies are capped at 4.5 MB; the page resizes photos first
const locationSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).default(DEMO_CENTER.lat),
  lng: z.coerce.number().min(-180).max(180).default(DEMO_CENTER.lng),
});

export type PriceTagResponse = Omit<PriceTagResult, "items" | "nearbyStores"> & {
  items: ExtractedItem[];
  nearbyStores: NearbyStore[];
  storesLive: boolean;
};

// POST /api/extract/price-tag (multipart: image, lat?, lng?) — the photo goes to Gemini and is then discarded.
export async function POST(request: Request) {
  // Each photo costs a Gemini call, so only signed-in students can use it.
  if (!(await getIdentity())?.sub) return apiError("UNAUTHORIZED", "Please log in to read a price tag.");
  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    return apiError("VALIDATION_FAILED", "Attach a photo of a price tag.", { image: "Required" });
  }
  if (image.size > MAX_BYTES) return apiError("PAYLOAD_TOO_LARGE", "That photo is too large. Try again; the page shrinks photos automatically.");
  const parsedLocation = locationSchema.safeParse({ lat: form?.get("lat") ?? undefined, lng: form?.get("lng") ?? undefined });
  if (!parsedLocation.success) return validationError(parsedLocation.error, "Your location looks invalid.");
  const location = parsedLocation.data;

  try {
    const [items, nearby] = await Promise.all([
      extractPriceTag({ data: Buffer.from(await image.arrayBuffer()), mimeType: image.type }),
      findNearbyStores(location, 5),
    ]);
    if (items.length === 0) {
      return apiError("UNPROCESSABLE", "No price tag found in this photo. Try again closer, or enter it manually.");
    }
    const body: PriceTagResponse = {
      items,
      nearbyStores: nearby.stores,
      storesLive: nearby.live,
      date: new Date().toLocaleDateString("en-CA", { timeZone: "America/Vancouver" }),
    };
    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof ExtractionError) {
      return apiError(error.status === 503 ? "SERVICE_UNAVAILABLE" : "UPSTREAM_FAILED", error.message);
    }
    console.error("POST /api/extract/price-tag failed", error instanceof Error ? error.message : error);
    return apiError("INTERNAL", "Something went wrong while reading the photo.");
  }
}
