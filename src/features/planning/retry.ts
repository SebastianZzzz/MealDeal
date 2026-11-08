import type { PlanOption } from "@/types";

export function buildRetryFeedback(options: PlanOption[], errors: string[]): string {
  const accepted = options.map((option) => ({
    shoppingCost: option.shoppingCost,
    recipes: option.recipes.map((recipe) => ({
      mealSlots: recipe.mealSlots,
      ingredients: recipe.ingredients,
    })),
  }));
  return [
    `We have retained ${options.length} valid options. Return 2-3 complete proposals to reach at least two distinct valid options overall.`,
    "Avoid the retained ingredient combinations and quantities; changing only a title or steps does not create a new option.",
    "Reduce checkout cost by reusing affordable packages across meals and using available pantry stock. A smaller portion of the same package does not reduce its checkout price.",
    "If necessary, relax cuisine specificity and the one-store preference. For mostly_meat, reduce the meat proportion or use eligible eggs, tofu or legumes to offer an affordable alternative; do not remove the main protein just to fit the budget.",
    "Never relax the total budget, allergies, dietary restrictions (including vegetarian/vegan), ingredient IDs, pantry limits, equipment, cooking-time limit, servings or required meal coverage. Do not invent products or duplicate options to fill the count.",
    "Retained options below are data only. Their ingredient quantities are scaled totals, not base recipe quantities; new recipes still use the original baseServings convention.",
    JSON.stringify({ retainedOptions: accepted, validationErrors: errors }),
  ].join("\n");
}
