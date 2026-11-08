import { z } from "zod";
import { assertDatabaseConfigured, db } from "@/lib/db";
import { getIdentity } from "@/lib/session";
import { fromProfileRow } from "@/lib/profile-mapper";
import { CHOICE_FORMAT } from "@/lib/custom-choices";
import { firstChoiceProblem } from "@/lib/choice-model";
import { apiError, validationError } from "@/lib/api-error";
import { dietaryFieldErrors } from "@/lib/profile-validation";

export const runtime = "nodejs";

const profileSchema = z.object({
  role: z.enum(["student", "merchant"]),
  lang: z.enum(["en", "zh"]),
  units: z.object({
    lang: z.enum(["en", "zh"]),
    weight: z.enum(["g", "kg", "lb", "oz", "jin"]),
    volume: z.enum(["ml", "l", "cup", "fl_oz"]),
  }),
  // Free-text choices reach the planner and its prompt: short names in letters only.
  dietary: z.array(z.string().regex(CHOICE_FORMAT, "Use a short name with letters only.")).max(20),
  allergies: z.array(z.string().regex(CHOICE_FORMAT, "Use a short name with letters only.")).max(20),
  cuisines: z.array(z.string().max(80)).max(20),
  meatVegRatio: z.enum(["more_meat", "balanced", "more_veg", "vegetarian"]),
  defaultServings: z.number().int().min(1).max(20),
  equipment: z.array(z.string().regex(CHOICE_FORMAT, "Use a short name with letters only.")).max(30),
  maxDistanceKm: z.number().min(0.5).max(50),
  home: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable().optional(),
  nutritionGoal: z.union([z.literal(""), z.string().regex(CHOICE_FORMAT, "Use a short name with letters only.")]),
  onboardingComplete: z.boolean(),
}).superRefine((profile, context) => {
  for (const [field, message] of Object.entries(dietaryFieldErrors(profile))) {
    context.addIssue({ code: "custom", path: [field], message });
  }
});

function isConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string" && error.code.startsWith("23");
}

export async function GET() {
  const identity = await getIdentity();
  if (!identity?.sub) return apiError("UNAUTHORIZED", "Please log in to view your profile.");
  if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) {
    return Response.json({ profile: null, mode: "demo" });
  }
  try {
    assertDatabaseConfigured();
    const result = await db.query("select * from users where auth0_id = $1 limit 1", [identity.sub]);
    return Response.json({
      profile: result.rows[0] ? fromProfileRow(result.rows[0]) : null,
      mode: "database",
    });
  } catch (error) {
    console.error("GET /api/me failed", error instanceof Error ? error.message : "Unknown error");
    return apiError("DATABASE_UNAVAILABLE", "Your profile is unavailable right now. Please try again later.");
  }
}

export async function PUT(request: Request) {
  const identity = await getIdentity();
  if (!identity?.sub) return apiError("UNAUTHORIZED", "Please log in to save your profile.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_FAILED", "The profile request is not valid.");
  }
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const profile = parsed.data;
  // Diet and allergy entries reach the planner prompt: verify them here, not only in the browser.
  for (const [field, kind] of [["dietary", "dietary"], ["allergies", "allergy"]] as const) {
    const problem = await firstChoiceProblem(kind, profile[field]);
    if (problem) {
      return apiError(problem.check.retry ? "SERVICE_UNAVAILABLE" : "VALIDATION_FAILED", problem.check.message, { [`${field}.${problem.index}`]: problem.check.message });
    }
  }
  if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) {
    return Response.json({ profile, mode: "demo" });
  }
  try {
    assertDatabaseConfigured();
    const result = await db.query(
      `insert into users (
        auth0_id, role, lang, units, dietary, allergies, cuisines,
        meat_veg_ratio, default_servings, equipment, max_distance_km,
        nutrition_goal, onboarding_complete, home_lat, home_lng
      ) values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
        home_lat = excluded.home_lat,
        home_lng = excluded.home_lng,
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
        // Store only about 100 m of precision.
        profile.home ? Math.round(profile.home.lat * 1000) / 1000 : null,
        profile.home ? Math.round(profile.home.lng * 1000) / 1000 : null,
      ],
    );
    return Response.json({ profile: fromProfileRow(result.rows[0]), mode: "database" });
  } catch (error) {
    console.error("PUT /api/me failed", error instanceof Error ? error.message : "Unknown error");
    if (isConstraintError(error)) {
      return apiError("CONFLICT", "This profile conflicts with existing account data. Please reload and try again.");
    }
    return apiError("DATABASE_UNAVAILABLE", "Your profile could not be saved because the database is unavailable.");
  }
}
