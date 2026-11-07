import { NextResponse } from "next/server";
import { z } from "zod";
import { getIdentity } from "@/lib/session";
import { getAdminDb } from "@/lib/supabase";
import { fromProfileRow, toProfileRow } from "@/lib/profile-mapper";

const profileSchema = z.object({
  role: z.enum(["student", "merchant"]),
  lang: z.enum(["en", "zh"]),
  units: z.object({
    lang: z.enum(["en", "zh"]),
    weight: z.enum(["g", "kg", "lb", "jin"]),
    volume: z.enum(["ml", "l", "cup"]),
  }),
  dietary: z.array(z.string().max(80)).max(20),
  allergies: z.array(z.string().max(80)).max(20),
  cuisines: z.array(z.string().max(80)).max(20),
  meatVegRatio: z.enum(["more_meat", "balanced", "more_veg", "vegetarian"]),
  defaultServings: z.number().int().min(1).max(20),
  equipment: z.array(z.string().max(80)).max(30),
  maxDistanceKm: z.number().min(0.5).max(50),
  nutritionGoal: z.string().max(300),
  onboardingComplete: z.boolean(),
});

export async function GET() {
  const identity = await getIdentity();
  if (!identity?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ profile: null, mode: "demo" });
  const { data, error } = await db.from("users").select("*").eq("auth0_id", identity.sub).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data ? fromProfileRow(data) : null, mode: "cloud" });
}

export async function PUT(request: Request) {
  const identity = await getIdentity();
  if (!identity?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const db = getAdminDb();
  if (!db) return NextResponse.json({ profile: parsed.data, mode: "demo" });
  const { data, error } = await db
    .from("users")
    .upsert(toProfileRow(parsed.data, identity.sub), { onConflict: "auth0_id" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: fromProfileRow(data), mode: "cloud" });
}
