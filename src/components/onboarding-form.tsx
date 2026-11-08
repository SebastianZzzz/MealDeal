"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { demoStore } from "@/lib/demo-store";
import { readApiError } from "@/lib/api-error";
import { dietaryFieldErrors, normalizeDietary, withDietary } from "@/lib/profile-validation";
import { PANTRY_AMOUNTS, guessPantryKind, type PantryAmount } from "@/lib/pantry-amounts";
import { defaultProfile, type PantryItem, type UserProfile } from "@/contracts";
import { RangeField } from "@/components/range-field";
import { classifyCustomChoice, formatProblem, type ChoiceKind } from "@/lib/custom-choices";
import { SupportMap } from "@/features/support/support-map";
import { LocateFixed, Trash2, X } from "lucide-react";

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

const NUTRITION_GOALS = ["High protein", "Balanced", "Low calorie"];

// Optional free-text entry under a group of choices: adds the item and selects it.
function OtherInput({ kind, label, values, selected, note, onNote, onAdd, onSelect }: {
  kind: ChoiceKind; label: string; values: string[]; selected: string[]; note: string; onNote: (note: string) => void;
  onAdd: (value: string) => void; onSelect: (value: string) => void;
}) {
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  // Known words are added at once; unusual ones are checked by the server (smallest model).
  async function allowed(value: string) {
    const verdict = classifyCustomChoice(kind, value);
    if (verdict === "bad-format") { onNote(formatProblem(kind)); return false; }
    if (verdict === "ok") return true;
    setChecking(true);
    onNote(`Checking "${value}"…`);
    try {
      const response = await fetch("/api/choices/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, value }) });
      if (!response.ok) { onNote((await readApiError(response)).error); return false; }
      const result = await response.json() as { ok: boolean; message?: string };
      if (!result.ok) onNote(result.message ?? "That doesn't look like something plans can use.");
      return result.ok;
    } catch {
      // Fail closed: the server re-checks on save anyway.
      onNote(`We couldn't check "${value}" right now. Try again in a minute, or pick from the list.`);
      return false;
    } finally {
      setChecking(false);
    }
  }
  async function add() {
    const value = text.trim().replace(/\s+/g, " ");
    if (!value) return;
    const existing = values.find((item) => item.toLowerCase() === value.toLowerCase());
    if (!existing && !(await allowed(value))) return;
    if (existing && selected.includes(existing)) onNote(`${existing} is already in the list.`);
    else if (existing) { onSelect(existing); onNote(`${existing} was already in the list, so it is selected now.`); }
    else { onAdd(value); onSelect(value); onNote(`${value} added and selected.`); }
    setText("");
  }
  return <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
    <div style={{ display: "flex", gap: 8 }}>
      <input aria-label={`Other ${label}`} placeholder="Other (optional)" maxLength={40} autoComplete="off" autoCorrect="off" spellCheck={false} value={text} onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void add(); } }}
        className="text-input" style={{ flex: 1, minWidth: 0 }} />
      <button type="button" className="btn secondary" disabled={!text.trim() || checking} onClick={() => void add()}>{checking ? "…" : "Add"}</button>
    </div>
    <span className="muted" role="status" style={{ fontSize: 14, fontWeight: 400, minHeight: 20 }}>{note}</span>
  </div>;
}

// Custom items (added with "Other") stay as chips while editing, even when unselected, so a mis-tap is
// easy to undo. Their x removes them for good; unselected ones are simply not saved.
function Chips({ values, selected, onChange, custom = [], onRemove }: { values: string[]; selected: string[]; onChange: (value: string[]) => void; custom?: string[]; onRemove?: (value: string) => void }) {
  const all = [...new Set([...values, ...custom, ...selected])];
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  return <div className="chips">{all.map((value) => {
    if (!onRemove || values.includes(value)) {
      return <button type="button" key={value} className="chip" aria-pressed={selected.includes(value)} onClick={() => toggle(value)}>{value}</button>;
    }
    return <span key={value} className="chip chip-custom" data-pressed={selected.includes(value)}>
      <button type="button" className="chip-toggle" aria-pressed={selected.includes(value)} onClick={() => toggle(value)}>{value}</button>
      <button type="button" className="chip-remove" aria-label={`Remove ${value}`} onClick={() => onRemove(value)}><X size={14} strokeWidth={2.6} /></button>
    </span>;
  })}</div>;
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
  const [custom, setCustom] = useState<Record<"dietary" | "allergies" | "equipment" | "goal", string[]>>({ dietary: [], allergies: [], equipment: [], goal: [] });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const note = (key: string) => (text: string) => setNotes((current) => ({ ...current, [key]: text }));
  const [locating, setLocating] = useState(false);
  const [postal, setPostal] = useState("");
  const [placeNote, setPlaceNote] = useState("");
  const [placeError, setPlaceError] = useState(false);
  // Opened from the kitchen check to change one thing: show "Save changes" on that step.
  const [editingOne, setEditingOne] = useState(false);
  const addCustom = (key: keyof typeof custom, value: string) => setCustom((current) => ({ ...current, [key]: current[key].includes(value) ? current[key] : [...current[key], value] }));
  const dropCustom = (key: keyof typeof custom, value: string) => setCustom((current) => ({ ...current, [key]: current[key].filter((item) => item !== value) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [serverFields, setServerFields] = useState<Record<string, string>>({});
  const preferenceFields = dietaryFieldErrors(profile);
  const fields = { ...serverFields, ...preferenceFields };

  useEffect(() => {
    // /onboarding?step=4 opens one step directly (the kitchen check links here).
    const requested = Number(new URLSearchParams(window.location.search).get("step"));
    if (Number.isInteger(requested) && requested >= 1 && requested <= 5) Promise.resolve().then(() => { setStep(requested - 1); setEditingOne(true); });
  }, []);

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
    const name = newItem.trim().replace(/\s+/g, " ");
    if (!name) return;
    const existing = pantry.find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (existing) setNotes((current) => ({ ...current, pantry: `${existing.name} is already in your pantry.` }));
    else {
      setPantry((items) => [...items, { name, qtyG: 0, kind: guessPantryKind(name), amount: "unknown" }]);
      setNotes((current) => ({ ...current, pantry: `${name} added.` }));
    }
    setNewItem("");
  }

  function removePantry(index: number) {
    const removed = pantry[index];
    setPantry((items) => items.filter((_, itemIndex) => itemIndex !== index));
    if (removed) setNotes((current) => ({ ...current, pantry: `${removed.name} removed.` }));
  }

  async function describe(lat: number, lng: number) {
    try {
      const response = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      if (!response.ok) return null;
      return (await response.json() as { area: string | null }).area;
    } catch {
      return null;
    }
  }

  function setFromCurrentLocation() {
    setPlaceError(false);
    if (!navigator.geolocation) { setPlaceError(true); setPlaceNote("This browser can't share a location. Enter a postal code instead."); return; }
    setLocating(true);
    setPlaceNote("Finding you…");
    navigator.geolocation.getCurrentPosition(async (position) => {
      const home = { lat: Math.round(position.coords.latitude * 1000) / 1000, lng: Math.round(position.coords.longitude * 1000) / 1000 };
      setProfile((current) => ({ ...current, home }));
      const area = await describe(home.lat, home.lng);
      setPlaceNote(area ? `Found you near ${area}. Not right? Enter a postal code.` : "Found your location (shown on the map). Not right? Enter a postal code.");
      setLocating(false);
    }, (failure) => {
      setPlaceError(true);
      setPlaceNote(failure.code === failure.PERMISSION_DENIED
        ? "Location access is off for this site. Allow it (iPhone: Settings > Privacy > Location Services > Safari Websites), or enter a postal code."
        : failure.code === failure.TIMEOUT ? "Finding your location took too long. Try again, or enter a postal code." : "Your location isn't available right now. Enter a postal code instead.");
      setLocating(false);
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  }

  async function setFromPostal() {
    if (!postal.trim()) return;
    setLocating(true);
    try {
      const response = await fetch(`/api/geocode?postal=${encodeURIComponent(postal.trim())}`);
      if (!response.ok) throw new Error((await readApiError(response)).error);
      const place = await response.json() as { lat: number; lng: number; postal: string; area: string | null };
      setProfile((current) => ({ ...current, home: { lat: place.lat, lng: place.lng } }));
      setPlaceError(false);
      setPlaceNote(`Shopping area set near ${place.postal}${place.area ? ` (${place.area})` : ""}.`);
    } catch (cause) {
      setPlaceError(true);
      setPlaceNote(cause instanceof Error ? cause.message : "Could not find that postal code.");
    } finally {
      setLocating(false);
    }
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

  const headings = ["Units", "Food preferences", "Your equipment", "Your pantry", "Shopping range"];
  return <main className="page onboarding-page">
    <header className="onboarding-header"><span className="muted">STEP {step + 1} OF 5</span></header>
    <div className="onboarding-progress"><div style={{ width: `${(step + 1) * 20}%` }} /></div>
    <p className="planning-eyebrow">MAKE MEALDEAL YOURS</p>
    <h1>{headings[step]}</h1>
    {step === 0 && <section className="onboarding-section">
      <p className="muted">Choose how recipe quantities are displayed. MealDeal currently uses English.</p>
      <label className="field">Weight unit<select value={profile.units.weight} onChange={(event) => setProfile({ ...profile, units: { ...profile.units, weight: event.target.value as UserProfile["units"]["weight"] } })}><option value="g">grams (g)</option><option value="kg">kilograms (kg)</option><option value="lb">pounds (lb)</option><option value="oz">ounces (oz)</option><option value="jin">jin (500 g)</option></select></label>
      <label className="field">Volume unit<select value={profile.units.volume} onChange={(event) => setProfile({ ...profile, units: { ...profile.units, volume: event.target.value as UserProfile["units"]["volume"] } })}><option value="ml">millilitres (ml)</option><option value="l">litres (l)</option><option value="cup">cups</option><option value="fl_oz">fluid ounces (fl oz)</option></select></label>
    </section>}
    {step === 1 && <section className="onboarding-section">
      <p className="muted">Rules every plan must follow. You pick cuisines and the meat/veg balance each time you plan.</p>
      <div className="field" role="group" aria-label="Dietary needs">Dietary needs<Chips values={options.dietary} custom={custom.dietary} onRemove={(value) => { dropCustom("dietary", value); note("dietary")(`${value} removed.`); setProfile(withDietary(profile, profile.dietary.filter((item) => item !== value))); }} selected={profile.dietary} onChange={(dietary) => { setProfile(withDietary(profile, dietary)); setServerFields({}); }} />{(fields.dietary || fields.meatVegRatio) && <span style={fieldErrorStyle}>{fields.dietary || fields.meatVegRatio}</span>}<OtherInput kind="dietary" label="dietary need" values={[...options.dietary, ...custom.dietary]} selected={profile.dietary} note={notes.dietary ?? ""} onNote={note("dietary")} onAdd={(value) => addCustom("dietary", value)} onSelect={(value) => setProfile(withDietary(profile, profile.dietary.includes(value) ? profile.dietary : [...profile.dietary, value]))} /></div>
      <div className="field" role="group" aria-label="Allergies">Allergies<Chips values={options.allergies} custom={custom.allergies} onRemove={(value) => { dropCustom("allergies", value); note("allergies")(`${value} removed.`); setProfile({ ...profile, allergies: profile.allergies.filter((item) => item !== value) }); }} selected={profile.allergies} onChange={(allergies) => setProfile({ ...profile, allergies })} /><OtherInput kind="allergy" label="allergy" values={[...options.allergies, ...custom.allergies]} selected={profile.allergies} note={notes.allergies ?? ""} onNote={note("allergies")} onAdd={(value) => addCustom("allergies", value)} onSelect={(value) => setProfile({ ...profile, allergies: profile.allergies.includes(value) ? profile.allergies : [...profile.allergies, value] })} /></div>
      <RangeField id="default-servings" label="People I usually cook for" value={profile.defaultServings} min={1} max={8} onChange={(defaultServings) => { setProfile({ ...profile, defaultServings }); setServerFields((current) => ({ ...current, defaultServings: "" })); }} />{fields.defaultServings && <span style={fieldErrorStyle}>{fields.defaultServings}</span>}
    </section>}
    {step === 2 && <section className="onboarding-section"><p className="muted">Pot and stovetop are selected by default.</p><Chips values={options.equipment} custom={custom.equipment} onRemove={(value) => { dropCustom("equipment", value); note("equipment")(`${value} removed.`); setProfile({ ...profile, equipment: profile.equipment.filter((item) => item !== value) }); }} selected={profile.equipment} onChange={(equipment) => setProfile({ ...profile, equipment })} /><OtherInput kind="equipment" label="equipment" values={[...options.equipment, ...custom.equipment]} selected={profile.equipment} note={notes.equipment ?? ""} onNote={note("equipment")} onAdd={(value) => addCustom("equipment", value)} onSelect={(value) => setProfile({ ...profile, equipment: profile.equipment.includes(value) ? profile.equipment : [...profile.equipment, value] })} /></section>}
    {step === 3 && <section className="onboarding-section">
      <p className="muted">Add staples or leftovers. Rough is fine: we use it to decide how much to buy. Seasonings like soy sauce just need to be on the list.</p>
      <div style={{ display: "flex", gap: 8 }}><input aria-label="Pantry item" className="text-input" autoComplete="off" maxLength={60} style={{ flex: 1, minWidth: 0 }} value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addPantry(); } }} placeholder="e.g. rice, soy sauce" /><button className="btn secondary" type="button" disabled={!newItem.trim()} onClick={addPantry}>Add</button></div>
      <span className="muted" role="status" style={{ display: "block", fontSize: 14, minHeight: 20, marginTop: 6 }}>{notes.pantry ?? ""}</span>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>{pantry.map((item, index) => {
        const kind = item.kind ?? guessPantryKind(item.name);
        const amount: PantryAmount = item.amount ?? "unknown";
        return <div key={`${item.name}-${index}`} className="pantry-item">
          <div className="pantry-item-head">
            <b>{item.name}{item.qtyG > 0 && <span className="muted" style={{ fontWeight: 400 }}> · {item.qtyG} g</span>}</b>
            <button type="button" className="icon-btn" aria-label={`Remove ${item.name}`} onClick={() => removePantry(index)}><Trash2 size={18} /></button>
          </div>
          <div className="segmented" role="group" aria-label={`${item.name} is a`}>
            {(["ingredient", "seasoning"] as const).map((value) => <button type="button" key={value} aria-pressed={kind === value} onClick={() => updatePantry(index, { kind: value })}>{value === "ingredient" ? "Ingredient" : "Seasoning"}</button>)}
          </div>
          {kind === "seasoning"
            ? <span className="muted" style={{ fontSize: 14 }}>Have it. Recipes only use a little, so we never buy more.</span>
            : <div className="segmented segmented-4" role="group" aria-label={`How much ${item.name}`}>{PANTRY_AMOUNTS.map((option) => <button type="button" key={option.value} aria-pressed={amount === option.value} onClick={() => updatePantry(index, { amount: option.value, qtyG: 0 })}>{option.label}</button>)}</div>}
        </div>;
      })}</div>
      {fields._ && <p style={fieldErrorStyle}>{fields._}</p>}
    </section>}
    {step === 4 && <section className="onboarding-section">
      <div className="field" role="group" aria-label="Where you shop from">Where do you shop from?
        <p className="muted" style={{ margin: 0, fontWeight: 400, fontSize: 15 }}>We use this to pick stores within your distance. Only an area (about 100 m) is saved.</p>
        <button type="button" className="btn secondary" disabled={locating} onClick={setFromCurrentLocation}><LocateFixed aria-hidden="true" />{locating ? "Finding you…" : "Use my location"}</button>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="text-input" style={{ flex: 1, minWidth: 0 }} aria-label="Postal code" placeholder="or postal code, e.g. V6T 1Z4" maxLength={7} autoComplete="postal-code" value={postal}
            onChange={(event) => setPostal(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void setFromPostal(); } }} />
          <button type="button" className="btn secondary" disabled={locating || !postal.trim()} onClick={() => void setFromPostal()}>Set</button>
        </div>
        <span role="status" style={{ fontWeight: placeError ? 700 : 400, fontSize: 14, minHeight: 20, color: placeError ? "var(--danger)" : "var(--muted)" }}>{placeNote || (profile.home ? "Shopping area saved (shown below)." : "No shopping area yet: plans use stores near UBC.")}</span>
        {profile.home && <div className="area-map"><SupportMap points={[{ id: "home", label: "•", name: "Your shopping area", lat: profile.home.lat, lng: profile.home.lng }]} onSelect={() => undefined} /></div>}
        {profile.home && <button type="button" className="btn text" style={{ justifySelf: "start" }} onClick={() => { setProfile({ ...profile, home: null }); setPlaceNote("Shopping area cleared."); }}>Clear shopping area</button>}
      </div>
      <RangeField id="max-distance" label="Shopping distance" value={profile.maxDistanceKm} min={0.5} max={15} step={0.5} format={(value) => `${value} km`} onChange={(maxDistanceKm) => setProfile({ ...profile, maxDistanceKm })} />
      <div className="field" role="group" aria-label="Nutrition goal">Nutrition goal (optional)<Chips values={NUTRITION_GOALS} custom={custom.goal} onRemove={(value) => { dropCustom("goal", value); note("goal")(`${value} removed.`); if (profile.nutritionGoal === value) setProfile({ ...profile, nutritionGoal: "" }); }} selected={profile.nutritionGoal ? [profile.nutritionGoal] : []} onChange={(picked) => setProfile({ ...profile, nutritionGoal: picked.filter((item) => item !== profile.nutritionGoal)[0] ?? "" })} /><OtherInput kind="goal" label="nutrition goal" values={[...NUTRITION_GOALS, ...custom.goal]} selected={profile.nutritionGoal ? [profile.nutritionGoal] : []} note={notes.goal ?? ""} onNote={note("goal")} onAdd={(value) => addCustom("goal", value)} onSelect={(nutritionGoal) => setProfile({ ...profile, nutritionGoal })} /></div>
    </section>}
    {error && <p role="alert" style={{ color: "#a32626" }}>{error}</p>}
    <footer style={{ display: "flex", gap: 10, marginTop: 26 }}>
      {step > 0 && !editingOne && <button type="button" className="btn secondary" onClick={() => { setStep(step - 1); setError(""); setServerFields({}); }}>← Previous</button>}
      {editingOne
        ? <button type="button" className="btn primary" style={{ flex: 1 }} disabled={saving || (step === 1 && Object.keys(preferenceFields).length > 0)} onClick={() => void finish()}>{saving ? "Saving…" : "Save changes"}</button>
        : <button type="button" className="btn primary" style={{ flex: 1 }} disabled={saving || (step === 1 && Object.keys(preferenceFields).length > 0)} onClick={() => step < 4 ? continueOnboarding() : void finish()}>{step < 4 ? "Continue" : saving ? "Saving…" : "Start planning"}</button>}
    </footer>
  </main>;
}
