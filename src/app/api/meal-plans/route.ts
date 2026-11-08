import { assertDatabaseConfigured, db } from "@/lib/db";
import { getIdentity } from "@/lib/session";
import { apiError } from "@/lib/api-error";
import { parseCurrentPlan } from "@/features/cooking/plan-storage";
import { planFromRow, PLAN_COLUMNS } from "@/features/planning/plan-row";
import type { MealPlan } from "@/types";

export const runtime = "nodejs";

const MAX_BODY = 256 * 1024;

// POST /api/meal-plans { request, chosen } — saves the option the student picked, so shopping and
// cooking progress follow them across devices (D's /api/cooking/:id reads and updates this row).
export async function POST(request: Request) {
  const identity = await getIdentity();
  if (!identity?.sub) return apiError("UNAUTHORIZED", "Please log in to save your plan.");
  const text = await request.text();
  if (text.length > MAX_BODY) return apiError("PAYLOAD_TOO_LARGE", "This plan is too large to save.");
  let body: { request?: unknown; chosen?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return apiError("VALIDATION_FAILED", "The plan request is not valid.");
  }
  // Reuse D's plan schema so a saved row always opens in cooking mode.
  const candidate = { id: "pending", userId: identity.sub, request: body.request, chosen: body.chosen, status: "shopping", progress: {}, createdAt: new Date().toISOString() };
  let plan: MealPlan;
  try {
    plan = parseCurrentPlan(JSON.stringify(candidate))!;
  } catch {
    return apiError("VALIDATION_FAILED", "This plan could not be saved. Please choose it again.");
  }
  if (plan.chosen.shoppingList.some((item) => item.bought)) {
    return apiError("VALIDATION_FAILED", "A new plan starts with nothing bought.");
  }
  if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) {
    return Response.json({ plan: null, mode: "demo" });
  }
  try {
    assertDatabaseConfigured();
    const result = await db.query(
      `insert into meal_plans (user_id, request, chosen, status, progress)
       select u.id, $2::jsonb, $3::jsonb, 'shopping', '{}'::jsonb from users u where u.auth0_id = $1
       returning ${PLAN_COLUMNS}`,
      [identity.sub, JSON.stringify(plan.request), JSON.stringify(plan.chosen)],
    );
    if (!result.rows[0]) return apiError("CONFLICT", "Finish setting up your kitchen before saving a plan.");
    return Response.json({ plan: planFromRow(result.rows[0], identity.sub), mode: "database" }, { status: 201 });
  } catch (error) {
    console.error("POST /api/meal-plans failed", error instanceof Error ? error.message : "Unknown error");
    return apiError("DATABASE_UNAVAILABLE", "Your plan could not be saved to your account right now.");
  }
}
