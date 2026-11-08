"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MealPlan } from "@/types";
import { ScreenHeader } from "@/components/screen-header";
import { mealPlanStore } from "@/lib/meal-plan-store";
import { formatMoney } from "./format";
import { loadAccountPlans } from "./plan-sync";

export function AccountPlansView() {
  const router = useRouter();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadAccountPlans().then((items) => {
      if (active) {
        setPlans(items);
        setLoading(false);
      }
    }).catch((cause) => {
      if (active) {
        setError(cause instanceof Error ? cause.message : "Your saved plans could not be loaded.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [attempt]);

  function restore(plan: MealPlan) {
    try {
      mealPlanStore.setSelected(plan);
      mealPlanStore.clearOptions();
      router.push(plan.status === "shopping" ? "/cook/shopping" : "/cook/cooking");
    } catch {
      setError("This device could not save the plan. Enable browser storage and try again.");
    }
  }

  function retry() {
    setError("");
    setLoading(true);
    setAttempt((value) => value + 1);
  }

  return <main className="page planning-page">
    <ScreenHeader backHref="/cook" />
    <p className="planning-eyebrow">YOUR ACCOUNT</p><h1>Continue a saved plan</h1>
    <p className="muted">Your 20 most recently updated unfinished plans. Opening one replaces this device&apos;s current plan.</p>
    {loading && <p role="status">Loading saved plans…</p>}
    {error && <div className="planning-error" role="alert"><p>{error}</p><button type="button" className="btn secondary" onClick={retry}>Try again</button></div>}
    {!loading && !error && plans.length === 0 && <p role="status">No unfinished plans are saved to this account. Browser-only plans stay on their original device.</p>}
    {plans.map((plan) => <article className="card planning-section" key={plan.id}>
      <h2>{plan.chosen.title}</h2>
      <p className="muted">{plan.status === "shopping" ? "Shopping" : "Cooking"} · {formatMoney(plan.chosen.shoppingCost)} checkout estimate</p>
      <p className="planning-small muted">Created {new Date(plan.createdAt).toLocaleDateString("en-CA")}. Check current prices before purchasing.</p>
      <button type="button" className="btn primary planning-full" onClick={() => restore(plan)}>{plan.status === "shopping" ? "Continue shopping" : "Continue cooking"} →</button>
    </article>)}
    <Link className="planning-back" href="/cook/plan">Plan another meal →</Link>
  </main>;
}
