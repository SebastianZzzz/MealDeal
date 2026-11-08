"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { demoStore } from "@/lib/demo-store";
import { mealPlanStore } from "@/lib/meal-plan-store";
import { readApiError } from "@/lib/api-error";
import type { MeatVeg, PlanRequest } from "@/types";
import type { PlanningResponse } from "@/contracts/planning-api";
import { adaptPantry, adaptProfile } from "./adapter";
import { useSaved } from "./use-saved";

function readKitchen() {
  try {
    const profile = demoStore.getProfile();
    return profile?.onboardingComplete ? { profile, pantry: demoStore.getPantry() } : null;
  } catch {
    return null;
  }
}

export function PlanForm() {
  const kitchen = useSaved(readKitchen);
  if (!kitchen.loaded) {
    return <main className="page"><p role="status">Loading your kitchen…</p></main>;
  }
  if (!kitchen.value) {
    return <main className="page"><h1>Set up your kitchen</h1><p className="muted">Save your preferences and equipment before planning.</p><Link className="btn" href="/onboarding">Set up my kitchen</Link></main>;
  }
  return <MealDetails kitchen={kitchen.value} />;
}

function MealDetails({ kitchen }: { kitchen: NonNullable<ReturnType<typeof readKitchen>> }) {
  const router = useRouter();
  const profile = adaptProfile(kitchen.profile);
  const [budget, setBudget] = useState("25");
  const [servings, setServings] = useState(String(profile.defaultServings));
  const [duration, setDuration] = useState("one_meal");
  const [days, setDays] = useState("3");
  const [meals, setMeals] = useState("1");
  const [batchCook, setBatchCook] = useState(false);
  const [meatVeg, setMeatVeg] = useState<MeatVeg>(profile.meatVeg);
  const [cuisines, setCuisines] = useState(profile.cuisines.join(", "));
  const [maxMinutes, setMaxMinutes] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const request: PlanRequest = {
      budget: Number(budget), servings: Number(servings), duration: duration === "one_meal" ? "one_meal" : "days",
      ...(duration !== "one_meal" ? { days: duration === "week" ? 7 : Number(days), mealsPerDay: Number(meals) } : {}),
      batchCook, cuisines: cuisines.split(",").map((item) => item.trim()).filter(Boolean), meatVeg,
      ...(maxMinutes ? { maxCookMinutes: Number(maxMinutes) } : {}), ...(note.trim() ? { note: note.trim() } : {}),
    };
    try {
      const response = await fetch("/api/plan", {
        method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(60000),
        body: JSON.stringify({ request, profile, pantry: adaptPantry(kitchen.pantry, profile.id) }),
      });
      if (!response.ok) {
        throw new Error((await readApiError(response)).error);
      }
      const result = await response.json();
      mealPlanStore.setOptions({ request, response: result as PlanningResponse, units: profile.units });
      router.push("/cook/options");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your plan on this device.");
      setBusy(false);
    }
  }

  const count = duration === "one_meal" ? 1 : (duration === "week" ? 7 : Number(days)) * Number(meals);
  return <main className="page planning-page">
    <Link className="planning-back" href="/cook">← Your kitchen</Link>
    <p className="planning-eyebrow">COOK AT HOME · 1 OF 3</p>
    <h1>Good meals.<br />Within your budget.</h1>
    <p className="muted">Start with what you can spend. We&apos;ll build complete meals around affordable ingredients.</p>
    <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy} className="planning-fieldset">
        <section className="card planning-section">
          <label className="field planning-budget">Total shopping budget (CAD)<div className="planning-currency"><span aria-hidden="true">$</span><input aria-label="Total shopping budget in Canadian dollars" type="number" min="0" max="10000" step="0.01" required value={budget} onChange={(event) => setBudget(event.target.value)} /></div></label>
          <p className="muted planning-small">For the whole plan, including full packages. Pantry ingredients cost $0 today.</p>
          <label className="field">People per meal<input type="number" min="1" max="20" step="1" required value={servings} onChange={(event) => setServings(event.target.value)} /></label>
        </section>
        <section className="card planning-section">
          <label className="field">Plan for<select value={duration} onChange={(event) => setDuration(event.target.value)}><option value="one_meal">One meal</option><option value="days">A few days</option><option value="week">One week</option></select></label>
          {duration !== "one_meal" && <div className="planning-grid">
            {duration === "days" && <label className="field">Days<input type="number" min="1" max="7" required value={days} onChange={(event) => setDays(event.target.value)} /></label>}
            <label className="field">Meals each day<select value={meals} onChange={(event) => setMeals(event.target.value)}><option value="1">Dinner</option><option value="2">Lunch + dinner</option><option value="3">Breakfast + lunch + dinner</option></select></label>
          </div>}
          <label className="planning-toggle"><input type="checkbox" checked={batchCook} onChange={(event) => setBatchCook(event.target.checked)} /><span><strong>Cook once, eat a few times</strong><small className="muted">Make extra portions and reuse ingredients.</small></span></label>
          <p className="planning-small muted">{count} meal{count === 1 ? "" : "s"} · {Number(servings) * count} total portions</p>
        </section>
        <section className="card planning-section">
          <h2>Make it yours</h2>
          <label className="field">Meal balance<select value={meatVeg} onChange={(event) => setMeatVeg(event.target.value as MeatVeg)} disabled={profile.meatVeg === "vegetarian"}><option value="mostly_meat">More meat</option><option value="balanced">Balanced</option><option value="mostly_veg">More vegetables</option><option value="vegetarian">Vegetarian</option></select></label>
          <label className="field">Cuisines<input value={cuisines} maxLength={500} onChange={(event) => setCuisines(event.target.value)} placeholder="e.g. Chinese, Italian" /><small className="muted">Separate with commas.</small></label>
          <label className="field">Maximum cooking time (optional)<input type="number" min="1" max="240" value={maxMinutes} onChange={(event) => setMaxMinutes(event.target.value)} placeholder="Minutes per recipe" /></label>
          <label className="field">Anything else?<textarea value={note} maxLength={1000} rows={3} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Something spicy, please" /></label>
          <p className="planning-small muted">Your saved allergies and dietary needs apply to every option.</p>
        </section>
      </fieldset>
      {error && <p className="planning-error" role="alert">{error}</p>}
      <button className="btn planning-full" disabled={busy} type="submit">{busy ? "Finding affordable meals…" : "Find my meal options →"}</button>
      {busy && <p className="muted planning-small" role="status">This usually takes about 15 seconds. We&apos;re checking ingredients, full-package costs and every meal. It may take longer when the service is busy.</p>}
    </form>
  </main>;
}
