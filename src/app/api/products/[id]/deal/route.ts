import { NextResponse } from "next/server";
import { getDealCheck } from "@/features/catalog/deal-check";

// GET /api/products/:id/deal — current price vs the 28-day median at the same store (DealCheck).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 300) return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  try {
    const deal = await getDealCheck(id);
    if (!deal) return NextResponse.json({ error: "Unknown product" }, { status: 404 });
    return NextResponse.json(deal, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Price history is unavailable right now." }, { status: 503 });
  }
}
