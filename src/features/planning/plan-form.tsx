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
import { plural } from "@/lib/plural";
import { ScreenHeader } from "@/components/screen-header";

const CUISINES = ["Chinese", "Korean", "Japanese", "Indian", "Italian", "Mexican", "Thai", "Vietnamese"];
const PREFS_KEY = "mealdeal.planPrefs";

// This plan's taste choices are remembered on the device and offered again next time.
function readPlanPrefs(): { cuisines?: string[]; meatVeg?: MeatVeg } {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePlanPrefs(prefs: { cuisines: string[]; meatVeg: MeatVeg }) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Remembering choices is a convenience only.
  }
}

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
  const vegetarianDiet = profile.meatVeg === "vegetarian";
  const [saved] = useState(readPlanPrefs);
  const [meatVeg, setMeatVeg] = useState<MeatVeg>(vegetarianDiet ? "vegetarian" : saved.meatVeg && saved.meatVeg !== "vegetarian" ? saved.meatVeg : profile.meatVeg);
  const [cuisines, setCuisines] = useState<string[]>(saved.cuisines ?? profile.cuisines);
  const [maxMinutes, setMaxMinutes] = useState("45");
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
      batchCook, cuisines, meatVeg,
      ...(maxMinutes ? { maxCookMinutes: Number(maxMinutes) } : {}), ...(note.trim() ? { note: note.trim() } : {}),
    };
    savePlanPrefs({ cuisines, meatVeg });
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
    <ScreenHeader backHref="/cook" />
    <p className="planning-eyebrow">COOK AT HOME / PLAN</p>
    <h1>Plan a meal</h1>
    <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy} className="planning-fieldset">
        <section className="planning-section planning-plain">
          <div className="range-field"><div className="range-label"><strong>Budget · CAD</strong><b>${budget}</b></div><div className="range-row"><button type="button" aria-label="Decrease budget" onClick={() => setBudget(String(Math.max(1, Number(budget) - 1)))}>−1</button><input aria-label="Total shopping budget in Canadian dollars" type="range" min="1" max="100" step="1" required value={budget} onChange={(event) => setBudget(event.target.value)} /><button type="button" aria-label="Increase budget" onClick={() => setBudget(String(Math.min(100, Number(budget) + 1)))}>+1</button></div><div className="range-ends"><span>$1</span><span>$100</span></div></div>
          <div className="range-field"><div className="range-label"><strong>People</strong><b>{servings}</b></div><div className="range-row"><button type="button" aria-label="Fewer people" onClick={() => setServings(String(Math.max(1, Number(servings) - 1)))}>−1</button><input aria-label="People per meal" type="range" min="1" max="8" step="1" required value={servings} onChange={(event) => setServings(event.target.value)} /><button type="button" aria-label="More people" onClick={() => setServings(String(Math.min(8, Number(servings) + 1)))}>+1</button></div><div className="range-ends"><span>1</span><span>8</span></div></div>
        </section>
        <section className="planning-section planning-plain">
          <div className="field" role="group" aria-label="Plan length">Plan length<div className="chips"><button type="button" className={`chip ${duration === "one_meal" ? "active" : ""}`} onClick={() => setDuration("one_meal")}>1 meal</button><button type="button" className={`chip ${duration === "days" ? "active" : ""}`} onClick={() => setDuration("days")}>3 meals</button><button type="button" className={`chip ${duration === "week" ? "active" : ""}`} onClick={() => setDuration("week")}>1 week</button></div></div>
          {duration !== "one_meal" && <div className="planning-grid">
            {duration === "days" && <label className="field">Days<input type="number" min="1" max="7" required value={days} onChange={(event) => setDays(event.target.value)} /></label>}
            <label className="field">Meals each day<select value={meals} onChange={(event) => setMeals(event.target.value)}><option value="1">Dinner</option><option value="2">Lunch + dinner</option><option value="3">Breakfast + lunch + dinner</option></select></label>
          </div>}
          <label className="planning-toggle"><input type="checkbox" checked={batchCook} onChange={(event) => setBatchCook(event.target.checked)} /><span><strong>Cook once, eat a few times</strong><small className="muted">Make extra portions and reuse ingredients.</small></span></label>
          <p className="planning-small muted">{plural(count, "meal")} · {plural(Number(servings) * count, "total portion")}</p>
        </section>
        <section className="planning-section planning-plain">
          {vegetarianDiet
            ? <p className="field">Meal balance<span className="muted">Vegetarian, from your dietary needs.</span></p>
            : <label className="field">Meal balance<select value={meatVeg} onChange={(event) => setMeatVeg(event.target.value as MeatVeg)}><option value="mostly_meat">More meat</option><option value="balanced">Balanced</option><option value="mostly_veg">More vegetables</option><option value="vegetarian">Vegetarian this time</option></select></label>}
          <div className="field" role="group" aria-label="Cuisines">Cuisines<div className="chips">{CUISINES.map((cuisine) => <button type="button" key={cuisine} aria-pressed={cuisines.includes(cuisine)} className={`chip ${cuisines.includes(cuisine) ? "active" : ""}`} onClick={() => setCuisines(cuisines.includes(cuisine) ? cuisines.filter((item) => item !== cuisine) : [...cuisines, cuisine])}>{cuisine}</button>)}</div><small className="muted">{cuisines.length ? "We'll mix these in where the prices work." : "No preference: any cuisine."}</small></div>
          <div className="range-field"><div className="range-label"><strong>Cooking time</strong><b>{maxMinutes} min</b></div><div className="range-row"><button type="button" aria-label="Less cooking time" onClick={() => setMaxMinutes(String(Math.max(10, Number(maxMinutes) - 5)))}>−5</button><input aria-label="Maximum cooking time" type="range" min="10" max="120" step="5" value={maxMinutes} onChange={(event) => setMaxMinutes(event.target.value)} /><button type="button" aria-label="More cooking time" onClick={() => setMaxMinutes(String(Math.min(120, Number(maxMinutes) + 5)))}>+5</button></div><div className="range-ends"><span>10 min</span><span>120 min</span></div></div>
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
