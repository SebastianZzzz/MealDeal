import type { UserProfile } from "@/contracts";

export function fromProfileRow(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    auth0Id: String(row.auth0_id),
    role: row.role as UserProfile["role"],
    lang: row.lang as UserProfile["lang"],
    units: row.units as UserProfile["units"],
    dietary: (row.dietary as string[]) ?? [],
    allergies: (row.allergies as string[]) ?? [],
    cuisines: (row.cuisines as string[]) ?? [],
    meatVegRatio: row.meat_veg_ratio as UserProfile["meatVegRatio"],
    defaultServings: Number(row.default_servings),
    equipment: (row.equipment as string[]) ?? [],
    maxDistanceKm: Number(row.max_distance_km),
    nutritionGoal: String(row.nutrition_goal ?? ""),
    onboardingComplete: Boolean(row.onboarding_complete),
  };
}

export function toProfileRow(profile: UserProfile, auth0Id: string) {
  return {
    auth0_id: auth0Id,
    role: profile.role,
    lang: profile.lang,
    units: profile.units,
    dietary: profile.dietary,
    allergies: profile.allergies,
    cuisines: profile.cuisines,
    meat_veg_ratio: profile.meatVegRatio,
    default_servings: profile.defaultServings,
    equipment: profile.equipment,
    max_distance_km: profile.maxDistanceKm,
    nutrition_goal: profile.nutritionGoal,
    onboarding_complete: profile.onboardingComplete,
    updated_at: new Date().toISOString(),
  };
}
