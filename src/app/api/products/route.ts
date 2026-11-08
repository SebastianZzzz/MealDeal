import { NextResponse } from "next/server";
import { z } from "zod";
import type { Product } from "@/types";
import { getIdentity } from "@/lib/session";
import { CATEGORIES } from "@/features/catalog/categories";
import { productId } from "@/features/catalog/flipp";
import { normalizePrice } from "@/features/catalog/pricing";
import { getStore, listProducts, saveProduct, saveStore } from "@/features/catalog/repo";

const listSchema = z.object({
  storeId: z.string().optional(),
  category: z.enum(CATEGORIES).optional(),
  includeExpired: z.enum(["1", "true"]).optional(),
});

// GET /api/products?storeId=a,b&category=protein — current prices; expired flyer prices are excluded.
export async function GET(request: Request) {
  const parsed = listSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { storeId, category, includeExpired } = parsed.data;
  const products = await listProducts({
    storeIds: storeId?.split(",").filter(Boolean),
    category,
    includeExpired: Boolean(includeExpired),
  });
  return NextResponse.json({ products });
}

const storeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+@[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  chain: z.string().max(80),
  address: z.string().max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const reportSchema = z.object({
  storeId: z.string().min(1),
  store: storeSchema.optional(), // a store found by the live lookup that we have not stored yet
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(80).optional(),
  sizeText: z.string().trim().max(60),
  priceText: z.string().trim().min(1).max(60),
  isSale: z.boolean(),
  category: z.enum(CATEGORIES).optional(),
  confidence: z.number().min(0).max(1).default(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// POST /api/products — save a user-confirmed price-tag report. Numbers are recomputed here from the text.
export async function POST(request: Request) {
  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const report = parsed.data;

  let store = await getStore(report.storeId);
  if (!store && report.store?.id === report.storeId) store = await saveStore(report.store);
  if (!store) return NextResponse.json({ error: "Unknown store" }, { status: 400 });

  const normalized = normalizePrice(report.sizeText, report.priceText);
  if (!normalized) {
    return NextResponse.json(
      { error: 'Could not read the size or price. Try a size like "500 g" or "per lb" and a price like "$3.99".' },
      { status: 422 },
    );
  }

  const identity = await getIdentity();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Vancouver" });
  const product: Product = {
    id: productId(store.id, report.name, normalized.packageSizeG, normalized.packageUnit),
    storeId: store.id,
    name: report.name,
    brand: report.brand || undefined,
    packageSizeG: normalized.packageSizeG,
    packageUnit: normalized.packageUnit,
    packagePrice: normalized.packagePrice,
    pricePer100: normalized.pricePer100,
    isSale: report.isSale,
    source: "report",
    confidence: report.confidence,
    reportedBy: identity?.sub,
    reportedAt: !report.date || report.date === today ? new Date().toISOString() : `${report.date}T12:00:00-08:00`,
    category: report.category,
  };
  return NextResponse.json({ product: await saveProduct(product) }, { status: 201 });
}
