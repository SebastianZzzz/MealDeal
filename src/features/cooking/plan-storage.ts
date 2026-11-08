import { z } from "zod";
import type { MealPlan } from "../../types";

export const CURRENT_PLAN_KEY = "mealdeal.currentPlan";
type PlanStorage = Pick<Storage, "getItem" | "setItem">;
const nonNegative = z.number().finite().nonnegative();
const positive = z.number().finite().positive();
const nutrition = z.object({ kcal: nonNegative, proteinG: nonNegative, fatG: nonNegative, carbG: nonNegative });
const recipe = z.object({
  id: z.string().min(1), title: z.string().min(1), mealSlots: z.array(z.string()), servings: positive,
  totalMinutes: nonNegative, recipeCost: nonNegative, nutritionPerServing: nutrition.optional(),
  ingredients: z.array(z.object({ productId: z.string().optional(), pantryItemId: z.string().optional(), name: z.string(), qtyG: nonNegative })),
  steps: z.array(z.object({ index: z.number().int().positive(), summary: z.string(), detail: z.string(), timerSec: z.number().int().positive().optional() })).min(1),
}).refine((value) => value.steps.every((step, index) => step.index === index + 1), "Step indexes must start at 1 and be contiguous");
const planSchema = z.object({
  id: z.string().min(1), userId: z.string().min(1), createdAt: z.string(), status: z.enum(["shopping", "cooking", "done"]),
  progress: z.record(z.string(), z.number().int().positive()),
  request: z.object({
    budget: nonNegative, servings: z.number().int().positive(), duration: z.enum(["one_meal", "days"]),
    days: z.number().int().positive().optional(), mealsPerDay: z.number().int().positive().optional(),
    batchCook: z.boolean(), cuisines: z.array(z.string()), meatVeg: z.enum(["mostly_meat", "balanced", "mostly_veg", "vegetarian"]),
    maxCookMinutes: positive.optional(), note: z.string().optional(),
  }),
  chosen: z.object({
    id: z.string().min(1), title: z.string(), recipes: z.array(recipe).min(1),
    shoppingList: z.array(z.object({ productId: z.string(), storeId: z.string(), name: z.string(), packages: z.number().int().nonnegative(), packageSizeG: positive, packagePrice: nonNegative, lineTotal: nonNegative, bought: z.boolean() })),
    recipeCost: nonNegative, shoppingCost: nonNegative, costPerServing: nonNegative, withinBudget: z.boolean(),
    leftovers: z.array(z.object({ name: z.string(), productId: z.string(), qtyG: nonNegative })), nutritionTotal: nutrition.optional(),
  }).refine((value) => new Set(value.recipes.map((item) => item.id)).size === value.recipes.length, "Recipe IDs must be unique"),
});

/** Validate only, then retain the original object so C's additive metadata survives. */
export function parseCurrentPlan(raw: string | null): MealPlan | null {
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!planSchema.safeParse(value).success) throw new Error("This saved plan is invalid. Please choose a meal plan again.");
  return value as MealPlan;
}

export function canCook(plan: MealPlan): boolean {
  return plan.status !== "shopping" && plan.chosen.shoppingList.every((item) => item.bought);
}

/** Re-read C's latest plan and merge only D's progress/status, never the shopping list. */
export function saveCurrentProgress(storage: PlanStorage, original: MealPlan, progress: Record<string, number>): MealPlan {
  const latest = parseCurrentPlan(storage.getItem(CURRENT_PLAN_KEY));
  if (!latest || latest.id !== original.id || latest.userId !== original.userId || latest.chosen.id !== original.chosen.id
    || JSON.stringify(latest.chosen.recipes) !== JSON.stringify(original.chosen.recipes) || !canCook(latest)) {
    throw new Error("Your selected meal plan changed. Reopen cooking from your shopping list.");
  }
  for (const item of latest.chosen.recipes) {
    const index = progress[item.id];
    if (!Number.isInteger(index) || index < 1 || index > item.steps.length + 1) throw new Error("Invalid cooking progress.");
  }
  const done = latest.chosen.recipes.every((item) => progress[item.id] > item.steps.length);
  const next: MealPlan = { ...latest, progress: { ...latest.progress, ...progress }, status: done ? "done" : "cooking" };
  storage.setItem(CURRENT_PLAN_KEY, JSON.stringify(next));
  return next;
}
