"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SurplusListing } from "@/types";
import { notifySurplusChanged, SURPLUS_CHANGED } from "./browser-store";
import { makeSurplusClient, type InventorySource } from "./client";
import { distanceKm, SURPLUS_KEY } from "./inventory";
import styles from "../community.module.css";
import { ScreenHeader } from "@/components/screen-header";

const money = (amount: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount);
const pickup = (value: string) => new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Vancouver", timeZoneName: "short" }).format(new Date(value));

export function SurplusView({ source = "local" }: { source?: InventorySource }) {
  const [items, setItems] = useState<SurplusListing[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sort, setSort] = useState("price");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await makeSurplusClient(source).list();
        if (active) { setItems(next); setReady(true); setNow(Date.now()); }
      } catch (cause) { if (active) { setError(cause instanceof Error ? cause.message : "Listings could not be loaded."); setReady(true); } }
    };
    void load();
    const storage = (event: StorageEvent) => { if (event.key === SURPLUS_KEY || event.key === null) void load(); };
    const refresh = () => { void load(); };
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener("storage", storage);
    window.addEventListener(SURPLUS_CHANGED, refresh);
    return () => { active = false; window.clearInterval(tick); window.removeEventListener("storage", storage); window.removeEventListener(SURPLUS_CHANGED, refresh); };
  }, [source]);

  async function reserve(item: SurplusListing) {
    setBusy(item.id); setError(""); setMessage("");
    try {
      const inventory = makeSurplusClient(source);
      const result = await inventory.reserve(item.id, Date.now);
      // Report a confirmed reservation even if refreshing the list later fails.
      if (result.ok) {
        setItems((current) => current.map((entry) => entry.id === item.id ? result.listing : entry));
        setMessage(`${result.listing.isSample ? "Sample reservation" : "Reservation"} recorded for ${item.title}. ${result.listing.qtyLeft} left.${result.listing.isSample ? " This is a simulation; no real food has been held." : " Pay at pickup; there is no online payment."}`);
      }
      else setError(result.reason === "sold_out" ? "The last portion was just reserved. Please choose another listing." : result.reason === "expired" ? "This pickup window has ended." : "This listing is no longer available.");
      if (source === "local") notifySurplusChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reserve this listing. Nothing was confirmed."); }
    finally { setBusy(null); }
  }

  function locate() {
    setError("");
    if (!navigator.geolocation) { setError("Location is unavailable. You can still browse by price."); return; }
    navigator.geolocation.getCurrentPosition((position) => {
      setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude }); setSort("distance");
    }, () => setError("Location could not be obtained. You can still browse by price."), { timeout: 10000, maximumAge: 60000 });
  }

  const sorted = [...items].sort((a, b) => sort === "distance" && origin ? distanceKm(origin, a) - distanceKm(origin, b) : a.price - b.price);
  return <main className={styles.page}>
    <ScreenHeader backHref="/" />
    <header className={styles.hero}><p className={styles.eyebrow}>EAT OUT / SURPLUS FOOD</p><h1>Surplus meals</h1><p>Browse end-of-day meals and save a portion for pickup.</p></header>
    <aside className={styles.notice}><strong>{source === "local" ? "Local demo — no real reservations." : "Shared inventory preview"}</strong><p>{source === "local" ? "Sample merchants and any listings you post are stored only in this browser. Reservations are simulated across its tabs. There is no payment or real merchant fulfilment." : "Listings are read from the shared service. Entries labeled sample data do not represent real merchants or food holds. Sign in to post or reserve."}</p><Link href={source === "local" ? "/eat-out/shared" : "/eat-out"}>{source === "local" ? "Open shared inventory preview →" : "Use the local demo →"}</Link></aside>
    <div className={styles.toolbar}><label className={styles.field}>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="price">Lowest price</option><option value="distance" disabled={!origin}>Nearest to me</option></select></label><button className={styles.secondary} onClick={locate}>Use my location</button><Link className={styles.primary} href={source === "local" ? "/eat-out/post" : "/eat-out/shared/post"}>Post a sample listing</Link></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status" className={styles.success}>{message}</p>}
    {!ready && <p role="status">Loading surplus listings…</p>}
    <div className={styles.cards}>{sorted.map((item) => {
      const expired = Date.parse(item.pickupEnd) <= now;
      return <article key={item.id} className={styles.card}>
        {item.isSample && <span className={styles.tag}>SAMPLE DATA</span>}<span className={styles.tag}>{expired ? "Pickup ended" : item.qtyLeft === 0 ? "Sold out" : `${item.qtyLeft} left`}</span>
        <h2>{item.title}</h2><p className={styles.address}>{item.merchantName}<br />{item.address}{origin && <><br />{distanceKm(origin, item).toFixed(1)} km away · straight-line estimate</>}</p>
        <dl><dt>Pickup window · Vancouver time</dt><dd>{pickup(item.pickupStart)} – {pickup(item.pickupEnd)}</dd><dt>Allergen information</dt><dd>{item.allergens.length ? item.allergens.join(", ") : "No allergens declared; this does not mean allergen-free."} Confirm ingredients and cross-contact with the merchant.</dd></dl>
        {item.description && <p className={styles.small}>{item.description}</p>}
        <div className={styles.row}><div><span className={styles.price}>{money(item.price)}</span><span className={styles.original}>{money(item.origPrice)}</span></div><button className={styles.primary} disabled={expired || item.qtyLeft === 0 || busy !== null} onClick={() => void reserve(item)}>{busy === item.id ? "Reserving…" : expired ? "Pickup ended" : item.qtyLeft === 0 ? "Sold out" : item.isSample ? "Reserve one · sample" : "Reserve one"}</button></div>
      </article>;
    })}</div>
    {ready && items.length === 0 && !error && <section className={styles.empty}><h2>No listings yet.</h2><p>Post a sample listing to try the flow.</p></section>}
    <footer className={styles.footer}><Link href="/cook/plan">Cook at home</Link><Link href="/cook/demo">Try the cooking demo</Link><Link href="/support">Find food support</Link></footer>
  </main>;
}
