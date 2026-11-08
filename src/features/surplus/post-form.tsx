"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { notifySurplusChanged } from "./browser-store";
import { makeSurplusClient, type InventorySource } from "./client";
import type { ListingDraft } from "./inventory";
import { ApiRequestError } from "../community/api-client";
import styles from "../community.module.css";
import { ScreenHeader } from "@/components/screen-header";

export function SurplusPostForm({ source = "local" }: { source?: InventorySource }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const messageFor = (name: string) => fields[name] ?? Object.entries(fields).find(([key]) => key.startsWith(`${name}.`))?.[1];
  const fieldProps = (name: string) => ({
    "aria-invalid": messageFor(name) ? true : undefined,
    "aria-describedby": messageFor(name) ? `listing-${name}-error` : undefined,
  });
  const fieldHint = (name: string) => messageFor(name) && <span className={styles.fieldError} id={`listing-${name}-error`}>{messageFor(name)}</span>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setFields({}); setSaved(false);
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
      await makeSurplusClient(source).post(draft, crypto.randomUUID(), Date.now());
      if (source === "local") notifySurplusChanged();
      setSaved(true); form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your listing. Please try again.");
      if (cause instanceof ApiRequestError) setFields(cause.fields ?? {});
    }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <ScreenHeader backHref={source === "local" ? "/eat-out" : "/eat-out/shared"} />
    <header className={styles.hero}><p className={styles.eyebrow}>EAT OUT / LOCAL DEMO</p><h1>Post a meal</h1><p>Try publishing a surplus food listing. No merchant account is needed for this demo.</p></header>
    <aside className={styles.notice}><strong>Sample listings only.</strong><p>{source === "local" ? "This form saves to this browser." : "This form uses shared storage and requires Auth0 sign-in."} Every posted listing is labeled sample data. No real merchant is contacted and no food or payment is arranged.</p></aside>
    {saved && <p role="status" className={styles.success}>Your sample listing is saved. <Link href={source === "local" ? "/eat-out" : "/eat-out/shared"}>Browse and try reserving it →</Link></p>}
    <form onSubmit={(event) => void submit(event)} className={styles.form}>
      <h2>Listing details</h2>
      <label className={styles.field}>Merchant name<input name="merchantName" {...fieldProps("merchantName")} required maxLength={100} placeholder="Your sample bakery" />{fieldHint("merchantName")}</label>
      <label className={styles.field}>Food title<input name="title" {...fieldProps("title")} required maxLength={150} placeholder="End-of-day bread bag" />{fieldHint("title")}</label>
      <label className={styles.field}>Pickup address<input name="address" {...fieldProps("address")} required maxLength={300} placeholder="A sample Vancouver pickup address" />{fieldHint("address")}</label>
      <div className={styles.grid}><label className={styles.field}>Original price · CAD<input name="origPrice" {...fieldProps("origPrice")} type="number" min="0" max="100000" step="0.01" required />{fieldHint("origPrice")}</label><label className={styles.field}>Surplus price · CAD<input name="price" {...fieldProps("price")} type="number" min="0" max="100000" step="0.01" required />{fieldHint("price")}</label></div>
      <label className={styles.field}>Portions available<input name="qtyLeft" {...fieldProps("qtyLeft")} type="number" min="1" max="10000" step="1" required />{fieldHint("qtyLeft")}</label>
      <div className={styles.grid}><label className={styles.field}>Pickup starts<input name="pickupStart" {...fieldProps("pickupStart")} type="datetime-local" required />{fieldHint("pickupStart")}</label><label className={styles.field}>Pickup ends<input name="pickupEnd" {...fieldProps("pickupEnd")} type="datetime-local" required />{fieldHint("pickupEnd")}</label></div>
      <p className={styles.small}>Enter pickup times in your device’s local timezone. Listings display them in Vancouver time.</p>
      <div className={styles.grid}><label className={styles.field}>Pickup latitude<input name="lat" {...fieldProps("lat")} type="number" min="-90" max="90" step="any" defaultValue="49.266" required />{fieldHint("lat")}</label><label className={styles.field}>Pickup longitude<input name="lng" {...fieldProps("lng")} type="number" min="-180" max="180" step="any" defaultValue="-123.243" required />{fieldHint("lng")}</label></div>
      <p className={styles.small}>The prefilled coordinates are a sample UBC-area position for distance sorting. Update both for your sample pickup location.</p>
      <label className={styles.field}>Allergens · separate with commas<input name="allergens" {...fieldProps("allergens")} maxLength={1000} placeholder="wheat, milk, eggs" />{fieldHint("allergens")}</label>
      <label className={styles.field}>Description · optional<textarea name="description" {...fieldProps("description")} maxLength={1000} rows={3} />{fieldHint("description")}</label>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button className={styles.primary} disabled={busy} type="submit">{busy ? "Saving…" : "Publish sample listing"}</button>
    </form>
  </main>;
}
