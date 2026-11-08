import { NextResponse } from "next/server";
import { z } from "zod";
import type { PriceTagResult } from "@/types";
import { ExtractionError, extractPriceTag, type ExtractedItem } from "@/features/catalog/extract";
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
  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    return NextResponse.json({ error: "Attach a photo of a price tag." }, { status: 400 });
  }
  if (image.size > MAX_BYTES) return NextResponse.json({ error: "Photo is too large." }, { status: 413 });
  const location = locationSchema.parse({ lat: form?.get("lat") ?? undefined, lng: form?.get("lng") ?? undefined });

  try {
    const [items, nearby] = await Promise.all([
      extractPriceTag({ data: Buffer.from(await image.arrayBuffer()), mimeType: image.type }),
      findNearbyStores(location, 5),
    ]);
    if (items.length === 0) {
      return NextResponse.json({ error: "No price tag found in this photo. Try again closer, or enter it manually." }, { status: 422 });
    }
    const body: PriceTagResponse = {
      items,
      nearbyStores: nearby.stores,
      storesLive: nearby.live,
      date: new Date().toLocaleDateString("en-CA", { timeZone: "America/Vancouver" }),
    };
    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof ExtractionError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Something went wrong while reading the photo." }, { status: 500 });
  }
}
