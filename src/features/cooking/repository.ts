import type { MealPlan } from "../../types";
import { UpdateConflict, type Database } from "../community/database";
import { canCook, parseCurrentPlan } from "./plan-storage";
import { createSession } from "./session";

function planFromRow(row: Record<string, unknown>): MealPlan {
  const value = (input: unknown) => typeof input === "string" ? JSON.parse(input) : input;
  return parseCurrentPlan(JSON.stringify({
    id: row.id, userId: row.user_id, request: value(row.request), chosen: value(row.chosen),
    status: row.status, progress: value(row.progress), createdAt: new Date(String(row.created_at)).toISOString(),
  }))!;
}

/** A/C own inserting meal_plans. D updates only the authenticated owner's progress. */
export function createCookingRepository(db: Database) {
  async function get(id: string, userId: string): Promise<MealPlan | null> {
    const { rows } = await db.query(`SELECT id, user_id, request, chosen, status, progress, created_at
      FROM meal_plans WHERE id = $1 AND user_id = $2`, [id, userId]);
    return rows[0] ? planFromRow(rows[0]) : null;
  }
  return {
    get,
    async save(id: string, userId: string, patch: Record<string, number>): Promise<MealPlan | null> {
      const latest = await get(id, userId);
      if (!latest) return null;
      if (!canCook(latest)) throw new UpdateConflict("Finish shopping before saving cooking progress.");
      const recipes = new Map(latest.chosen.recipes.map((item) => [item.id, item]));
      for (const [recipeId, index] of Object.entries(patch)) {
        const recipe = recipes.get(recipeId);
        if (!recipe || !Number.isInteger(index) || index < 1 || index > recipe.steps.length + 1) {
          throw new UpdateConflict("The cooking steps no longer match this plan. Reload before saving.");
        }
      }
      const progress = { ...createSession(latest).progress, ...patch };
      const done = latest.chosen.recipes.every((item) => progress[item.id] > item.steps.length);
      const { rows } = await db.query(`UPDATE meal_plans SET progress = $3::jsonb, status = $4
        WHERE id = $1 AND user_id = $2 AND chosen = $5::jsonb AND progress = $6::jsonb
        AND status IN ('cooking','done')
        RETURNING id, user_id, request, chosen, status, progress, created_at`,
      [id, userId, JSON.stringify(progress), done ? "done" : "cooking", JSON.stringify(latest.chosen), JSON.stringify(latest.progress)]);
      if (!rows[0]) throw new UpdateConflict("This plan changed while saving. Reload before trying again.");
      return planFromRow(rows[0]);
    },
  };
}
export type CookingRepository = ReturnType<typeof createCookingRepository>;
