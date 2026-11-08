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
  return <main className="page">
    <ScreenHeader backHref="/" />
    <p className="planning-eyebrow">BEFORE WE PLAN</p>
    <h1>Kitchen check</h1>
    <p className="muted">Plans use what is below. Update anything that is out of date, or go straight to planning.</p>
    <section className="card" style={{ marginTop: 24 }}>
      <p className="planning-eyebrow" style={{ marginTop: 0 }}>01 · INGREDIENTS</p><h2>Fridge & pantry</h2>
      <p className="muted">{pantry.length ? pantry.map((item) => item.name).join(", ") : "Nothing saved yet. Add what you have so plans can use it for free."}</p>
      <Link className="btn secondary" style={{ width: "100%" }} href="/onboarding?step=4">Update pantry</Link>
    </section>
    <section className="card" style={{ marginTop: 14 }}>
      <p className="planning-eyebrow" style={{ marginTop: 0 }}>02 · EQUIPMENT</p><h2>Kitchen equipment</h2><p className="muted">{profile.equipment.join(", ") || "Nothing selected yet."}</p>
      <Link className="btn secondary" style={{ width: "100%" }} href="/onboarding?step=3">Update equipment</Link>
    </section>
    <Link className="btn primary planning-full" href="/cook/plan">Plan a meal →</Link>
  </main>;
}
