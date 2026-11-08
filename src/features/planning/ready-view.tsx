"use client";

import Link from "next/link";
import { mealPlanStore } from "@/lib/meal-plan-store";
import { formatWeight } from "./format";
import { useSaved } from "./use-saved";
import { plural } from "@/lib/plural";
import { ScreenHeader } from "@/components/screen-header";

// D can replace this shopping-completion screen with the interactive cooking feature.
export function ReadyView() {
  const saved = useSaved(mealPlanStore.getSelected);
  if (!saved.loaded) {
    return <main className="page"><p role="status">Loading your meal plan…</p></main>;
  }
  const plan = saved.value;
  if (!plan || plan.status === "shopping" || plan.chosen.shoppingList.some((item) => !item.bought)) {
    return <main className="page"><h1>Finish shopping first</h1><Link className="btn" href="/cook/shopping">Your shopping list</Link></main>;
  }
  const units = mealPlanStore.getOptions()?.units;
  return <main className="page planning-page"><ScreenHeader backHref="/cook/shopping" backLabel="Shopping list" /><p className="planning-eyebrow">SHOPPING COMPLETE</p><h1>Your kitchen<br />is ready.</h1><p className="muted">Your meal plan and shopping progress are saved on this device.</p>{plan.chosen.recipes.map((recipe) => <section className="card planning-section" key={recipe.id}><h2>{recipe.title}</h2><p className="muted">{plural(recipe.servings, "portion")} · about {recipe.totalMinutes} minutes</p><ul>{recipe.ingredients.map((item, index) => <li key={index}>{item.name} · {units ? formatWeight(item.qtyG, units) : `${item.qtyG} g`}</li>)}</ul></section>)}<Link className="btn secondary planning-full" href="/cook/plan">Plan another meal</Link></main>;
}
