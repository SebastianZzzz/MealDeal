// MealDeal shared types — the contract between A, B, C and D.
// Rule: everything is stored in grams (or ml / pieces). Display units are converted by code, never by Gemini.

// ---------- Units & language (A) ----------

export type Lang = "en" | "zh" | "ko" | "ja" | "es" | "fr";
export type WeightUnit = "g" | "kg" | "lb" | "oz" | "jin";
export type VolumeUnit = "ml" | "l" | "cup" | "fl_oz";

export interface UnitPrefs {
  lang: Lang;
  weight: WeightUnit;
  volume: VolumeUnit;
  currency: "CAD";
}

// Hard-coded conversion: grams per unit. Used by every page that shows a quantity.
export const GRAMS_PER: Record<WeightUnit, number> = {
  g: 1,
  kg: 1000,
  lb: 453.592,
  oz: 28.3495,
  jin: 500,
};
export const ML_PER: Record<VolumeUnit, number> = {
  ml: 1,
  l: 1000,
  cup: 240,
  fl_oz: 29.5735,
};

// ---------- User profile (A) ----------

export type Equipment =
  | "stove"
  | "pot"
  | "pan"
  | "rice_cooker"
  | "microwave"
  | "oven"
  | "air_fryer"
  | "kettle";

export type MeatVeg = "mostly_meat" | "balanced" | "mostly_veg" | "vegetarian";

export interface UserProfile {
  id: string; // Supabase Auth user id
  displayName: string;
  units: UnitPrefs;
  dietary: string[]; // e.g. ["halal", "no_pork"]
  allergies: string[]; // e.g. ["peanut", "shellfish"]
  cuisines: string[]; // e.g. ["chinese", "korean"]
  meatVeg: MeatVeg;
  defaultServings: number;
  equipment: Equipment[];
  maxDistanceKm: number;
  home?: { lat: number; lng: number };
  nutritionGoal?: "none" | "high_protein" | "low_calorie" | "balanced";
}

export interface PantryItem {
  id: string;
  userId: string;
  name: string; // free text, e.g. "rice", "soy sauce"
  foodId?: string;
  qtyG?: number; // optional: staples like salt can be "have it" without a quantity
  updatedAt: string; // ISO
}

// ---------- Stores & products (B) ----------

export interface Store {
  id: string;
  name: string; // "Save-On-Foods Dunbar"
  chain: string; // "Save-On-Foods"
  address: string;
  lat: number;
  lng: number;
}

export interface Product {
  id: string;
  storeId: string;
  foodId?: string; // link to nutrition
  name: string; // "Jasmine Rice"
  brand?: string;
  packageSizeG: number; // grams (or ml, or pieces when packageUnit = "piece")
  packageUnit: "g" | "ml" | "piece";
  packagePrice: number; // CAD, what you pay at checkout for one package
  pricePer100: number; // CAD per 100 g / 100 ml / 1 piece — computed by code
  isSale: boolean;
  validUntil?: string; // ISO date
  source: "flyer" | "report";
  imageUrl?: string;
  confidence: number; // 0–1, from extraction
  reportedBy?: string;
  reportedAt: string; // ISO
  category?: "grain" | "protein" | "vegetable" | "fruit" | "dairy" | "sauce" | "ready_meal" | "other";
}

// What Gemini returns from a price-tag or flyer image, BEFORE the user confirms.
export interface ExtractedPrice {
  name: string;
  brand?: string;
  sizeText: string; // as printed, e.g. "1.5 kg", "per lb"
  priceText: string; // as printed, e.g. "$2.99/lb", "2 for $5"
  packageSizeG?: number; // parsed by code from sizeText
  packagePrice?: number; // parsed by code from priceText
  isSale: boolean;
  confidence: number;
}

export interface PriceTagResult {
  items: ExtractedPrice[];
  nearbyStores: Store[]; // sorted by distance; first one pre-selected
  date: string; // today by default, ISO
}

// ---------- Nutrition ----------

export interface Food {
  id: string;
  name: string;
  kcal: number; // per 100 g
  proteinG: number;
  fatG: number;
  carbG: number;
  dbRef?: string; // USDA / CNF id
}

export interface Nutrition {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
}

// ---------- Meal planning (C) ----------

export interface PlanRequest {
  budget: number; // CAD
  servings: number; // people per meal
  duration: "one_meal" | "days";
  days?: number; // when duration = "days"
  mealsPerDay?: number; // default 1
  batchCook: boolean; // cook once, eat several meals
  cuisines: string[];
  meatVeg: MeatVeg;
  maxCookMinutes?: number;
  note?: string; // free text, e.g. "want something spicy"
}

export interface RecipeIngredient {
  productId?: string; // set when it must be bought
  pantryItemId?: string; // set when the user already has it
  name: string;
  qtyG: number;
}

export interface RecipeStep {
  index: number; // 1-based
  summary: string; // one line, shown when collapsed
  detail: string;
  timerSec?: number; // estimated; only for timed steps
}

export interface Recipe {
  id: string;
  title: string;
  mealSlots: string[]; // which meals it covers, e.g. ["day1-dinner", "day2-lunch"]
  servings: number; // total portions this recipe makes
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  totalMinutes: number;
  recipeCost: number; // computed by code
  nutritionPerServing?: Nutrition;
}

export interface ShoppingItem {
  productId: string;
  storeId: string;
  name: string;
  packages: number; // how many packages to buy
  packageSizeG: number;
  packagePrice: number;
  lineTotal: number;
  bought: boolean;
}

export interface Leftover {
  name: string;
  productId: string;
  qtyG: number;
}

export interface PlanOption {
  id: string;
  title: string; // e.g. "Chicken & rice week"
  recipes: Recipe[];
  shoppingList: ShoppingItem[];
  recipeCost: number; // cost of what is eaten
  shoppingCost: number; // what you pay today — compared against budget
  costPerServing: number;
  leftovers: Leftover[];
  nutritionTotal?: Nutrition;
  withinBudget: boolean;
}

export interface PlanResponse {
  requestId: string;
  options: PlanOption[]; // 2–3
}

export type PlanStatus = "shopping" | "cooking" | "done";

export interface MealPlan {
  id: string;
  userId: string;
  request: PlanRequest;
  chosen: PlanOption;
  status: PlanStatus;
  // cooking progress (D): recipeId -> index of the step currently open
  progress: Record<string, number>;
  createdAt: string;
}

// ---------- Food Support (D) ----------

export interface FoodResource {
  id: string;
  name: string;
  type: "food_bank" | "low_cost_market" | "community_fridge" | "free_meal" | "other";
  address: string;
  lat?: number;
  lng?: number;
  hours: string; // human-readable
  eligibility: string;
  sourceUrl: string;
  verifiedAt: string; // ISO date
  fromLiveSearch?: boolean;
}

// ---------- Eat Out, simplified (D) ----------
// No merchant accounts: merchant info lives on the listing. Reserve = atomic qty_left - 1 where qty_left > 0.

export interface SurplusListing {
  id: string;
  merchantName: string;
  address: string;
  lat: number;
  lng: number;
  title: string;
  origPrice: number;
  price: number;
  qtyLeft: number;
  pickupStart: string; // ISO
  pickupEnd: string; // ISO
  allergens: string[];
  description?: string;
  isSample: boolean; // shown as "sample data" in the UI
  createdAt: string;
}
