import type { Metadata } from "next";
import { SurplusView } from "@/features/surplus/surplus-view";

export const metadata: Metadata = { title: "Surplus food · MealDeal" };
export default function EatOutPage() { return <SurplusView />; }
