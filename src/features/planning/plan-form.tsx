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
import { RangeField } from "@/components/range-field";

// The top of the cooking-time slider means "no limit", so plans are not cut short by default.
const ANY_TIME = 125;

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
  return <main className="page planning-page has-action-bar">
    <ScreenHeader backHref="/cook" />
    <p className="planning-eyebrow">COOK AT HOME / PLAN</p>
    <h1>Plan a meal</h1>
    <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy} className="planning-fieldset">
        <section className="planning-section planning-plain">
          <RangeField id="plan-budget" label="Budget · CAD" value={Number(budget)} min={5} max={150} format={(value) => `$${value}`} onChange={(value) => setBudget(String(value))} />
          <RangeField id="plan-people" label="People" value={Number(servings)} min={1} max={8} onChange={(value) => setServings(String(value))} />
        </section>
        <section className="planning-section planning-plain">
          <div className="field" role="group" aria-label="Plan length">Plan length<div className="chips">{[["one_meal", "One meal"], ["days", "A few days"], ["week", "A week"]].map(([value, label]) => <button type="button" key={value} className="chip" aria-pressed={duration === value} onClick={() => setDuration(value)}>{label}</button>)}</div></div>
          {duration !== "one_meal" && <div className="planning-grid">
            {duration === "days" && <label className="field">Days<select value={days} onChange={(event) => setDays(event.target.value)}>{["2", "3", "4", "5", "6"].map((value) => <option key={value} value={value}>{value} days</option>)}</select></label>}
            <label className="field">Meals each day<select value={meals} onChange={(event) => setMeals(event.target.value)}><option value="1">Dinner</option><option value="2">Lunch + dinner</option><option value="3">Breakfast + lunch + dinner</option></select></label>
          </div>}
          <label className="planning-toggle"><input type="checkbox" checked={batchCook} onChange={(event) => setBatchCook(event.target.checked)} /><span><strong>Cook once, eat a few times</strong><small className="muted">Make extra portions and reuse ingredients.</small></span></label>
          <p className="planning-small muted">{plural(count, "meal")} · {plural(Number(servings) * count, "total portion")}</p>
        </section>
        <section className="planning-section planning-plain">
          {vegetarianDiet
            ? <p className="field">Meal balance<span className="muted">Vegetarian, from your dietary needs.</span></p>
            : <label className="field">Meal balance<select value={meatVeg} onChange={(event) => setMeatVeg(event.target.value as MeatVeg)}><option value="mostly_meat">More meat</option><option value="balanced">Balanced</option><option value="mostly_veg">More vegetables</option><option value="vegetarian">Vegetarian this time</option></select></label>}
          <div className="field" role="group" aria-label="Cuisines">Cuisines<div className="chips">{CUISINES.map((cuisine) => <button type="button" key={cuisine} aria-pressed={cuisines.includes(cuisine)} className="chip" onClick={() => setCuisines(cuisines.includes(cuisine) ? cuisines.filter((item) => item !== cuisine) : [...cuisines, cuisine])}>{cuisine}</button>)}</div><small className="muted">{cuisines.length ? "We'll mix these in where the prices work." : "No preference: any cuisine."}</small></div>
          <RangeField id="plan-time" label="Cooking time" value={maxMinutes ? Number(maxMinutes) : ANY_TIME} min={10} max={ANY_TIME} step={5} buttonStep={5} format={(value) => value >= ANY_TIME ? "Any length" : `${value} min`} onChange={(value) => setMaxMinutes(value >= ANY_TIME ? "" : String(value))} />
          <label className="field">Anything else?<textarea value={note} maxLength={1000} rows={3} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Something spicy, please" /></label>
          <p className="planning-small muted">Your saved allergies and dietary needs apply to every option.</p>
        </section>
      </fieldset>
      {error && <p className="planning-error" role="alert">{error}</p>}
      <div className="action-bar"><button className="btn primary" disabled={busy} type="submit">{busy ? "Finding affordable meals…" : "Find meals"}</button></div>
      {busy && <p className="muted planning-small" role="status">This usually takes about 15 seconds. We&apos;re checking ingredients, full-package costs and every meal. It may take longer when the service is busy.</p>}
    </form>
  </main>;
}
