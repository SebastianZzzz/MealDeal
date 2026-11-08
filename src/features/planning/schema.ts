import { z } from "zod";

export const planRequestSchema = z.object({
  budget: z.number().finite().min(0).max(10000),
  servings: z.number().int().min(1).max(20),
  duration: z.enum(["one_meal", "days"]),
  days: z.number().int().min(1).max(7).optional(),
  mealsPerDay: z.number().int().min(1).max(3).optional(),
  batchCook: z.boolean(),
  cuisines: z.array(z.string().trim().max(60)).max(10),
  meatVeg: z.enum(["mostly_meat", "balanced", "mostly_veg", "vegetarian"]),
  maxCookMinutes: z.number().int().min(1).max(240).optional(),
  note: z.string().trim().max(1000).optional(),
}).refine((value) => value.duration !== "days" || value.days !== undefined, {
  message: "Choose the number of days.", path: ["days"],
});

export const profileSchema = z.object({
  id: z.string().max(200),
  displayName: z.string().max(100),
  units: z.object({
    lang: z.enum(["en", "zh", "ko", "ja", "es", "fr"]),
    weight: z.enum(["g", "kg", "lb", "oz", "jin"]),
    volume: z.enum(["ml", "l", "cup", "fl_oz"]),
    currency: z.literal("CAD"),
  }),
  dietary: z.array(z.string().trim().min(1).max(80)).max(20),
  allergies: z.array(z.string().trim().min(1).max(80)).max(20),
  cuisines: z.array(z.string().max(80)).max(20),
  meatVeg: z.enum(["mostly_meat", "balanced", "mostly_veg", "vegetarian"]),
  defaultServings: z.number().int().min(1).max(20),
  equipment: z.array(z.enum(["stove", "pot", "pan", "rice_cooker", "microwave", "oven", "air_fryer", "kettle"])).max(8),
  maxDistanceKm: z.number().min(0.1).max(50),
  home: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  nutritionGoal: z.enum(["none", "high_protein", "low_calorie", "balanced"]).optional(),
});

export const pantrySchema = z.array(z.object({
  id: z.string().min(1).max(200), userId: z.string().max(200),
  name: z.string().trim().min(1).max(100), foodId: z.string().max(200).optional(),
  qtyG: z.number().finite().min(0).max(100000).optional(), updatedAt: z.string().max(80),
})).max(100);

export const planInputSchema = z.object({
  request: planRequestSchema,
  profile: profileSchema,
  pantry: pantrySchema,
}).refine((value) => new Set(value.pantry.map((item) => item.id)).size === value.pantry.length, {
  message: "Pantry IDs must be unique.", path: ["pantry"],
});

const ingredientSchema = z.object({
  productId: z.string().min(1).max(200).nullable(),
  pantryItemId: z.string().min(1).max(200).nullable(),
  name: z.string().min(1).max(120),
  qtyG: z.number().finite().positive().max(100000),
}).refine((item) => Boolean(item.productId) !== Boolean(item.pantryItemId), {
  message: "An ingredient must reference exactly one product or pantry item.",
});

export const draftRecipeSchema = z.object({
  title: z.string().min(1).max(160),
  mealSlots: z.array(z.string().min(1).max(40)).min(1).max(21),
  baseServings: z.number().int().min(1).max(20),
  ingredients: z.array(ingredientSchema).min(1).max(30),
  steps: z.array(z.object({
    summary: z.string().min(1).max(180), detail: z.string().min(1).max(2000),
    timerSec: z.number().int().positive().max(14400).nullable(),
  })).min(1).max(20),
  totalMinutes: z.number().positive().max(240),
});

export const draftOptionSchema = z.object({
  title: z.string().min(1).max(160), recipes: z.array(draftRecipeSchema).min(1).max(42),
});
export const draftResponseSchema = z.object({ options: z.array(z.unknown()).min(1).max(3) });
export type DraftRecipe = z.infer<typeof draftRecipeSchema>;
export type DraftOption = z.infer<typeof draftOptionSchema>;
export type PlanningInput = z.infer<typeof planInputSchema>;
