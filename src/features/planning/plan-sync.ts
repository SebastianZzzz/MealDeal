import type { MealPlan, PlanOption, PlanRequest } from "@/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the plan has a row in meal_plans (its id came from the database). */
export const isAccountPlan = (plan: Pick<MealPlan, "id">) => UUID.test(plan.id);

/** Save the chosen option to the student's account. Null when that is not possible (demo, logged out, offline). */
export async function savePlanToAccount(request: PlanRequest, chosen: PlanOption): Promise<MealPlan | null> {
  try {
    const response = await fetch("/api/meal-plans", {
      method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ request, chosen }), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const body = await response.json();
    return body.plan && isAccountPlan(body.plan) ? body.plan as MealPlan : null;
  } catch {
    return null;
  }
}

/** Mirror shopping progress to the account. The browser copy stays the source of truth on this device. */
export async function syncShopping(plan: MealPlan): Promise<boolean> {
  if (!isAccountPlan(plan)) return false;
  try {
    const response = await fetch(`/api/meal-plans/${plan.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        bought: plan.chosen.shoppingList.filter((item) => item.bought).map((item) => item.productId),
        status: plan.status === "shopping" ? "shopping" : "cooking",
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
