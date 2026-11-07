"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { demoStore } from "@/lib/demo-store";
import { defaultProfile, type PantryItem, type UserProfile } from "@/contracts";

const options = {
  dietary: ["Vegetarian", "Vegan", "Halal", "Kosher"],
  allergies: ["Peanuts", "Tree nuts", "Dairy", "Eggs", "Gluten", "Shellfish"],
  cuisines: ["Chinese", "Korean", "Indian", "Italian", "Mexican", "Japanese"],
  equipment: ["Stovetop", "Pot", "Pan", "Oven", "Microwave", "Rice cooker", "Air fryer", "Blender"],
};

function Chips({ values, selected, onChange }: { values: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return <div className="chips">{values.map((value) => <button type="button" key={value} className={`chip ${selected.includes(value) ? "active" : ""}`} onClick={() => onChange(selected.includes(value) ? selected.filter((x) => x !== value) : [...selected, value])}>{value}</button>)}</div>;
}

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/me"), fetch("/api/pantry")]).then(async ([me, food]) => {
      const meData = await me.json(); const foodData = await food.json();
      setProfile(meData.profile ?? demoStore.getProfile() ?? defaultProfile);
      setPantry(foodData.items?.length ? foodData.items : demoStore.getPantry());
    }).catch(() => { setProfile(demoStore.getProfile() ?? defaultProfile); setPantry(demoStore.getPantry()); });
  }, []);

  async function chooseLanguage(lang: "en" | "zh") {
    const response = await fetch("/api/units/suggest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang }) });
    const units = await response.json(); setProfile((p) => ({ ...p, lang, units }));
  }

  function addPantry() {
    const name = newItem.trim(); if (!name) return;
    setPantry((items) => [...items, { name, qtyG: 0 }]); setNewItem("");
  }

  async function finish() {
    setSaving(true); setError("");
    const complete = { ...profile, onboardingComplete: true };
    try {
      const profileResponse = await fetch("/api/me", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(complete) });
      if (!profileResponse.ok) throw new Error("Could not save your profile");
      const pantryResponse = await fetch("/api/pantry", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(pantry) });
      if (!pantryResponse.ok) throw new Error("Could not save pantry items");
      demoStore.setProfile(complete); demoStore.setPantry(pantry); router.push("/cook");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong"); setSaving(false); }
  }

  const headings = ["Choose your language", "Food preferences", "Your kitchen", "What's already at home?", "Shopping range"];
  return <main className="page">
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b>MealDeal</b><span className="muted">{step + 1} / 5</span></header>
    <div style={{ height: 7, background: "#e2e6df", borderRadius: 99, margin: "20px 0 34px" }}><div style={{ width: `${(step + 1) * 20}%`, height: "100%", background: "var(--green)", borderRadius: 99 }} /></div>
    <h1 style={{ fontSize: 34, letterSpacing: "-1.3px" }}>{headings[step]}</h1>
    {step === 0 && <section className="card">
      <p className="muted">This also sets our suggested cooking measurements. You can change them.</p>
      <div className="chips"><button className={`chip ${profile.lang === "en" ? "active" : ""}`} onClick={() => chooseLanguage("en")}>English</button><button className={`chip ${profile.lang === "zh" ? "active" : ""}`} onClick={() => chooseLanguage("zh")}>中文</button></div>
      <label className="field">Weight unit<select value={profile.units.weight} onChange={(e) => setProfile({ ...profile, units: { ...profile.units, weight: e.target.value as UserProfile["units"]["weight"] } })}><option value="g">grams</option><option value="kg">kilograms</option><option value="lb">pounds</option><option value="jin">斤</option></select></label>
      <label className="field">Volume unit<select value={profile.units.volume} onChange={(e) => setProfile({ ...profile, units: { ...profile.units, volume: e.target.value as UserProfile["units"]["volume"] } })}><option value="ml">millilitres</option><option value="l">litres</option><option value="cup">cups</option></select></label>
    </section>}
    {step === 1 && <section className="card">
      <label className="field">Dietary needs<Chips values={options.dietary} selected={profile.dietary} onChange={(dietary) => setProfile({ ...profile, dietary })} /></label>
      <label className="field">Allergies<Chips values={options.allergies} selected={profile.allergies} onChange={(allergies) => setProfile({ ...profile, allergies })} /></label>
      <label className="field">Cuisines you enjoy<Chips values={options.cuisines} selected={profile.cuisines} onChange={(cuisines) => setProfile({ ...profile, cuisines })} /></label>
      <label className="field">Meal balance<select value={profile.meatVegRatio} onChange={(e) => setProfile({ ...profile, meatVegRatio: e.target.value as UserProfile["meatVegRatio"] })}><option value="more_meat">More meat</option><option value="balanced">Balanced</option><option value="more_veg">More vegetables</option><option value="vegetarian">Vegetarian</option></select></label>
      <label className="field">People I usually cook for<input type="number" min="1" max="20" value={profile.defaultServings} onChange={(e) => setProfile({ ...profile, defaultServings: Number(e.target.value) })} /></label>
    </section>}
    {step === 2 && <section className="card"><p className="muted">Pot and stovetop are selected by default.</p><Chips values={options.equipment} selected={profile.equipment} onChange={(equipment) => setProfile({ ...profile, equipment })} /></section>}
    {step === 3 && <section className="card">
      <p className="muted">Add staples or leftovers. Unknown quantities are okay.</p>
      <div style={{ display: "flex", gap: 8 }}><input aria-label="Pantry item" style={{ flex: 1, border: "1px solid #cbd7ce", borderRadius: 14, padding: 13 }} value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPantry(); } }} placeholder="e.g. rice, soy sauce" /><button className="btn" type="button" onClick={addPantry}>Add</button></div>
      <div style={{ display: "grid", gap: 9, marginTop: 18 }}>{pantry.map((item, index) => <div key={`${item.name}-${index}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #edf0eb" }}><span>{item.name}</span><button className="chip" onClick={() => setPantry(pantry.filter((_, i) => i !== index))}>Remove</button></div>)}</div>
    </section>}
    {step === 4 && <section className="card">
      <label className="field">Maximum shopping distance: {profile.maxDistanceKm} km<input type="range" min="0.5" max="15" step="0.5" value={profile.maxDistanceKm} onChange={(e) => setProfile({ ...profile, maxDistanceKm: Number(e.target.value) })} /></label>
      <label className="field">Optional nutrition goal<textarea rows={3} placeholder="e.g. prioritize protein" value={profile.nutritionGoal} onChange={(e) => setProfile({ ...profile, nutritionGoal: e.target.value })} /></label>
    </section>}
    {error && <p style={{ color: "#a32626" }}>{error}</p>}
    <footer style={{ display: "flex", gap: 10, marginTop: 26 }}>
      {step > 0 && <button className="btn secondary" onClick={() => setStep(step - 1)}>Back</button>}
      <button className="btn" style={{ flex: 1 }} disabled={saving} onClick={() => step < 4 ? setStep(step + 1) : finish()}>{step < 4 ? "Continue" : saving ? "Saving…" : "Start planning"}</button>
    </footer>
  </main>;
}
