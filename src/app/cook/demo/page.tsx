import type { Metadata } from "next";
import { CookingGuide } from "@/features/cooking/cooking-guide";
import { demoMealPlan } from "@/features/cooking/mock-plan";

export const metadata: Metadata = { title: "Your cooking companion · MealDeal" };

export default function CookingDemoPage() {
  return <CookingGuide key={demoMealPlan.id} plan={demoMealPlan} isDemo />;
}
