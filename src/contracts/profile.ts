import type { PantryAmount, PantryKind } from "@/lib/pantry-amounts";

export type Language = "en" | "zh";
export type WeightUnit = "g" | "kg" | "lb" | "oz" | "jin";
export type VolumeUnit = "ml" | "l" | "cup" | "fl_oz";

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
  home?: { lat: number; lng: number } | null; // shopping area, rounded to about 100 m
  nutritionGoal: string;
  onboardingComplete: boolean;
}

export interface PantryItem {
  id?: string;
  name: string;
  foodId?: string | null;
  qtyG: number; // exact grams; 0 = not measured, use `amount`
  kind?: PantryKind; // seasonings only need "have it"
  amount?: PantryAmount; // rough amount for ingredients, defaults to "unknown"
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
