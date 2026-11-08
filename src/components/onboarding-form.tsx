"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { demoStore } from "@/lib/demo-store";
import { readApiError } from "@/lib/api-error";
import { dietaryFieldErrors, normalizeDietary, withDietary } from "@/lib/profile-validation";
import { PANTRY_AMOUNTS, guessPantryKind, type PantryAmount } from "@/lib/pantry-amounts";
import { defaultProfile, type PantryItem, type UserProfile } from "@/contracts";

const options = {
  dietary: ["Vegetarian", "Vegan", "Halal", "Kosher"],
  allergies: ["Peanuts", "Tree nuts", "Dairy", "Eggs", "Gluten", "Shellfish"],
  equipment: ["Stovetop", "Pot", "Pan", "Oven", "Microwave", "Rice cooker", "Air fryer", "Blender"],
};

const fieldErrorStyle = { color: "#a32626", fontSize: 13, marginTop: 6 } as const;

function stepForFields(fields: Record<string, string>, fallback: number) {
  const names = Object.keys(fields);
  if (names.some((name) => name.startsWith("units."))) return 0;
  if (names.some((name) => ["dietary", "allergies", "cuisines", "meatVegRatio", "defaultServings"].includes(name))) return 1;
  if (names.some((name) => name === "equipment")) return 2;
  if (names.some((name) => /^\d+\./.test(name) || name === "_")) return 3;
  if (names.some((name) => ["maxDistanceKm", "nutritionGoal"].includes(name))) return 4;
  return fallback;
}

function Chips({ values, selected, onChange }: { values: string[]; selected: string[]; onChange: (value: string[]) => void }) {
  return <div className="chips">{values.map((value) => <button type="button" key={value} className={`chip ${selected.includes(value) ? "active" : ""}`} onClick={() => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])}>{value}</button>)}</div>;
}

function englishProfile(profile: UserProfile): UserProfile {
  // Older saved profiles may pair a vegetarian diet with another meal balance; line them up.
  return normalizeDietary({ ...profile, lang: "en", units: { ...profile.units, lang: "en" } });
}

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [serverFields, setServerFields] = useState<Record<string, string>>({});
  const preferenceFields = dietaryFieldErrors(profile);
  const fields = { ...serverFields, ...preferenceFields };

  useEffect(() => {
    async function load() {
      try {
        const [meResponse, pantryResponse] = await Promise.all([fetch("/api/me"), fetch("/api/pantry")]);
        if (!meResponse.ok) throw new Error((await readApiError(meResponse)).error);
        if (!pantryResponse.ok) throw new Error((await readApiError(pantryResponse)).error);
        const meData = await meResponse.json();
        const pantryData = await pantryResponse.json();
        const savedProfile = meData.profile ?? demoStore.getProfile() ?? defaultProfile;
        setProfile(englishProfile(savedProfile));
        setPantry(pantryData.items?.length ? pantryData.items : demoStore.getPantry());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Your saved setup could not be loaded.");
        setProfile(englishProfile(demoStore.getProfile() ?? defaultProfile));
        setPantry(demoStore.getPantry());
      }
    }
    void load();
  }, []);

  function addPantry() {
    const name = newItem.trim();
    if (!name) return;
    setPantry((items) => [...items, { name, qtyG: 0, kind: guessPantryKind(name), amount: "unknown" }]);
    setNewItem("");
  }

  function updatePantry(index: number, change: Partial<PantryItem>) {
    setPantry((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
  }

  function continueOnboarding() {
    setError("");
    const nextFields: Record<string, string> = {};
    if (step === 1) {
      Object.assign(nextFields, preferenceFields);
      if (!Number.isInteger(profile.defaultServings) || profile.defaultServings < 1 || profile.defaultServings > 20) {
        nextFields.defaultServings = "Enter a whole number from 1 to 20.";
      }
    }
    setServerFields(nextFields);
    if (Object.keys(nextFields).length) return;
    setStep((current) => current + 1);
  }

  async function finish() {
    setSaving(true);
    setError("");
    setServerFields({});
    const complete = { ...englishProfile(profile), onboardingComplete: true };
    try {
      const profileResponse = await fetch("/api/me", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(complete) });
      if (!profileResponse.ok) {
        const failure = await readApiError(profileResponse);
        setServerFields(failure.fields ?? {});
        setStep(stepForFields(failure.fields ?? {}, 4));
        throw new Error(failure.error);
      }
      const pantryResponse = await fetch("/api/pantry", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(pantry) });
      if (!pantryResponse.ok) {
        const failure = await readApiError(pantryResponse);
        setServerFields(failure.fields ?? {});
        setStep(stepForFields(failure.fields ?? {}, 3));
        throw new Error(failure.error);
      }
      demoStore.setProfile(complete);
      demoStore.setPantry(pantry);
      router.push("/cook");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  const headings = ["Measurement units", "Food preferences", "Your kitchen", "What's already at home?", "Shopping range"];
  return <main className="page">
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b>MealDeal</b><span className="muted">{step + 1} / 5</span></header>
    <div style={{ height: 7, background: "#e2e6df", borderRadius: 99, margin: "20px 0 34px" }}><div style={{ width: `${(step + 1) * 20}%`, height: "100%", background: "var(--green)", borderRadius: 99 }} /></div>
    <h1 style={{ fontSize: 34, letterSpacing: "-1.3px" }}>{headings[step]}</h1>
    {step === 0 && <section className="card">
      <p className="muted">Choose how recipe quantities are displayed. MealDeal currently uses English.</p>
      <label className="field">Weight unit<select value={profile.units.weight} onChange={(event) => setProfile({ ...profile, units: { ...profile.units, weight: event.target.value as UserProfile["units"]["weight"] } })}><option value="g">grams (g)</option><option value="kg">kilograms (kg)</option><option value="lb">pounds (lb)</option><option value="oz">ounces (oz)</option><option value="jin">jin (500 g)</option></select></label>
      <label className="field">Volume unit<select value={profile.units.volume} onChange={(event) => setProfile({ ...profile, units: { ...profile.units, volume: event.target.value as UserProfile["units"]["volume"] } })}><option value="ml">millilitres (ml)</option><option value="l">litres (l)</option><option value="cup">cups</option><option value="fl_oz">fluid ounces (fl oz)</option></select></label>
    </section>}
    {step === 1 && <section className="card">
      <p className="muted">Rules every plan must follow. You pick cuisines and the meat/veg balance each time you plan.</p>
      <label className="field">Dietary needs<Chips values={options.dietary} selected={profile.dietary} onChange={(dietary) => { setProfile(withDietary(profile, dietary)); setServerFields({}); }} />{(fields.dietary || fields.meatVegRatio) && <span style={fieldErrorStyle}>{fields.dietary || fields.meatVegRatio}</span>}</label>
      <label className="field">Allergies<Chips values={options.allergies} selected={profile.allergies} onChange={(allergies) => setProfile({ ...profile, allergies })} /></label>
      <label className="field">People I usually cook for<input type="number" min="1" max="20" aria-invalid={Boolean(fields.defaultServings)} value={Number.isFinite(profile.defaultServings) ? profile.defaultServings : ""} onChange={(event) => { setProfile({ ...profile, defaultServings: event.target.value === "" ? Number.NaN : Number(event.target.value) }); setServerFields((current) => ({ ...current, defaultServings: "" })); }} />{fields.defaultServings && <span style={fieldErrorStyle}>{fields.defaultServings}</span>}</label>
    </section>}
    {step === 2 && <section className="card"><p className="muted">Pot and stovetop are selected by default.</p><Chips values={options.equipment} selected={profile.equipment} onChange={(equipment) => setProfile({ ...profile, equipment })} /></section>}
    {step === 3 && <section className="card">
      <p className="muted">Add staples or leftovers. Rough is fine: we use it to decide how much to buy. Seasonings like soy sauce just need to be on the list.</p>
      <div style={{ display: "flex", gap: 8 }}><input aria-label="Pantry item" style={{ flex: 1, border: "1px solid #cbd7ce", borderRadius: 14, padding: 13 }} value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addPantry(); } }} placeholder="e.g. rice, soy sauce" /><button className="btn" type="button" onClick={addPantry}>Add</button></div>
      <div style={{ display: "grid", gap: 9, marginTop: 18 }}>{pantry.map((item, index) => {
        const kind = item.kind ?? guessPantryKind(item.name);
        const amount: PantryAmount = item.amount ?? "unknown";
        return <div key={`${item.name}-${index}`} style={{ display: "grid", gap: 8, padding: "10px 0", borderBottom: "1px solid #edf0eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span><b>{item.name}</b>{item.qtyG > 0 && <span className="muted"> · {item.qtyG} g</span>}</span>
            <span style={{ display: "flex", gap: 6 }}>
              <button type="button" className="chip" onClick={() => updatePantry(index, { kind: kind === "seasoning" ? "ingredient" : "seasoning" })}>{kind === "seasoning" ? "Seasoning" : "Ingredient"} ⇄</button>
              <button type="button" className="chip" onClick={() => setPantry(pantry.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
            </span>
          </div>
          {kind === "seasoning"
            ? <span className="muted" style={{ fontSize: 14 }}>Have it. Recipes only use a little.</span>
            : <div className="chips" role="group" aria-label={`How much ${item.name}`}>{PANTRY_AMOUNTS.map((option) => <button type="button" key={option.value} aria-pressed={amount === option.value} className={`chip ${amount === option.value ? "active" : ""}`} onClick={() => updatePantry(index, { amount: option.value, qtyG: 0 })}>{option.label}</button>)}</div>}
        </div>;
      })}</div>
      {fields._ && <p style={fieldErrorStyle}>{fields._}</p>}
    </section>}
    {step === 4 && <section className="card">
      <label className="field">Maximum shopping distance: {profile.maxDistanceKm} km<input type="range" min="0.5" max="15" step="0.5" value={profile.maxDistanceKm} onChange={(event) => setProfile({ ...profile, maxDistanceKm: Number(event.target.value) })} /></label>
      <label className="field">Optional nutrition goal<textarea rows={3} placeholder="e.g. prioritize protein" value={profile.nutritionGoal} onChange={(event) => setProfile({ ...profile, nutritionGoal: event.target.value })} /></label>
    </section>}
    {error && <p role="alert" style={{ color: "#a32626" }}>{error}</p>}
    <footer style={{ display: "flex", gap: 10, marginTop: 26 }}>
      {step > 0 && <button className="btn secondary" onClick={() => { setStep(step - 1); setError(""); setServerFields({}); }}>Back</button>}
      <button className="btn" style={{ flex: 1 }} disabled={saving || (step === 1 && Object.keys(preferenceFields).length > 0)} onClick={() => step < 4 ? continueOnboarding() : void finish()}>{step < 4 ? "Continue" : saving ? "Saving…" : "Start planning"}</button>
    </footer>
  </main>;
}
