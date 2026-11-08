"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { SurplusListing } from "@/types";
import { LocationPicker } from "@/components/location-picker";
import { notifySurplusChanged } from "./browser-store";
import { makeSurplusClient, type InventorySource } from "./client";
import { MealDetail } from "./meal-detail";
import { MealCard } from "./meal-card";
import { InventoryNotice } from "./inventory-notice";
import { useInventory } from "./use-inventory";
import { usePickupArea } from "./use-pickup-area";
import { SurplusFeedback, type Feedback } from "./feedback";
import { listingPage, listingsInRange, sortedListings } from "./presentation";
import styles from "./surplus.module.css";

function scrollToTop() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
}

export function SurplusView({ source = "local" }: { source?: InventorySource }) {
  const { items, setItems, ready, loadError, now, refresh } = useInventory(source);
  const location = usePickupArea();
  const [phase, setPhase] = useState<"where" | "list">("where");
  const [page, setPage] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [sort, setSort] = useState("price");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const availabilityFilter = useRef<HTMLButtonElement>(null);

  function showList(nearby: boolean) {
    if (!nearby) {
      location.change(null, null);
    }
    setSort(nearby ? "distance" : "price"); setPage(0); setPhase("list");
    setFeedback(null);
    scrollToTop();
  }

  function turnPage(next: number) {
    setPage(next);
    setFeedback({ tone: "success", content: <>Showing <strong>page {next + 1}</strong>.</> });
    scrollToTop();
  }

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

  function closeDetail() {
    setSelectedId(null);
    // The selected card can disappear after its final portion is reserved.
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
  const inRange = listingsInRange(items, location.origin, location.maxKm);
  const sorted = sortedListings(inRange, now, onlyAvailable, sort === "distance" ? location.origin : null);
  const { pages, current, visible } = listingPage(sorted, page);
  // A later refresh failure must not erase a confirmed reservation.
  const status: Feedback | null = loadError && feedback?.tone === "success"
    ? { tone: "success", content: <>{feedback.content} <span className={styles.error}>Refresh failed. Try again.</span></> }
    : loadError ? { tone: "error", content: loadError } : feedback;

  if (phase === "where") {
    return <main className={`page ${styles.page}`}>
      <header className={styles.hero}><p className="planning-eyebrow">Eat out</p><h1>Where are you?</h1><p>Choose an area for pickup. Only an approximate location is used.</p></header>
      <LocationPicker value={location.origin} onChange={location.change} distanceKm={location.maxKm}
        onDistance={location.changeDistance} distanceLabel="Pickup distance" mapName="Where you are"
        setText="Showing meals near " savedText="Using your saved shopping area (shown on the map)."
        emptyText="Set an area to see nearby meals, or skip to browse by price." />
      <InventoryNotice source={source} />
      <footer className="action-bar"><button type="button" className="btn secondary" onClick={() => showList(false)}>Skip</button><button type="button" className="btn primary" disabled={!location.origin} onClick={() => showList(true)}>Show meals nearby</button></footer>
    </main>;
  }

  return <main className={`page ${styles.page}`}>
    <header className={styles.hero}><p className="planning-eyebrow">Eat out</p><h1>Surplus meals</h1><p>Good food, less waste.</p></header>
    <aside className="planning-notice">{source === "local" ? "Local demo. No real food is held." : "Shared preview. Sample meals are fictional."}</aside>
    <div className="near-line"><span>{location.origin ? <>Within <strong>{location.maxKm} km</strong> of <strong>{location.area ?? "your shopping area"}</strong></> : "Browsing all meals by price"}</span>
      <button type="button" className="btn text" onClick={() => { setPhase("where"); scrollToTop(); }}>{location.origin ? "Change" : "Add location"}</button>
    </div>
    <div className={styles.tools}><Link className="btn" href={source === "local" ? "/eat-out/post" : "/eat-out/shared/post"}><Plus size={18} aria-hidden="true" />Post a meal</Link></div>
    <div className={styles.filterRow}>
      <div className={`field ${styles.sort}`}><label htmlFor="meal-sort">Sort meals</label><select id="meal-sort" value={sort} onChange={(event) => {
        setSort(event.target.value); setPage(0);
        setFeedback({ tone: "success", content: <>Sorted by <strong>{event.target.value === "price" ? "lowest price" : "distance"}</strong>.</> });
      }}><option value="price">Lowest price</option><option value="distance" disabled={!location.origin}>Nearest to me</option></select></div>
      <button ref={availabilityFilter} type="button" className="chip" aria-pressed={onlyAvailable} onClick={() => {
        setOnlyAvailable(!onlyAvailable); setPage(0);
        setFeedback({ tone: "success", content: <>Showing <strong>{onlyAvailable ? "all meals" : "available meals"}</strong>.</> });
      }}>Available only</button>
    </div>
    <SurplusFeedback feedback={selected ? null : !ready ? { tone: "progress", content: "Loading meals…" } : status} />
    {loadError && <button type="button" className="btn" onClick={() => { setFeedback({ tone: "progress", content: "Loading meals…" }); refresh(); }}>Try again</button>}
    <div className={styles.cards} aria-busy={!ready}>{visible.map((item) => <MealCard key={item.id} item={item} now={now} origin={location.origin} onOpen={openDetail} />)}</div>
    {pages > 1 && <nav className="pager" aria-label="Listing pages"><button type="button" className="btn secondary" disabled={current === 0} onClick={() => turnPage(current - 1)}>Previous</button><span aria-live="polite">Page {current + 1} of {pages}</span><button type="button" className="btn secondary" disabled={current >= pages - 1} onClick={() => turnPage(current + 1)}>Next</button></nav>}
    {ready && sorted.length === 0 && !loadError && <section className={styles.empty}><h2>No meals available.</h2><p>{location.origin ? "Try a longer pickup distance or include unavailable meals." : "Include unavailable meals or post a sample to try the flow."}</p></section>}
    <footer className={styles.footer}><Link className="btn text" href="/cook/plan">Cook at home</Link><Link className="btn text" href="/support">Find food support</Link><Link className="btn text" href={source === "local" ? "/eat-out/shared" : "/eat-out"}>{source === "local" ? "Shared preview" : "Local demo"}</Link></footer>
    {selected && <MealDetail item={selected} now={now} busy={busy} feedback={status} onClose={closeDetail}
      onRetry={loadError ? refresh : undefined} onReserve={() => void reserve(selected)} />}
  </main>;
}
