export type DietaryProfile = {
  dietary: string[];
  meatVegRatio: "more_meat" | "balanced" | "more_veg" | "vegetarian";
};

export function dietaryFieldErrors(profile: DietaryProfile): Record<string, string> {
  const selected = new Set(profile.dietary.map((item) => item.toLowerCase()));

  if (selected.has("vegetarian") && selected.has("vegan")) {
    return { dietary: "Vegan already covers vegetarian — choose one." };
  }

  if ((selected.has("vegetarian") || selected.has("vegan")) && profile.meatVegRatio !== "vegetarian") {
    return { meatVegRatio: "Choose Vegetarian meal balance for a vegetarian or vegan diet." };
  }

  return {};
}

const isVegDiet = (item: string) => ["vegetarian", "vegan"].includes(item.toLowerCase());

// Vegan already covers vegetarian, so picking one replaces the other; either one makes every meal vegetarian.
export function withDietary<T extends DietaryProfile>(profile: T, next: string[]): T {
  const added = next.find((item) => !profile.dietary.includes(item));
  const dietary = added && isVegDiet(added) ? next.filter((item) => item === added || !isVegDiet(item)) : next;
  const vegetarian = dietary.some(isVegDiet);
  const meatVegRatio = vegetarian ? "vegetarian" : profile.meatVegRatio === "vegetarian" ? "balanced" : profile.meatVegRatio;
  return { ...profile, dietary, meatVegRatio };
}

// Older profiles chose "vegetarian" as a meal balance; that is now expressed as a dietary need.
export function normalizeDietary<T extends DietaryProfile>(profile: T): T {
  const dietary = profile.meatVegRatio === "vegetarian" && !profile.dietary.some(isVegDiet) ? [...profile.dietary, "Vegetarian"] : profile.dietary;
  return withDietary({ ...profile, dietary }, dietary);
}
