import type { PlanResponse, Product, Store } from "@/types";

// Additive transport metadata keeps the team's v2 PlanResponse unchanged.
export interface PlanningResponse extends PlanResponse {
  meta: {
    mode: "demo" | "gemini";
    isSample: boolean;
    stores: Store[];
    products: Product[];
    missingNutrition: Record<string, string[]>;
    warnings: string[];
  };
}
