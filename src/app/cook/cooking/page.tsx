import type { Metadata } from "next";
import { CurrentPlanView } from "@/features/cooking/current-plan-view";

export const metadata: Metadata = { title: "Cook your meal · MealDeal" };

export default function CookingPage() {
  return <CurrentPlanView />;
}
