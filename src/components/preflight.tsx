"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { demoStore } from "@/lib/demo-store";
import type { PantryItem, UserProfile } from "@/contracts";
import { Brand } from "@/components/brand";
import { ScreenHeader } from "@/components/screen-header";

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
    return <main className="page"><Brand /><p className="planning-eyebrow">WELCOME TO YOUR KITCHEN</p><h1>Let&apos;s set up your kitchen first.</h1><p className="muted">Tell us what you eat, what you have, and the tools you cook with.</p><Link className="btn planning-full" href="/onboarding">Start kitchen setup →</Link></main>;
  }
  const ready = pantryConfirmed && equipmentConfirmed;
  return <main className="page">
    <ScreenHeader backHref="/" />
    <p className="planning-eyebrow">BEFORE WE PLAN</p>
    <h1>Kitchen check</h1>
    <p className="muted">Confirm what you have before we plan.</p>
    <section className="card" style={{ marginTop: 24 }}>
      <p className="planning-eyebrow" style={{ marginTop: 0 }}>01 · INGREDIENTS</p><h2>Fridge & pantry</h2>
      <p className="muted">{pantry.length ? pantry.map((item) => item.name).join(", ") : "No ingredients saved yet."}</p>
      <div className="chips">
        <button className={`chip ${pantryConfirmed ? "active" : ""}`} aria-pressed={pantryConfirmed} onClick={() => setPantryConfirmed(true)}>No changes</button>
        <Link className="chip" href="/onboarding">Update items</Link>
      </div>
    </section>
    <section className="card" style={{ marginTop: 14 }}>
      <p className="planning-eyebrow" style={{ marginTop: 0 }}>02 · EQUIPMENT</p><h2>Kitchen equipment</h2><p className="muted">{profile.equipment.join(", ")}</p>
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
