import { z } from "zod";
import { assertDatabaseConfigured, db } from "@/lib/db";
import { getIdentity } from "@/lib/session";
import { apiError, validationError } from "@/lib/api-error";
import { planFromRow, PLAN_COLUMNS } from "@/features/planning/plan-row";
import type { MealPlan } from "@/types";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const patchSchema = z.object({
  bought: z.array(z.string().min(1).max(200)).max(200),
  status: z.enum(["shopping", "cooking"]),
});

// PATCH /api/meal-plans/:id { bought: productId[], status } — shopping progress only.
// Recipes, prices and cooking progress are never taken from the client here.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let identity;
  try {
    identity = await getIdentity();
  } catch {
    return apiError("SERVICE_UNAVAILABLE", "Sign-in is unavailable right now. Please try again later.");
  }
  if (!identity?.sub) {
    return apiError("UNAUTHORIZED", "Please log in to save your shopping list.");
  }
  const { id } = await params;
  if (!UUID.test(id)) {
    return apiError("NOT_FOUND", "This plan is not saved to your account.");
  }
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) {
    return Response.json({ plan: null, mode: "demo" });
  }
  try {
    assertDatabaseConfigured();
    const found = await db.query(
      `select p.${PLAN_COLUMNS.split(", ").join(", p.")} from meal_plans p join users u on u.id = p.user_id
       where p.id = $1 and u.auth0_id = $2`,
      [id, identity.sub],
    );
    if (!found.rows[0]) {
      return apiError("NOT_FOUND", "This plan is not saved to your account.");
    }
    const plan = planFromRow(found.rows[0], identity.sub);
    if (plan.status === "done") {
      return apiError("CONFLICT", "This plan is already finished.");
    }
    const bought = new Set(parsed.data.bought);
    if (parsed.data.bought.some((productId) => !plan.chosen.shoppingList.some((item) => item.productId === productId))) {
      return apiError("VALIDATION_FAILED", "The shopping list no longer matches this plan.");
    }
    const shoppingList = plan.chosen.shoppingList.map((item) => ({ ...item, bought: bought.has(item.productId) }));
    if (parsed.data.status === "cooking" && !shoppingList.every((item) => item.bought)) {
      return apiError("CONFLICT", "Check off every item before you start cooking.");
    }
    // Once cooking has started, D owns the status; shopping changes do not move it back.
    const status: MealPlan["status"] = plan.status === "cooking" ? "cooking" : parsed.data.status;
    const updated = await db.query(
      `update meal_plans set chosen = $2::jsonb, status = $3, updated_at = now()
       where id = $1 and chosen = $4::jsonb and progress = $5::jsonb and status = $6
       and user_id in (select id from users where auth0_id = $7)
       returning ${PLAN_COLUMNS}`,
      [id, JSON.stringify({ ...plan.chosen, shoppingList }), status, JSON.stringify(plan.chosen), JSON.stringify(plan.progress), plan.status, identity.sub],
    );
    if (!updated.rows[0]) {
      return apiError("CONFLICT", "This plan changed on another device. Review your saved plan before trying again.");
    }
    return Response.json({ plan: planFromRow(updated.rows[0], identity.sub), mode: "database" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("PATCH /api/meal-plans/:id failed", error instanceof Error ? error.name : "Unknown error");
    return apiError("DATABASE_UNAVAILABLE", "Your shopping list could not be saved to your account right now.");
  }
}
