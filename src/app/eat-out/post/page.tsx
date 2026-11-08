import type { Metadata } from "next";
import { SurplusPostForm } from "@/features/surplus/post-form";

export const metadata: Metadata = { title: "Post a surplus listing · MealDeal" };
export default function PostSurplusPage() { return <SurplusPostForm />; }
