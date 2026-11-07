"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { demoStore } from "@/lib/demo-store";
import type { PantryItem, UserProfile } from "@/contracts";

export function Preflight() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [pantryChanged, setPantryChanged] = useState<boolean | null>(null);
  const [equipmentChanged, setEquipmentChanged] = useState<boolean | null>(null);
  useEffect(() => {
    const loadSavedKitchen = async () => ({
      profile: demoStore.getProfile(),
      pantry: demoStore.getPantry(),
    });
    loadSavedKitchen().then((saved) => {
      setProfile(saved.profile);
      setPantry(saved.pantry);
    });
  }, []);
  if (!profile?.onboardingComplete) return <main className="page"><h1>Let&apos;s set up your kitchen first.</h1><Link className="btn" href="/onboarding">Start setup</Link></main>;
  const ready = pantryChanged === false && equipmentChanged === false;
  return <main className="page">
    <p style={{ color: "var(--green)", fontWeight: 800 }}>Before we plan</p><h1 style={{ fontSize: 38, letterSpacing: "-1.5px" }}>Anything changed at home?</h1>
    <section className="card" style={{ marginTop: 24 }}><h2>Fridge & pantry</h2><p className="muted">{pantry.length ? pantry.map((x) => x.name).join(", ") : "No ingredients saved yet."}</p><div className="chips"><button className={`chip ${pantryChanged === false ? "active" : ""}`} onClick={() => setPantryChanged(false)}>No changes</button><Link className="chip" href="/onboarding">Update items</Link></div></section>
    <section className="card" style={{ marginTop: 14 }}><h2>Kitchen equipment</h2><p className="muted">{profile.equipment.join(", ")}</p><div className="chips"><button className={`chip ${equipmentChanged === false ? "active" : ""}`} onClick={() => setEquipmentChanged(false)}>No changes</button><Link className="chip" href="/onboarding">Update equipment</Link></div></section>
    <button className="btn" disabled={!ready} style={{ width: "100%", marginTop: 24 }} onClick={() => alert("Profile confirmed. The planning form can now consume this profile.")}>Continue to meal details</button>
  </main>;
}
