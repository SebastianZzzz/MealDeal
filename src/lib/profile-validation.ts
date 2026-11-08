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
