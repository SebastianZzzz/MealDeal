import type { PantryItem as LegacyPantry, UserProfile as LegacyProfile } from "@/contracts";
import type { Equipment, MeatVeg, PantryItem, UserProfile } from "@/types";

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
    meatVeg: meatVegNames[profile.meatVegRatio], defaultServings: profile.defaultServings,
    equipment: [...new Set(equipment)], maxDistanceKm: profile.maxDistanceKm,
    nutritionGoal: /protein/i.test(profile.nutritionGoal) ? "high_protein" : "none",
  };
}

export function adaptPantry(items: LegacyPantry[], userId: string): PantryItem[] {
  return items.map((item, index) => ({
    id: item.id ?? `pantry-${index}`, userId, name: item.name,
    foodId: item.foodId ?? undefined,
    // A's first scaffold encodes an unknown amount as zero. Do not claim it is unlimited.
    qtyG: item.qtyG,
    updatedAt: item.updatedAt ?? new Date().toISOString(),
  }));
}
