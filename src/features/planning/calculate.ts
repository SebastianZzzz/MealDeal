import type { Food, Nutrition, PantryItem, PlanOption, PlanRequest, Product, Recipe } from "@/types";
import type { DraftOption, DraftRecipe } from "./schema";
import { getMealSlots } from "./slots";

export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sumNutrition(total: Nutrition, food: Food, grams: number): void {
  total.kcal += food.kcal * grams / 100;
  total.proteinG += food.proteinG * grams / 100;
  total.fatG += food.fatG * grams / 100;
  total.carbG += food.carbG * grams / 100;
}

function roundedNutrition(total: Nutrition, divisor = 1): Nutrition {
  return {
    kcal: money(total.kcal / divisor), proteinG: money(total.proteinG / divisor),
    fatG: money(total.fatG / divisor), carbG: money(total.carbG / divisor),
  };
}

function scaleRecipe(draft: DraftRecipe, request: PlanRequest, id: string): Recipe {
  const servings = request.servings * draft.mealSlots.length;
  const factor = servings / draft.baseServings;
  // Batch duration grows more slowly than ingredient mass. This is an estimate, not a timer start.
  const timeFactor = factor > 1 ? Math.min(2, factor ** 0.2) : 1;
  return {
    id, title: draft.title, mealSlots: draft.mealSlots, servings,
    ingredients: draft.ingredients.map((item) => ({
      name: item.name, qtyG: Math.round(item.qtyG * factor * 1000) / 1000,
      ...(item.productId ? { productId: item.productId } : { pantryItemId: item.pantryItemId! }),
    })),
    steps: draft.steps.map((step, index) => ({
      index: index + 1, summary: step.summary, detail: step.detail,
      ...(step.timerSec ? { timerSec: Math.ceil(step.timerSec * timeFactor) } : {}),
    })),
    totalMinutes: Math.ceil(draft.totalMinutes * timeFactor), recipeCost: 0,
  };
}

function validateSlots(draft: DraftOption, request: PlanRequest): void {
  const expected = new Set(getMealSlots(request));
  const covered = new Set<string>();
  for (const recipe of draft.recipes) {
    if (new Set(recipe.mealSlots).size !== recipe.mealSlots.length) {
      throw new Error("A recipe repeats a meal slot.");
    }
    if (!request.batchCook && recipe.mealSlots.length > 1) {
      throw new Error("Batch cooking is disabled.");
    }
    for (const slot of recipe.mealSlots) {
      if (!expected.has(slot)) {
        throw new Error("A recipe references a meal outside the requested plan.");
      }
      covered.add(slot);
    }
  }
  if (covered.size !== expected.size) {
    throw new Error("The option does not cover every requested meal.");
  }
}

export interface CalculatedOption { option: PlanOption; missingNutrition: string[] }

export function calculateOption(draft: DraftOption, request: PlanRequest, products: Product[], pantry: PantryItem[], foods: Food[], id: string): CalculatedOption {
  validateSlots(draft, request);
  const productMap = new Map(products.map((product) => [product.id, product]));
  const pantryMap = new Map(pantry.map((item) => [item.id, item]));
  const foodMap = new Map(foods.map((food) => [food.id, food]));
  const required = new Map<string, number>();
  const pantryUsed = new Map<string, number>();
  const missing = new Set<string>();
  const nutrition: Nutrition = { kcal: 0, proteinG: 0, fatG: 0, carbG: 0 };
  let hasNutrition = false;
  const recipes = draft.recipes.map((recipe, index) => scaleRecipe(recipe, request, `${id}-recipe-${index + 1}`));
  for (const recipe of recipes) {
    if (request.maxCookMinutes && recipe.totalMinutes > request.maxCookMinutes) {
      throw new Error("The scaled cooking time exceeds the requested limit.");
    }
    const recipeNutrition: Nutrition = { kcal: 0, proteinG: 0, fatG: 0, carbG: 0 };
    let hasRecipeNutrition = false;
    let recipeCost = 0;
    for (const ingredient of recipe.ingredients) {
      if (ingredient.qtyG <= 0) {
        throw new Error("Scaled ingredient quantities must be positive.");
      }
      const product = ingredient.productId ? productMap.get(ingredient.productId) : undefined;
      const pantryItem = ingredient.pantryItemId ? pantryMap.get(ingredient.pantryItemId) : undefined;
      if (!product && !pantryItem) {
        throw new Error("A recipe references an unknown or filtered ingredient.");
      }
      // Display canonical names, never a model-supplied label for a different product.
      ingredient.name = product?.name ?? pantryItem!.name;
      if (product) {
        required.set(product.id, (required.get(product.id) ?? 0) + ingredient.qtyG);
        recipeCost += ingredient.qtyG * product.packagePrice / product.packageSizeG;
      }
      if (pantryItem) {
        const used = (pantryUsed.get(pantryItem.id) ?? 0) + ingredient.qtyG;
        pantryUsed.set(pantryItem.id, used);
        if (pantryItem.qtyG !== undefined && used > pantryItem.qtyG + 0.001) {
          throw new Error(`Not enough pantry stock: ${pantryItem.name}.`);
        }
      }
      const foodId = product?.foodId ?? pantryItem?.foodId;
      const food = foodId ? foodMap.get(foodId) : undefined;
      if (food) {
        sumNutrition(recipeNutrition, food, ingredient.qtyG);
        sumNutrition(nutrition, food, ingredient.qtyG);
        hasNutrition = true;
        hasRecipeNutrition = true;
      } else {
        missing.add(ingredient.name);
      }
    }
    recipe.recipeCost = money(recipeCost);
    if (hasRecipeNutrition) {
      recipe.nutritionPerServing = roundedNutrition(recipeNutrition, recipe.servings);
    }
  }
  const shoppingList: PlanOption["shoppingList"] = [];
  const leftovers: PlanOption["leftovers"] = [];
  for (const [productId, grams] of required) {
    const product = productMap.get(productId)!;
    const packages = Math.ceil((grams - 0.000001) / product.packageSizeG);
    shoppingList.push({
      productId, storeId: product.storeId, name: product.name, packages,
      packageSizeG: product.packageSizeG, packagePrice: product.packagePrice,
      lineTotal: money(packages * product.packagePrice), bought: false,
    });
    const remaining = product.packageSizeG * packages - grams;
    if (remaining > 0.001) {
      leftovers.push({ productId, name: product.name, qtyG: Math.round(remaining * 1000) / 1000 });
    }
  }
  const recipeCost = money(recipes.reduce((total, recipe) => total + recipe.recipeCost, 0));
  const shoppingCost = money(shoppingList.reduce((total, item) => total + item.lineTotal, 0));
  return {
    option: {
      id, title: draft.title, recipes, shoppingList, recipeCost, shoppingCost,
      // Multiple dishes at the same meal do not create additional person-meals.
      costPerServing: money(recipeCost / (request.servings * getMealSlots(request).length)),
      leftovers, withinBudget: Math.round(shoppingCost * 100) <= Math.round(request.budget * 100),
      ...(hasNutrition ? { nutritionTotal: roundedNutrition(nutrition) } : {}),
    },
    missingNutrition: [...missing],
  };
}
