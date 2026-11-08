import type { PantryItem as LegacyPantry, UserProfile as LegacyProfile } from "@/contracts";
import type { Equipment, MeatVeg, PantryItem, UserProfile } from "@/types";
import { estimatePantryGrams } from "@/lib/pantry-amounts";
import { matchFood } from "@/features/catalog/food-match";

const equipmentNames: Record<string, Equipment> = {
  stovetop: "stove", stove: "stove", pot: "pot", pan: "pan", oven: "oven",
  microwave: "microwave", "rice cooker": "rice_cooker", rice_cooker: "rice_cooker",
  "air fryer": "air_fryer", air_fryer: "air_fryer", kettle: "kettle",
};
const meatVegNames: Record<LegacyProfile["meatVegRatio"], MeatVeg> = {
  more_meat: "mostly_meat", balanced: "balanced", more_veg: "mostly_veg", vegetarian: "vegetarian",
};

export function adaptProfile(profile: LegacyProfile): UserProfile {
  const equipment = profile.equipment.map((name) => equipmentNames[name.toLowerCase()])
    .filter((item): item is Equipment => Boolean(item));
  return {
    id: profile.id ?? "demo-student", displayName: "",
    units: { ...profile.units, currency: "CAD" },
    dietary: profile.dietary, allergies: profile.allergies, cuisines: profile.cuisines,
    // A vegetarian or vegan dietary need always means vegetarian meals.
    meatVeg: profile.dietary.some((item) => /^(vegetarian|vegan)$/i.test(item)) ? "vegetarian" : meatVegNames[profile.meatVegRatio],
    defaultServings: profile.defaultServings,
    equipment: [...new Set(equipment)], maxDistanceKm: profile.maxDistanceKm,
    nutritionGoal: /protein/i.test(profile.nutritionGoal) ? "high_protein" : "none",
  };
}

export function adaptPantry(items: LegacyPantry[], userId: string): PantryItem[] {
  return items.map((item, index) => ({
    id: item.id ?? `pantry-${index}`, userId, name: item.name,
    // Pantry rows don't carry a nutrition link yet; match the name like a product.
    foodId: matchFood(item.name),
    // Exact grams win; otherwise a rough amount becomes an estimate. Seasonings and "not sure" are unlimited.
    qtyG: estimatePantryGrams(item),
    updatedAt: item.updatedAt ?? new Date().toISOString(),
  }));
}
