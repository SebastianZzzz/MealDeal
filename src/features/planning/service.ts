import { randomUUID } from "node:crypto";
import type { Food } from "@/types";
import type { PlanningResponse } from "@/contracts/planning-api";
import { calculateOption } from "./calculate";
import { loadCatalog, type Catalog } from "./catalog";
import { createDemoOptions } from "./demo";
import { filterPantry, filterProducts } from "./filter";
import { generateWithGemini, PlanningModelError } from "./gemini";
import { draftOptionSchema, type PlanningInput } from "./schema";
import { loadProductDeals } from "./deal-client";
import { preferRealDeals } from "./deals";
import { comparePlanOptions } from "./rank-options";
import { buildRetryFeedback } from "./retry";

const MAX_GENERATION_ATTEMPTS = 3;

export class PlanningError extends Error {
  constructor(message: string, public readonly status = 422) {
    super(message);
  }
}

function optionSignature(option: PlanningResponse["options"][number]): string {
  const recipes = option.recipes.map((recipe) => ({
    slots: [...recipe.mealSlots].sort(),
    ingredients: recipe.ingredients.map((item) => `${item.productId ?? item.pantryItemId}:${item.qtyG}`).sort(),
  }));
  return JSON.stringify(recipes.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

export async function generatePlan(input: PlanningInput, catalogSnapshot?: Catalog): Promise<PlanningResponse> {
  const catalog = catalogSnapshot ?? await loadCatalog();
  const profile = { ...input.profile, meatVeg: input.request.meatVeg };
  // A request can make a vegetarian profile stricter, never silently relax it.
  if (input.profile.meatVeg === "vegetarian") {
    profile.meatVeg = "vegetarian";
  }
  let candidates = filterProducts(catalog.products, catalog.stores, profile);
  // We only have prices for a few stores so far. If none are inside the student's range, plan with the
  // nearest ones we have and say so, rather than failing.
  const outsideRange = Boolean(profile.home) && candidates.length === 0;
  if (outsideRange) candidates = filterProducts(catalog.products, catalog.stores, { ...profile, home: undefined });
  const products = preferRealDeals(candidates, await loadProductDeals(candidates));
  const pantry = filterPantry(input.pantry, profile);
  if (!products.length && !pantry.some((item) => item.qtyG === undefined || item.qtyG > 0)) {
    throw new PlanningError("No eligible products are available. Check your shopping range, restrictions and price dates.");
  }
  const mode = process.env.GEMINI_API_KEY ? "gemini" : "demo";
  if (mode === "demo" && process.env.NEXT_PUBLIC_DEMO_MODE === "0") {
    throw new PlanningError("Configure GEMINI_API_KEY to generate meal plans.", 503);
  }
  const warnings: string[] = [];
  if (mode === "demo") {
    warnings.push("Demo mode: example recipes shown in English. Cuisine preferences and special requests are not applied in this preview.");
  }
  if (catalog.isSample) {
    warnings.push("Sample stores and prices for development; these are not verified current offers.");
  }
  if (!profile.home) {
    warnings.push("No shopping area is saved. Using stores near UBC; add your location in your kitchen settings.");
  } else if (outsideRange) {
    warnings.push(`No stores with prices are within ${profile.maxDistanceKm} km of you yet, so these plans use the nearest stores we have.`);
  }
  if (profile.allergies.length || profile.dietary.length) {
    warnings.push("Restrictions are filtered by product names. Check ingredient labels and certification before purchasing.");
  }
  if (catalog.products.some((product) => product.packageUnit !== "g")) {
    warnings.push("Products sold in ml or pieces are excluded until a gram-weight mapping is available.");
  }
  const requestId = randomUUID();
  const options: PlanningResponse["options"] = [];
  const missingNutrition: Record<string, string[]> = {};
  const signatures = new Set<string>();
  // Share the time budget and unavailable-model list across any corrective retry.
  const generationContext = { deadline: Date.now() + 50000, unavailableModels: new Set<string>() };
  let feedback = "";
  const maxAttempts = mode === "gemini" ? MAX_GENERATION_ATTEMPTS : 1;
  const foodMap = new Map(catalog.foods.map((food) => [food.id, food]));
  let noteIgnored = false;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (mode === "gemini" && Date.now() >= generationContext.deadline) {
      break;
    }
    let drafts: unknown[];
    try {
      if (mode === "gemini") {
        const generated = await generateWithGemini(input.request, profile, withNutrition(pantry, foodMap), withNutrition(products, foodMap), feedback, generationContext);
        drafts = generated.options;
        noteIgnored ||= generated.noteIgnored;
      } else {
        drafts = createDemoOptions(input.request, profile, products, pantry);
      }
    } catch (error) {
      if (error instanceof PlanningModelError) {
        if (options.length) {
          break;
        }
        throw new PlanningError("The recipe service is unavailable right now. Please try again later.", 502);
      }
      if (attempt + 1 < maxAttempts) {
        feedback = buildRetryFeedback(options, ["Return valid structured JSON with complete, affordable options."]);
        continue;
      }
      if (options.length) {
        break;
      }
      throw new PlanningError("The recipe service could not return valid plans. Please try again.", 502);
    }
    const errors: string[] = [];
    for (const [index, draft] of drafts.entries()) {
      try {
        const parsed = draftOptionSchema.parse(draft);
        const result = calculateOption(parsed, input.request, products, pantry, catalog.foods, `${requestId}-${attempt + 1}-${index + 1}`);
        if (!result.option.withinBudget) {
          errors.push(`Shopping cost ${result.option.shoppingCost} exceeds budget ${input.request.budget}.`);
          continue;
        }
        const signature = optionSignature(result.option);
        if (signatures.has(signature)) {
          errors.push("Options must contain distinct ingredient combinations or quantities.");
          continue;
        }
        signatures.add(signature);
        options.push(result.option);
        missingNutrition[result.option.id] = result.missingNutrition;
      } catch (error) {
        errors.push(error instanceof Error ? error.message.slice(0, 500) : "Invalid option.");
      }
    }
    if (options.length >= 2) {
      break;
    }
    feedback = buildRetryFeedback(options, errors);
  }
  if (!options.length) {
    throw new PlanningError("No complete plan fits these constraints. Try a larger total budget, fewer meals, more cooking time or different equipment. No items have been added to your shopping list.");
  }
  if (options.length < 2) {
    warnings.push("Only one complete option was found within the budget, restrictions and generation limits. Try again for more choices.");
  }
  if (noteIgnored) {
    // Fixed text: never echo the model's or the student's words back as a notice.
    warnings.push("Part of your note wasn't about these meals, so we left it out.");
  }
  options.sort(comparePlanOptions);
  return { requestId, options: options.slice(0, 3), meta: { mode, isSample: catalog.isSample, stores: catalog.stores, products, missingNutrition, warnings } };
}

// Gemini gets per-100 g nutrition as a hint for portion sizes; reported nutrition is always computed by code.
function withNutrition<T extends { foodId?: string }>(items: T[], foods: Map<string, Food>): T[] {
  return items.map((item) => {
    const food = item.foodId ? foods.get(item.foodId) : undefined;
    return food ? { ...item, nutritionPer100: { kcal: food.kcal, proteinG: food.proteinG, fatG: food.fatG, carbG: food.carbG } } : item;
  });
}
