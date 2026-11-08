import type { MealPlan } from "../../types";
import { parseCurrentPlan } from "./plan-storage";
import { requireOk } from "../community/api-client";

export async function syncCookingPlan(id: string, progress?: Record<string, number>): Promise<MealPlan> {
  const response = await fetch(`/api/cooking/${encodeURIComponent(id)}`, {
    method: progress ? "PATCH" : "GET", cache: "no-store", signal: AbortSignal.timeout(10000),
    ...(progress ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ progress }) } : {}),
  });
  await requireOk(response);
  const body = await response.json();
  const plan = parseCurrentPlan(JSON.stringify(body.plan));
  if (!plan || plan.id !== id) throw new Error("The account service returned a different plan.");
  return plan;
}
