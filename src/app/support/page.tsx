import type { Metadata } from "next";
import { SupportView } from "@/features/support/support-view";

export const metadata: Metadata = { title: "Food support in Vancouver · MealDeal" };

export default function SupportPage() { return <SupportView />; }
