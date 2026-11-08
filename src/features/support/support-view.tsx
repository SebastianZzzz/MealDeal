"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FoodResource } from "@/types";
import { foodResources } from "./resources";
import styles from "../community.module.css";
import { ScreenHeader } from "@/components/screen-header";
import { SupportMap, type MapPoint } from "./support-map";

const categories = [
  { value: "all", label: "All support" }, { value: "food_bank", label: "Food banks" }, { value: "free_meal", label: "Free meals" },
  { value: "low_cost_market", label: "Affordable groceries" }, { value: "community_fridge", label: "Community fridges" }, { value: "other", label: "Programs" },
];
const typeLabel: Record<FoodResource["type"], string> = {
  food_bank: "Food bank", free_meal: "Free or by-donation meals", low_cost_market: "Affordable groceries",
  community_fridge: "Community fridge", other: "Low-cost meals and programs",
};

export function SupportView() {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>();
  const results = useMemo(() => foodResources.filter((item) => (category === "all" || item.type === category)
    && `${item.name} ${item.address} ${item.eligibility}`.toLowerCase().includes(query.trim().toLowerCase())), [category, query]);
  // Pins are numbered like the cards below; places without an address (online programs) have no pin.
  const points = useMemo<MapPoint[]>(() => results.flatMap((item, index) => item.lat !== undefined && item.lng !== undefined
    ? [{ id: item.id, label: String(index + 1), name: item.name, lat: item.lat, lng: item.lng }] : []), [results]);
  function showOnMap(id: string) {
    setActiveId(id);
    document.getElementById("support-map")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function selectFromMap(id: string) {
    setActiveId(id);
    document.getElementById(`resource-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <main className={styles.page}>
    <ScreenHeader backHref="/" />
    <header className={styles.hero}><p className={styles.eyebrow}>FOOD SUPPORT / VANCOUVER</p><h1>Food support</h1><p>Food banks, affordable groceries, and community meals. Find an option that works for you.</p></header>
    <aside className={styles.notice}><strong>Check before you go.</strong><p>Hours, eligibility, holiday closures, and availability can change. Check the official source or contact the service before travelling. These are curated listings, not live availability.</p></aside>
    <div id="support-map"><SupportMap points={points} activeId={activeId} onSelect={selectFromMap} /></div>
    <label className={styles.field}>Find a resource<input type="search" placeholder="Search by name, area, or access needs" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className={styles.filters} role="group" aria-label="Resource category">{categories.map((item) => <button key={item.value} aria-pressed={category === item.value} onClick={() => setCategory(item.value)}>{item.label}</button>)}</div>
    <p className={styles.small} role="status">{results.length} curated {results.length === 1 ? "resource" : "resources"}</p>
    <div className={styles.cards}>{results.map((item, index) => <article className={styles.card} id={`resource-${item.id}`} key={item.id} style={item.id === activeId ? { outline: "2px solid var(--green)", outlineOffset: 2 } : undefined}>
      <span className={styles.tag}>{item.lat !== undefined ? `${index + 1} · ` : ""}{typeLabel[item.type]}</span>
      <h2>{item.name}</h2><p className={styles.address}>{item.address}</p>
      <dl><dt>When to visit</dt><dd>{item.hours}</dd><dt>Access and eligibility</dt><dd>{item.eligibility}</dd></dl>
      <div className={styles.cardFooter}><a href={item.sourceUrl} target="_blank" rel="noreferrer">Official page ↗</a>{item.lat !== undefined && <><a href={`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`} target="_blank" rel="noreferrer">Directions ↗</a><button type="button" className={styles.secondary} onClick={() => showOnMap(item.id)}>Show on map</button></>}<span>Verified <time dateTime={item.verifiedAt}>{item.verifiedAt}</time></span></div>
    </article>)}</div>
    {results.length === 0 && <div className={styles.empty}><h2>No matches yet.</h2><p>Try a different area or clear your filters.</p><button className={styles.secondary} onClick={() => { setCategory("all"); setQuery(""); }}>Show all resources</button></div>}
    <footer className={styles.footer}><Link href="/cook/plan">Plan a meal</Link><Link href="/cook/demo">Try the cooking demo</Link><p>No sign-in is needed to browse food support.</p></footer>
  </main>;
}
