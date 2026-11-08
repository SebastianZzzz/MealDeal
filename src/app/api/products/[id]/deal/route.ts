import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { getDealCheck } from "@/features/catalog/deal-check";

// GET /api/products/:id/deal — current price vs the 28-day median at the same store (DealCheck).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 300) return apiError("VALIDATION_FAILED", "Invalid product id.");
  try {
    const deal = await getDealCheck(id);
    if (!deal) return apiError("NOT_FOUND", "We don't have this product.");
    return NextResponse.json(deal, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/products/:id/deal failed", error instanceof Error ? error.message : error);
    return apiError("DATABASE_UNAVAILABLE", "Price history is unavailable right now.");
  }
}
