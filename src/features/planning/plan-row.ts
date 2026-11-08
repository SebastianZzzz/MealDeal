import type { MealPlan } from "@/types";

export const PLAN_COLUMNS = "id, request, chosen, status, progress, created_at";

// A meal_plans row as the MealPlan contract. userId is the Auth0 id the client already knows.
export function planFromRow(row: Record<string, unknown>, auth0Id: string): MealPlan {
  const json = (value: unknown) => (typeof value === "string" ? JSON.parse(value) : value);
  const created = row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at));
  return {
    id: String(row.id), userId: auth0Id, request: json(row.request), chosen: json(row.chosen),
    status: row.status as MealPlan["status"], progress: json(row.progress) ?? {}, createdAt: created.toISOString(),
  };
}
