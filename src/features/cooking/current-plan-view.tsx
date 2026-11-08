"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MealPlan } from "@/types";
import { CookingGuide } from "./cooking-guide";
import { canCook, CURRENT_PLAN_KEY, parseCurrentPlan } from "./plan-storage";

export function CurrentPlanView() {
  const [saved, setSaved] = useState<{ ready: boolean; plan: MealPlan | null; error: string }>({ ready: false, plan: null, error: "" });
  useEffect(() => {
    let active = true;
    const load = () => {
      if (!active) return;
      try { setSaved({ ready: true, plan: parseCurrentPlan(localStorage.getItem(CURRENT_PLAN_KEY)), error: "" }); }
      catch { setSaved({ ready: true, plan: null, error: "Your saved meal plan could not be loaded. Choose a plan again, or try the cooking demo." }); }
    };
    void Promise.resolve().then(load);
    const onStorage = (event: StorageEvent) => { if (event.key === CURRENT_PLAN_KEY || event.key === null) load(); };
    window.addEventListener("storage", onStorage);
    return () => { active = false; window.removeEventListener("storage", onStorage); };
  }, []);

  if (!saved.ready) return <main className="page"><p role="status">Loading your meal plan…</p></main>;
  if (!saved.plan) return <main className="page"><p className="muted">YOUR KITCHEN</p><h1>Something good starts with a plan.</h1><p className="muted" role="status">{saved.error || "Choose a meal and finish shopping. Your recipes will be waiting here."}</p><div className="chips"><Link className="btn" href="/cook/plan">Plan a meal</Link><Link className="btn secondary" href="/cook/demo">Try the cooking demo</Link></div></main>;
  if (!canCook(saved.plan)) return <main className="page"><h1>Your ingredients come first.</h1><p className="muted">Check off your shopping list before starting the cooking steps.</p><Link className="btn" href="/cook/shopping">Back to shopping</Link></main>;
  return <CookingGuide key={`${saved.plan.userId}:${saved.plan.id}:${JSON.stringify(saved.plan.chosen.recipes)}:${JSON.stringify(saved.plan.progress)}`} plan={saved.plan} />;
}
