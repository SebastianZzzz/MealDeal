"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { demoStore } from "@/lib/demo-store";
import type { PantryItem, UserProfile } from "@/contracts";

export function Preflight() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pantryConfirmed, setPantryConfirmed] = useState(false);
  const [equipmentConfirmed, setEquipmentConfirmed] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        setProfile(demoStore.getProfile());
        setPantry(demoStore.getPantry());
      } catch {
        setProfile(null);
      }
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return <main className="page"><p role="status">Loading your kitchen…</p></main>;
  }
  if (!profile?.onboardingComplete) {
    return <main className="page"><h1>Let&apos;s set up your kitchen first.</h1><Link className="btn" href="/onboarding">Start setup</Link></main>;
  }
  const ready = pantryConfirmed && equipmentConfirmed;
  return <main className="page">
    <p style={{ color: "var(--green)", fontWeight: 800 }}>Before we plan</p>
    <h1 style={{ fontSize: 38, letterSpacing: "-1.5px" }}>Anything changed at home?</h1>
    <section className="card" style={{ marginTop: 24 }}>
      <h2>Fridge & pantry</h2>
      <p className="muted">{pantry.length ? pantry.map((item) => item.name).join(", ") : "No ingredients saved yet."}</p>
      <div className="chips">
        <button className={`chip ${pantryConfirmed ? "active" : ""}`} aria-pressed={pantryConfirmed} onClick={() => setPantryConfirmed(true)}>No changes</button>
        <Link className="chip" href="/onboarding">Update items</Link>
      </div>
    </section>
    <section className="card" style={{ marginTop: 14 }}>
      <h2>Kitchen equipment</h2><p className="muted">{profile.equipment.join(", ")}</p>
      <div className="chips">
        <button className={`chip ${equipmentConfirmed ? "active" : ""}`} aria-pressed={equipmentConfirmed} onClick={() => setEquipmentConfirmed(true)}>No changes</button>
        <Link className="chip" href="/onboarding">Update equipment</Link>
      </div>
    </section>
    <Link className={`btn planning-full ${ready ? "" : "planning-disabled"}`} href={ready ? "/cook/plan" : "#"} aria-disabled={!ready} onClick={(event) => {
      if (!ready) {
        event.preventDefault();
      }
    }}>Continue to meal details</Link>
  </main>;
}
