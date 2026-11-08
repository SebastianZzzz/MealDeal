import type { MealPlan } from "../../types";
import { UpdateConflict, type Database } from "../community/database";
import { canCook, parseCurrentPlan } from "./plan-storage";
import { createSession } from "./session";

function planFromRow(row: Record<string, unknown>): MealPlan {
  const value = (input: unknown) => typeof input === "string" ? JSON.parse(input) : input;
  return parseCurrentPlan(JSON.stringify({
    id: row.id, userId: row.user_id, request: value(row.request), chosen: value(row.chosen),
    status: row.status, progress: value(row.progress),
    createdAt: new Date(row.created_at instanceof Date ? row.created_at.getTime() : String(row.created_at)).toISOString(),
  }))!;
}

/** A/C own inserting meal_plans. D updates only the authenticated owner's progress. */
export function createCookingRepository(db: Database) {
  async function get(id: string, auth0Id: string): Promise<MealPlan | null> {
    const { rows } = await db.query(`SELECT p.id, p.user_id, p.request, p.chosen, p.status, p.progress, p.created_at
      FROM meal_plans p JOIN users u ON u.id = p.user_id
      WHERE p.id = $1 AND u.auth0_id = $2`, [id, auth0Id]);
    return rows[0] ? planFromRow(rows[0]) : null;
  }
  return {
    get,
    async save(id: string, auth0Id: string, patch: Record<string, number>): Promise<MealPlan | null> {
      const latest = await get(id, auth0Id);
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
      const { rows } = await db.query(`UPDATE meal_plans p SET progress = $3::jsonb, status = $4, updated_at = clock_timestamp()
        FROM users u WHERE p.id = $1 AND p.user_id = u.id AND u.auth0_id = $2
        AND p.chosen = $5::jsonb AND p.progress = $6::jsonb AND p.status = $7
        RETURNING p.id, p.user_id, p.request, p.chosen, p.status, p.progress, p.created_at`,
      [id, auth0Id, JSON.stringify(progress), done ? "done" : "cooking", JSON.stringify(latest.chosen), JSON.stringify(latest.progress), latest.status]);
      if (!rows[0]) throw new UpdateConflict("This plan changed while saving. Reload before trying again.");
      return planFromRow(rows[0]);
    },
  };
}
export type CookingRepository = ReturnType<typeof createCookingRepository>;
