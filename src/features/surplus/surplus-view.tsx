"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { MapPin, Plus } from "lucide-react";
import type { SurplusListing } from "@/types";
import { notifySurplusChanged } from "./browser-store";
import { makeSurplusClient, type InventorySource } from "./client";
import { MealDetail } from "./meal-detail";
import { MealCard } from "./meal-card";
import { useInventory } from "./use-inventory";
import { SurplusFeedback, type Feedback } from "./feedback";
import { sortedListings } from "./presentation";
import styles from "./surplus.module.css";

export function SurplusView({ source = "local" }: { source?: InventorySource }) {
  const { items, setItems, ready, loadError, now, refresh } = useInventory(source);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [sort, setSort] = useState("price");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const availabilityFilter = useRef<HTMLButtonElement>(null);

  async function reserve(item: SurplusListing) {
    setBusy(true);
    setFeedback({ tone: "progress", content: "Reserving one portion…" });
    try {
      const result = await makeSurplusClient(source).reserve(item.id, Date.now);
      if (result.ok) {
        setItems((current) => current.map((entry) => entry.id === item.id ? result.listing : entry));
        setFeedback({ tone: "success", content: <>{result.listing.isSample ? "Sample reservation" : "Reservation"} recorded for <strong>{result.listing.title}</strong>. <strong>{result.listing.qtyLeft} left.</strong></> });
      } else {
        const content = result.reason === "sold_out" ? "The last portion was just reserved. Choose another meal."
          : result.reason === "expired" ? "Pickup has ended. Choose another meal." : "This meal is no longer available. Choose another meal.";
        setFeedback({ tone: "error", content });
      }
      if (source === "local") {
        notifySurplusChanged();
      }
    } catch (cause) {
      setFeedback({ tone: "error", content: cause instanceof Error ? cause.message : "Could not reserve. Nothing was confirmed. Try again." });
    } finally {
      setBusy(false);
      refresh();
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setFeedback({ tone: "error", content: "Location is unavailable. Browse by price instead." });
      return;
    }
    setLocating(true);
    setFeedback({ tone: "progress", content: "Finding you…" });
    navigator.geolocation.getCurrentPosition((position) => {
      setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude });
      setSort("distance"); setLocating(false);
      setFeedback({ tone: "success", content: <>Location found. Showing <strong>nearest meals</strong>.</> });
    }, () => {
      setLocating(false);
      setFeedback({ tone: "error", content: "Location could not be obtained. Browse by price or allow location and retry." });
    }, { timeout: 10000, maximumAge: 60000 });
  }

  function closeDetail() {
    setSelectedId(null);
    // Native dialogs contain focus; restore it even if a sold-out card has moved in the list.
    window.requestAnimationFrame(() => {
      const target = trigger.current?.isConnected ? trigger.current : availabilityFilter.current;
      target?.focus();
    });
  }

  function openDetail(item: SurplusListing, button: HTMLButtonElement) {
    trigger.current = button;
    setSelectedId(item.id);
    setFeedback(null);
  }

  const selected = items.find((item) => item.id === selectedId);
  const sorted = sortedListings(items, now, onlyAvailable, sort === "distance" ? origin : null);
  // A later refresh failure must not erase a confirmed reservation.
  const status: Feedback | null = loadError && feedback?.tone === "success"
    ? { tone: "success", content: <>{feedback.content} <span className={styles.error}>Refresh failed. Try again.</span></> }
    : loadError ? { tone: "error", content: loadError } : feedback;

  return <main className={`page ${styles.page}`}>
    <header className={styles.hero}><p className="planning-eyebrow">Eat out</p><h1>Surplus meals</h1><p>Good food, less waste.</p></header>
    <nav className={styles.viewSwitch} aria-label="Inventory source">
      <Link href="/eat-out" aria-current={source === "local" ? "page" : undefined}>Local demo</Link>
      <Link href="/eat-out/shared" aria-current={source === "shared" ? "page" : undefined}>Shared preview</Link>
    </nav>
    <aside className="planning-notice"><strong>{source === "local" ? "Sample meals. No real reservations." : "Shared preview. Sign in to reserve."}</strong><br />
      {source === "local" ? "Browser-only. No food or payment arranged." : "Sample labels mean fictional food. No online payment."}
    </aside>
    <div className={styles.tools}>
      <button type="button" className="btn" disabled={locating} onClick={locate}><MapPin size={18} aria-hidden="true" />{locating ? "Finding you…" : "Use my location"}</button>
      <Link className="btn" href={source === "local" ? "/eat-out/post" : "/eat-out/shared/post"}><Plus size={18} aria-hidden="true" />Post a meal</Link>
    </div>
    <div className={styles.filterRow}>
      <div className={`field ${styles.sort}`}><label htmlFor="meal-sort">Sort meals</label><select id="meal-sort" value={sort} onChange={(event) => {
        setSort(event.target.value);
        setFeedback({ tone: "success", content: <>Sorted by <strong>{event.target.value === "price" ? "lowest price" : "distance"}</strong>.</> });
      }}><option value="price">Lowest price</option><option value="distance" disabled={!origin}>Nearest to me</option></select></div>
      <button ref={availabilityFilter} type="button" className="chip" aria-pressed={onlyAvailable} onClick={() => {
        setOnlyAvailable(!onlyAvailable);
        setFeedback({ tone: "success", content: <>Showing <strong>{onlyAvailable ? "all meals" : "available meals"}</strong>.</> });
      }}>Available only</button>
    </div>
    <SurplusFeedback feedback={selected ? null : !ready ? { tone: "progress", content: "Loading meals…" } : status} />
    {loadError && <button type="button" className="btn" onClick={() => { setFeedback({ tone: "progress", content: "Loading meals…" }); refresh(); }}>Try again</button>}
    <div className={styles.cards} aria-busy={!ready}>{sorted.map((item) => <MealCard key={item.id} item={item} now={now} origin={origin} onOpen={openDetail} />)}</div>
    {ready && sorted.length === 0 && !loadError && <section className={styles.empty}><h2>No meals available.</h2><p>{items.length ? "Turn off Available only to see ended and sold-out meals." : "Post a sample meal to try the flow."}</p></section>}
    <footer className={styles.footer}><Link className="btn text" href="/cook/plan">Cook at home</Link><Link className="btn text" href="/support">Find food support</Link></footer>
    {selected && <MealDetail item={selected} now={now} busy={busy} feedback={status} onClose={closeDetail}
      onRetry={loadError ? refresh : undefined} onReserve={() => void reserve(selected)} />}
  </main>;
}
