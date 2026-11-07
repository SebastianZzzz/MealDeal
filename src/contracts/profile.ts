export type Language = "en" | "zh";
export type WeightUnit = "g" | "kg" | "lb" | "jin";
export type VolumeUnit = "ml" | "l" | "cup";

export interface UnitPreferences {
  lang: Language;
  weight: WeightUnit;
  volume: VolumeUnit;
}

export interface UserProfile {
  id?: string;
  auth0Id?: string;
  role: "student" | "merchant";
  lang: Language;
  units: UnitPreferences;
  dietary: string[];
  allergies: string[];
  cuisines: string[];
  meatVegRatio: "more_meat" | "balanced" | "more_veg" | "vegetarian";
  defaultServings: number;
  equipment: string[];
  maxDistanceKm: number;
  nutritionGoal: string;
  onboardingComplete: boolean;
}

export interface PantryItem {
  id?: string;
  name: string;
  foodId?: string | null;
  qtyG: number;
  updatedAt?: string;
}

export const defaultProfile: UserProfile = {
  role: "student",
  lang: "en",
  units: { lang: "en", weight: "lb", volume: "cup" },
  dietary: [],
  allergies: [],
  cuisines: [],
  meatVegRatio: "balanced",
  defaultServings: 1,
  equipment: ["Stovetop", "Pot"],
  maxDistanceKm: 3,
  nutritionGoal: "",
  onboardingComplete: false,
};
