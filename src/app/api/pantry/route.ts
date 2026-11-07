import { NextResponse } from "next/server";
import { z } from "zod";
import { getIdentity } from "@/lib/session";
import { getAdminDb } from "@/lib/supabase";

const pantrySchema = z.array(z.object({
  name: z.string().trim().min(1).max(100),
  foodId: z.string().uuid().nullable().optional(),
  qtyG: z.number().min(0).max(100000),
})).max(100);

async function getUserId(auth0Id: string) {
  const db = getAdminDb();
  if (!db) return { db: null, userId: null };
  const { data } = await db.from("users").select("id").eq("auth0_id", auth0Id).maybeSingle();
  return { db, userId: data?.id as string | undefined };
}

export async function GET() {
  const identity = await getIdentity();
  if (!identity?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { db, userId } = await getUserId(identity.sub);
  if (!db) return NextResponse.json({ items: [], mode: "demo" });
  if (!userId) return NextResponse.json({ items: [], mode: "cloud" });
  const { data, error } = await db.from("pantry_items").select("*").eq("user_id", userId).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data ?? []).map((item) => ({
    id: item.id, name: item.name, foodId: item.food_id, qtyG: Number(item.qty_g), updatedAt: item.updated_at,
  })), mode: "cloud" });
}

export async function PUT(request: Request) {
  const identity = await getIdentity();
  if (!identity?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = pantrySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { db, userId } = await getUserId(identity.sub);
  if (!db) return NextResponse.json({ items: parsed.data, mode: "demo" });
  if (!userId) return NextResponse.json({ error: "Complete profile first" }, { status: 409 });
  const { error: deleteError } = await db.from("pantry_items").delete().eq("user_id", userId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  if (parsed.data.length) {
    const { error } = await db.from("pantry_items").insert(parsed.data.map((item) => ({
      user_id: userId, name: item.name, food_id: item.foodId ?? null, qty_g: item.qtyG,
    })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: parsed.data, mode: "cloud" });
}
