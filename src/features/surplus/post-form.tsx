"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { makeBrowserInventory, notifySurplusChanged } from "./browser-store";
import type { ListingDraft } from "./inventory";
import styles from "../community.module.css";

export function SurplusPostForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSaved(false);
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    const number = (key: string) => text(key) === "" ? Number.NaN : Number(text(key));
    try {
      const draft: ListingDraft = {
        merchantName: text("merchantName"), title: text("title"), address: text("address"),
        origPrice: number("origPrice"), price: number("price"), qtyLeft: number("qtyLeft"),
        lat: number("lat"), lng: number("lng"),
        pickupStart: new Date(text("pickupStart")).toISOString(), pickupEnd: new Date(text("pickupEnd")).toISOString(),
        allergens: text("allergens").split(",").map((item) => item.trim()).filter(Boolean), description: text("description"),
      };
      await makeBrowserInventory().post(draft, crypto.randomUUID(), Date.now());
      notifySurplusChanged(); setSaved(true); form.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your listing. Please try again."); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <nav className={styles.nav} aria-label="MealDeal navigation"><Link href="/eat-out">← Surplus listings</Link><Link href="/support">Food support</Link></nav>
    <header className={styles.hero}><p className={styles.eyebrow}>EAT OUT / POST A LISTING</p><h1>Make a little<br />less go to waste.</h1><p>Try publishing a surplus food listing. No merchant account is needed for this demo.</p></header>
    <aside className={styles.notice}><strong>Sample listings only.</strong><p>This form saves to this browser. Every posted listing is labeled sample data. No real merchant is contacted and no food or payment is arranged.</p></aside>
    {saved && <p role="status" className={styles.success}>Your sample listing is saved. <Link href="/eat-out">Browse and try reserving it →</Link></p>}
    <form onSubmit={(event) => void submit(event)} className={styles.form}>
      <h2>Listing details</h2>
      <label className={styles.field}>Merchant name<input name="merchantName" required maxLength={100} placeholder="Your sample bakery" /></label>
      <label className={styles.field}>Food title<input name="title" required maxLength={150} placeholder="End-of-day bread bag" /></label>
      <label className={styles.field}>Pickup address<input name="address" required maxLength={300} placeholder="A sample Vancouver pickup address" /></label>
      <div className={styles.grid}><label className={styles.field}>Original price · CAD<input name="origPrice" type="number" min="0" max="100000" step="0.01" required /></label><label className={styles.field}>Surplus price · CAD<input name="price" type="number" min="0" max="100000" step="0.01" required /></label></div>
      <label className={styles.field}>Portions available<input name="qtyLeft" type="number" min="1" max="10000" step="1" required /></label>
      <div className={styles.grid}><label className={styles.field}>Pickup starts<input name="pickupStart" type="datetime-local" required /></label><label className={styles.field}>Pickup ends<input name="pickupEnd" type="datetime-local" required /></label></div>
      <p className={styles.small}>Enter pickup times in your device’s local timezone. Listings display them in Vancouver time.</p>
      <div className={styles.grid}><label className={styles.field}>Pickup latitude<input name="lat" type="number" min="-90" max="90" step="any" defaultValue="49.266" required /></label><label className={styles.field}>Pickup longitude<input name="lng" type="number" min="-180" max="180" step="any" defaultValue="-123.243" required /></label></div>
      <p className={styles.small}>The prefilled coordinates are a sample UBC-area position for distance sorting. Update both for your sample pickup location.</p>
      <label className={styles.field}>Allergens · separate with commas<input name="allergens" maxLength={1000} placeholder="wheat, milk, eggs" /></label>
      <label className={styles.field}>Description · optional<textarea name="description" maxLength={1000} rows={3} /></label>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button className={styles.primary} disabled={busy} type="submit">{busy ? "Saving…" : "Publish sample listing"}</button>
    </form>
  </main>;
}
