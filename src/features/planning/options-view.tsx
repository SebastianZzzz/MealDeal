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

export function OptionsView() {
  const saved = useSaved(mealPlanStore.getOptions);
  const router = useRouter();
  const [error, setError] = useState("");
  if (!saved.loaded) {
    return <main className="page"><p role="status">Loading your options…</p></main>;
  }
  if (!saved.value) {
    return <main className="page"><h1>Let&apos;s plan a meal</h1><p className="muted">Create a plan to compare your meal options.</p><Link className="btn" href="/cook/plan">Enter meal details</Link></main>;
  }
  const { request, response, units } = saved.value;
  function choose(option: PlanOption) {
    try {
      mealPlanStore.setSelected({
        id: option.id, userId: demoStore.getProfile()?.id ?? "demo-student", request,
        chosen: structuredClone(option), status: "shopping", progress: {}, createdAt: new Date().toISOString(),
      });
      router.push("/cook/shopping");
    } catch {
      setError("Could not save this plan. Enable browser storage and try again.");
    }
  }
  return <main className="page planning-page">
    <Link className="planning-back" href="/cook/plan">← Edit meal details</Link>
    <p className="planning-eyebrow">COOK AT HOME · 2 OF 3</p><h1>Your budget.<br />A few good options.</h1>
    <p className="muted">{getMealSlots(request).length} meals · {request.servings} people · {formatMoney(request.budget)} total budget</p>
    <div className="planning-notices">{response.meta.warnings.map((warning) => <p className="planning-notice" key={warning}>{warning}</p>)}</div>
    <p className="planning-small muted">Choose your meals now. Cooking instructions come after shopping.</p>
    {error && <p role="alert" className="planning-error">{error}</p>}
    {response.options.map((option, index) => <article className="card planning-section" key={option.id}>
      <div className="planning-row"><span className="planning-badge">{index === 0 ? "Lowest checkout cost" : `Option ${index + 1}`}</span><span className="planning-small muted">{option.recipes.length} recipe{option.recipes.length === 1 ? "" : "s"}</span></div>
      <h2>{option.title}</h2>
      <ul className="planning-recipes">{option.recipes.map((recipe) => <li key={recipe.id}><strong>{recipe.title}</strong><span className="muted planning-small">{recipe.servings} portions · about {recipe.totalMinutes} min · {formatMealSlots(recipe.mealSlots)}</span></li>)}</ul>
      <div className="planning-checkout"><span>Pay at checkout</span><strong>{formatMoney(option.shoppingCost)}</strong></div>
      <div className="planning-grid planning-costs"><div><span className="muted planning-small">Food used</span><strong>{formatMoney(option.recipeCost)}</strong></div><div><span className="muted planning-small">Per person, per meal</span><strong>{formatMoney(option.costPerServing)}</strong></div></div>
      {option.nutritionTotal && <p className="planning-small">Plan nutrition: {Math.round(option.nutritionTotal.kcal)} kcal · {option.nutritionTotal.proteinG} g protein · {option.nutritionTotal.fatG} g fat · {option.nutritionTotal.carbG} g carbs</p>}
      {Boolean(response.meta.missingNutrition[option.id]?.length) && <p className="planning-small muted">{option.nutritionTotal ? "Some ingredients are missing nutrition data. Totals include only matched ingredients." : "Nutrition data is unavailable for these ingredients."}</p>}
      {option.leftovers.length > 0 && <details className="planning-leftovers"><summary>Left for your next meal</summary><ul>{option.leftovers.map((item) => <li key={item.productId}>{item.name} · {formatWeight(item.qtyG, units)}</li>)}</ul></details>}
      <button type="button" className="btn planning-full" onClick={() => choose(option)}>Choose this plan →</button>
    </article>)}
  </main>;
}
