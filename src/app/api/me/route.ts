import { NextResponse } from "next/server";
import { z } from "zod";
import { assertDatabaseConfigured, db } from "@/lib/db";
import { getIdentity } from "@/lib/session";
import { fromProfileRow } from "@/lib/profile-mapper";

export const runtime = "nodejs";

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
  if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) {
    return NextResponse.json({ profile: null, mode: "demo" });
  }
  try {
    assertDatabaseConfigured();
    const result = await db.query("select * from users where auth0_id = $1 limit 1", [identity.sub]);
    return NextResponse.json({
      profile: result.rows[0] ? fromProfileRow(result.rows[0]) : null,
      mode: "database",
    });
  } catch (error) {
    console.error("GET /api/me failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const identity = await getIdentity();
  if (!identity?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const profile = parsed.data;
  if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) {
    return NextResponse.json({ profile, mode: "demo" });
  }
  try {
    assertDatabaseConfigured();
    const result = await db.query(
      `insert into users (
        auth0_id, role, lang, units, dietary, allergies, cuisines,
        meat_veg_ratio, default_servings, equipment, max_distance_km,
        nutrition_goal, onboarding_complete
      ) values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      on conflict (auth0_id) do update set
        role = excluded.role,
        lang = excluded.lang,
        units = excluded.units,
        dietary = excluded.dietary,
        allergies = excluded.allergies,
        cuisines = excluded.cuisines,
        meat_veg_ratio = excluded.meat_veg_ratio,
        default_servings = excluded.default_servings,
        equipment = excluded.equipment,
        max_distance_km = excluded.max_distance_km,
        nutrition_goal = excluded.nutrition_goal,
        onboarding_complete = excluded.onboarding_complete,
        updated_at = now()
      returning *`,
      [
        identity.sub,
        profile.role,
        profile.lang,
        JSON.stringify(profile.units),
        profile.dietary,
        profile.allergies,
        profile.cuisines,
        profile.meatVegRatio,
        profile.defaultServings,
        profile.equipment,
        profile.maxDistanceKm,
        profile.nutritionGoal,
        profile.onboardingComplete,
      ],
    );
    return NextResponse.json({ profile: fromProfileRow(result.rows[0]), mode: "database" });
  } catch (error) {
    console.error("PUT /api/me failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
