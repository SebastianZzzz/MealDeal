import type { PantryItem, UserProfile } from "@/contracts";

const PROFILE_KEY = "mealdeal.profile";
const PANTRY_KEY = "mealdeal.pantry";

export const demoStore = {
  getProfile: () => JSON.parse(localStorage.getItem(PROFILE_KEY) || "null") as UserProfile | null,
  setProfile: (profile: UserProfile) => localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)),
  getPantry: () => JSON.parse(localStorage.getItem(PANTRY_KEY) || "[]") as PantryItem[],
  setPantry: (items: PantryItem[]) => localStorage.setItem(PANTRY_KEY, JSON.stringify(items)),
};
