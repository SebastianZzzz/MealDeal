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
    home: row.home_lat != null && row.home_lng != null ? { lat: Number(row.home_lat), lng: Number(row.home_lng) } : null,
    nutritionGoal: String(row.nutrition_goal ?? ""),
    onboardingComplete: Boolean(row.onboarding_complete),
  };
}
