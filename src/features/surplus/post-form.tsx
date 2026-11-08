"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ZodError } from "zod";
import samples from "../../../mock/surplus-listings.json";
import { RangeField } from "@/components/range-field";
import { notifySurplusChanged } from "./browser-store";
import { makeSurplusClient, type InventorySource } from "./client";
import { ApiRequestError } from "../community/api-client";
import { buildSampleDraft, PICKUP_DELAYS, PICKUP_DURATIONS, type SampleMeal, type SampleChoices } from "./sample-draft";
import { money } from "./presentation";
import { DishArt } from "./dish-art";
import { SurplusFeedback, type Feedback } from "./feedback";
import styles from "./surplus.module.css";

async function publishSample(source: InventorySource, meal: SampleMeal, choices: SampleChoices) {
  const now = Date.now();
  const draft = buildSampleDraft(meal, choices, now);
  return makeSurplusClient(source).post(draft, crypto.randomUUID(), now);
}

export function SurplusPostForm({ source = "local" }: { source?: InventorySource }) {
  const [mealId, setMealId] = useState(samples[0].id);
  const meal = samples.find((sample) => sample.id === mealId) ?? samples[0];
  const [price, setPrice] = useState(meal.price);
  const [origPrice, setOrigPrice] = useState(meal.origPrice);
  const [qtyLeft, setQtyLeft] = useState(meal.qtyLeft);
  const [delay, setDelay] = useState(30);
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const browseHref = source === "local" ? "/eat-out" : "/eat-out/shared";

  function chooseMeal(id: string) {
    const next = samples.find((sample) => sample.id === id);
    if (next) {
      setMealId(id); setPrice(next.price); setOrigPrice(next.origPrice); setQtyLeft(next.qtyLeft);
      setFeedback({ tone: "success", content: <><strong>{next.title}</strong> selected.</> });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setFeedback({ tone: "progress", content: "Publishing sample meal…" });
    try {
      await publishSample(source, meal, { price, origPrice, qtyLeft, delay, duration });
      if (source === "local") {
        notifySurplusChanged();
      }
      setFeedback({ tone: "success", content: <><strong>{meal.title}</strong> published. <Link href={browseHref}>View meals</Link></> });
    } catch (cause) {
      let content = cause instanceof Error ? cause.message : "Could not publish. Your choices are kept. Try again.";
      if (cause instanceof ApiRequestError && cause.fields && Object.keys(cause.fields).length) {
        content = Object.values(cause.fields).join(" ");
      }
      if (cause instanceof ZodError) {
        content = cause.issues.map((issue) => issue.message).join(" ");
      }
      setFeedback({ tone: "error", content });
    } finally {
      setBusy(false);
    }
  }

  return <main className={`page ${styles.page} ${styles.postPage}`}>
    <header className={styles.hero}><p className="planning-eyebrow">Eat out / sample listing</p><h1>Share a spare meal.</h1><p>Choose a sample. Set the price and pickup.</p></header>
    <aside className="planning-notice"><strong>Fictional meals only.</strong><br />{source === "local" ? "Saved in this browser." : "Shared storage. Sign-in required."} No merchant is contacted or food arranged.</aside>
    <form id="sample-meal-form" onSubmit={handleSubmit}>
      <fieldset disabled={busy} className={styles.formFields}>
        <div className="field"><label htmlFor="sample-meal">Sample meal</label><select id="sample-meal" value={mealId} onChange={(event) => chooseMeal(event.target.value)}>{samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.title} · {sample.merchantName}</option>)}</select></div>
        <section className={`card ${styles.preview}`} aria-label="Sample meal details">
          <DishArt id={meal.id} title={meal.title} />
          <h2>{meal.title}</h2><p>{meal.merchantName}</p><p>{meal.address}</p>
          <p><strong>Allergens:</strong> {meal.allergens.length ? meal.allergens.join(", ") : "None declared; not guaranteed allergen-free."}</p>
        </section>
        <section className={`card ${styles.formCard}`} aria-labelledby="meal-price-heading"><h2 id="meal-price-heading">Price & portions</h2>
          <RangeField id="listing-original-price" label="Original price · CAD" value={origPrice} min={1} max={50} step={0.01} buttonStep={1} format={money} onChange={(value) => {
            setOrigPrice(value); setPrice((current) => Math.min(current, value));
            setFeedback({ tone: "success", content: <>Original price set to <strong>{money(value)}</strong>. Surplus price stays at or below it.</> });
          }} />
          <RangeField id="listing-price" label="Surplus price · CAD" value={price} min={0} max={origPrice} step={0.01} buttonStep={1} format={money} onChange={(value) => {
            setPrice(value); setFeedback({ tone: "success", content: <>Surplus price set to <strong>{money(value)}</strong>.</> });
          }} />
          <RangeField id="listing-quantity" label="Portions available" value={qtyLeft} min={1} max={20} onChange={(value) => {
            setQtyLeft(value); setFeedback({ tone: "success", content: <><strong>{value} portions</strong> available.</> });
          }} />
        </section>
        <section className={`card ${styles.formCard}`} aria-labelledby="meal-pickup-heading"><h2 id="meal-pickup-heading">Pickup window</h2>
          <div className="field"><label htmlFor="pickup-delay">Starts</label><select id="pickup-delay" value={delay} onChange={(event) => {
            const value = Number(event.target.value); setDelay(value);
            setFeedback({ tone: "success", content: <>Pickup starts <strong>{value === 0 ? "when published" : `${value} minutes after publishing`}</strong>.</> });
          }}>{PICKUP_DELAYS.map((value) => <option key={value} value={value}>{value === 0 ? "When published" : `${value} minutes after publishing`}</option>)}</select></div>
          <div className="field"><label htmlFor="pickup-duration">Stays open for</label><select id="pickup-duration" value={duration} onChange={(event) => {
            const value = Number(event.target.value); setDuration(value);
            setFeedback({ tone: "success", content: <>Pickup stays open for <strong>{value} minutes</strong>.</> });
          }}>{PICKUP_DURATIONS.map((value) => <option key={value} value={value}>{value} minutes</option>)}</select></div>
          <p className={styles.hint}>The window starts relative to publishing. Meals display Vancouver time.</p>
        </section>
      </fieldset>
    </form>
    <div className={styles.actionBar}>
      <div className={styles.actionInner}>
        <SurplusFeedback feedback={feedback} />
        <div className={styles.actionButtons}><Link className="btn" href={browseHref}>Cancel</Link><button className="btn primary" type="submit" form="sample-meal-form" disabled={busy}>{busy ? "Publishing…" : "Publish sample"}</button></div>
      </div>
    </div>
  </main>;
}
