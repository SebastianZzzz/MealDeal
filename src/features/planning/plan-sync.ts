import type { MealPlan, PlanOption, PlanRequest } from "@/types";
import { parseCurrentPlan } from "@/features/cooking/plan-storage";
import { readApiError } from "@/lib/api-error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pendingShopping = new Map<string, Promise<boolean>>();

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
async function sendShopping(id: string, body: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/meal-plans/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000),
      body,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function syncShopping(plan: MealPlan): Promise<boolean> {
  if (!isAccountPlan(plan)) {
    return Promise.resolve(false);
  }
  // Capture this click's state before waiting; later clicks must not mutate its payload.
  const body = JSON.stringify({
    bought: plan.chosen.shoppingList.filter((item) => item.bought).map((item) => item.productId),
    status: plan.status === "shopping" ? "shopping" : "cooking",
  });
  const previous = pendingShopping.get(plan.id) ?? Promise.resolve(true);
  const task = previous.then(() => sendShopping(plan.id, body));
  pendingShopping.set(plan.id, task);
  void task.then(() => {
    if (pendingShopping.get(plan.id) === task) {
      pendingShopping.delete(plan.id);
    }
  });
  return task;
}

/** Discover unfinished plans for the authenticated account, including on a new device. */
export async function loadAccountPlans(): Promise<MealPlan[]> {
  const response = await fetch("/api/meal-plans", { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error((await readApiError(response)).error);
  }
  const body = await response.json();
  if (!Array.isArray(body.plans)) {
    throw new Error("Saved plans could not be read. Please try again.");
  }
  return body.plans.map((value: unknown) => {
    const plan = parseCurrentPlan(JSON.stringify(value));
    if (!plan || !isAccountPlan(plan)) {
      throw new Error("A saved plan could not be read. Please try again.");
    }
    return plan;
  });
}
