"use client";

import type { MealPlan, PlanRequest, UnitPrefs } from "@/types";
import type { PlanningResponse } from "@/contracts/planning-api";

const OPTIONS_KEY = "mealdeal.planning.options.v2";
const SELECTED_KEY = "mealdeal.plan.v2";

export interface SavedOptions { request: PlanRequest; response: PlanningResponse; units: UnitPrefs }

function readSaved<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

// This browser boundary is shared with D. A can replace persistence during cloud integration.
export const mealPlanStore = {
  getOptions(): SavedOptions | null {
    return readSaved<SavedOptions>(OPTIONS_KEY);
  },
  setOptions(value: SavedOptions): void {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(value));
  },
  getSelected(): MealPlan | null {
    return readSaved<MealPlan>(SELECTED_KEY);
  },
  setSelected(plan: MealPlan): void {
    localStorage.setItem(SELECTED_KEY, JSON.stringify(plan));
  },
};
