/** Stable boundary shared by the catalog, planning, shopping, and cooking owners. */
export interface CandidateProduct {
  id: string;
  storeId: string;
  foodId: string | null;
  name: string;
  packageSizeG: number;
  packagePrice: number;
  pricePer100G: number;
}

export interface RecipeIngredient {
  productId: string | null;
  name: string;
  quantityG: number;
  pantry: boolean;
}

export interface RecipeStep {
  instruction: string;
  summary: string;
  durationSeconds: number | null;
}

export interface PlannedRecipe {
  id: string;
  title: string;
  mealSlots: string[];
  servings: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

export interface ShoppingListItem {
  productId: string;
  storeId: string;
  packages: number;
  checked: boolean;
}

export interface MealPlanResult {
  id: string;
  recipes: PlannedRecipe[];
  shoppingList: ShoppingListItem[];
  recipeCost: number;
  shoppingCost: number;
  costPerServing: number;
  currency: "CAD";
}
