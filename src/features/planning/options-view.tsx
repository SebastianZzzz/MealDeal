"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { demoStore } from "@/lib/demo-store";
import { mealPlanStore } from "@/lib/meal-plan-store";
import type { PlanOption } from "@/types";
import { formatMealSlots, formatMoney, formatWeight } from "./format";
import { getMealSlots } from "./slots";
import { useSaved } from "./use-saved";
import { storeCount } from "./rank-options";
import { plural } from "@/lib/plural";
import { ScreenHeader } from "@/components/screen-header";
import { savePlanToAccount } from "./plan-sync";

function recommendationLabel(option: PlanOption, index: number): string {
  if (index > 0) {
    return `Option ${index + 1}`;
  }
  const count = storeCount(option);
  if (count === 0) {
    return "No shopping needed";
  }
  return count === 1 ? "One-store pick" : "Fewest store stops";
}

export function OptionsView() {
  const saved = useSaved(mealPlanStore.getOptions);
  const router = useRouter();
  const [error, setError] = useState("");
  const [choosing, setChoosing] = useState("");
  if (!saved.loaded) {
    return <main className="page"><p role="status">Loading your options…</p></main>;
  }
  if (!saved.value) {
    return <main className="page"><h1>Let&apos;s plan a meal</h1><p className="muted">Create a plan to compare your meal options.</p><Link className="btn" href="/cook/plan">Enter meal details</Link></main>;
  }
  const { request, response, units } = saved.value;
  async function choose(option: PlanOption) {
    setChoosing(option.id);
    // Saved to the account when possible, so shopping and cooking continue on another device.
    const accountPlan = await savePlanToAccount(request, option);
    try {
      mealPlanStore.setSelected(accountPlan ?? {
        id: option.id, userId: demoStore.getProfile()?.id ?? "demo-student", request,
        chosen: structuredClone(option), status: "shopping", progress: {}, createdAt: new Date().toISOString(),
      });
      router.push("/cook/shopping");
    } catch {
      setError("Could not save this plan. Enable browser storage and try again.");
      setChoosing("");
    }
  }
  return <main className="page planning-page">
    <ScreenHeader backHref="/cook/plan" />
    <p className="planning-eyebrow">COOK AT HOME / CHOOSE</p><h1>Meal options</h1>
    <p className="muted">{plural(getMealSlots(request).length, "meal")} · {plural(request.servings, "person", "people")} · {formatMoney(request.budget)} total budget</p>
    <div className="planning-notices">{response.meta.warnings.map((warning) => <p className="planning-notice" key={warning}>{warning}</p>)}</div>
    <p className="planning-small muted">Choose your meals now. Cooking instructions come after shopping.</p>
    {error && <p role="alert" className="planning-error">{error}</p>}
    {response.options.map((option, index) => <article className="card planning-section" key={option.id}>
      <div className="planning-row"><span className="planning-badge">{recommendationLabel(option, index)}</span><span className="planning-small muted">{storeCount(option)} store{storeCount(option) === 1 ? "" : "s"} · {option.recipes.length} recipe{option.recipes.length === 1 ? "" : "s"}</span></div>
      <h2>{option.title}</h2>
      <ul className="planning-recipes">{option.recipes.map((recipe) => <li key={recipe.id}><strong>{recipe.title}</strong><span className="muted planning-small">{plural(recipe.servings, "portion")} · about {recipe.totalMinutes} min · {formatMealSlots(recipe.mealSlots)}</span></li>)}</ul>
      <div className="planning-checkout"><span>Pay at checkout</span><strong>{formatMoney(option.shoppingCost)}</strong></div>
      <div className="planning-grid planning-costs"><div><span className="muted planning-small">Food used</span><strong>{formatMoney(option.recipeCost)}</strong></div><div><span className="muted planning-small">Per person, per meal</span><strong>{formatMoney(option.costPerServing)}</strong></div></div>
      {option.nutritionTotal && <p className="planning-small">Plan nutrition: {Math.round(option.nutritionTotal.kcal)} kcal · {option.nutritionTotal.proteinG} g protein · {option.nutritionTotal.fatG} g fat · {option.nutritionTotal.carbG} g carbs</p>}
      {Boolean(response.meta.missingNutrition[option.id]?.length) && <p className="planning-small muted">{option.nutritionTotal ? "Some ingredients are missing nutrition data. Totals include only matched ingredients." : "Nutrition data is unavailable for these ingredients."}</p>}
      {option.leftovers.length > 0 && <details className="planning-leftovers"><summary>Left for your next meal</summary><ul>{option.leftovers.map((item) => <li key={item.productId}>{item.name} · {formatWeight(item.qtyG, units)}</li>)}</ul></details>}
      <button type="button" className="btn primary planning-full" disabled={Boolean(choosing)} onClick={() => void choose(option)}>{choosing === option.id ? "Saving your plan…" : "Choose this plan →"}</button>
    </article>)}
  </main>;
}
