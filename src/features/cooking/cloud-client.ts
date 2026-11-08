import type { MealPlan } from "../../types";
import { parseCurrentPlan } from "./plan-storage";

export async function syncCookingPlan(id: string, progress?: Record<string, number>): Promise<MealPlan> {
  const response = await fetch(`/api/cooking/${encodeURIComponent(id)}`, {
    method: progress ? "PATCH" : "GET", cache: "no-store", signal: AbortSignal.timeout(10000),
    ...(progress ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ progress }) } : {}),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Account sync is unavailable. Your local progress is still saved.");
  const plan = parseCurrentPlan(JSON.stringify(body.plan));
  if (!plan || plan.id !== id) throw new Error("The account service returned a different plan.");
  return plan;
}
