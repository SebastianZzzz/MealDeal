"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, MapPin, Navigation } from "lucide-react";
import type { FoodResource } from "@/types";
import { foodResources } from "./resources";
import styles from "../community.module.css";
import { SupportMap, type MapPoint } from "./support-map";

const categories = [
  { value: "all", label: "All" }, { value: "food_bank", label: "Food banks" }, { value: "free_meal", label: "Free meals" },
  { value: "low_cost_market", label: "Groceries" }, { value: "community_fridge", label: "Fridges" }, { value: "other", label: "Programs" },
];
const typeLabel: Record<FoodResource["type"], string> = {
  food_bank: "Food bank", free_meal: "Free or by-donation meals", low_cost_market: "Affordable groceries",
  community_fridge: "Community fridge", other: "Low-cost meals and programs",
};
const directions = (item: FoodResource) => `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;

export function SupportView() {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"map" | "list">("map");
  const [activeId, setActiveId] = useState<string>();
  const results = useMemo(() => foodResources.filter((item) => (category === "all" || item.type === category)
    && `${item.name} ${item.address} ${item.eligibility}`.toLowerCase().includes(query.trim().toLowerCase())), [category, query]);
  // Places with an address get a numbered pin and a card in the carousel; online programs are listed only.
  const mapped = useMemo(() => results.filter((item) => item.lat !== undefined && item.lng !== undefined), [results]);
  const points = useMemo<MapPoint[]>(() => mapped.map((item, index) => ({ id: item.id, label: String(index + 1), name: item.name, lat: item.lat!, lng: item.lng! })), [mapped]);
  const selected = mapped.some((item) => item.id === activeId) ? activeId : undefined;

  return <main className={styles.page}>
    <header className={styles.hero}><p className={styles.eyebrow}>FOOD SUPPORT / VANCOUVER</p><h1>Food support</h1><p>Food banks, free meals, fridges and affordable groceries near you.</p></header>

    <div className="view-switch" role="group" aria-label="View">
      <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>Map</button>
      <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List · {results.length}</button>
    </div>
    <div className={styles.filters} role="group" aria-label="Kind of support">{categories.map((item) => <button key={item.value} aria-pressed={category === item.value} onClick={() => { setCategory(item.value); setActiveId(undefined); }}>{item.label}</button>)}</div>

    {view === "map" ? <>
      <div style={{ marginTop: 14 }}><SupportMap points={points} activeId={selected} onSelect={setActiveId} /></div>
      {selected
        ? <PlaceCarousel places={mapped} activeId={selected} onActive={setActiveId} />
        : <div className="place-hint" role="status"><MapPin size={22} aria-hidden="true" /><span>Tap a pin to see a place. {mapped.length} {mapped.length === 1 ? "place" : "places"} on the map{results.length > mapped.length ? `, ${results.length - mapped.length} online in the list` : ""}.</span></div>}
    </> : <>
      <label className={styles.field} style={{ marginTop: 14 }}>Search<input type="search" placeholder="Name, area or access needs" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className={styles.cards}>{results.map((item) => <article className={styles.card} key={item.id}>
        <PlaceDetails item={item} number={mapped.findIndex((place) => place.id === item.id) + 1} />
        <div className="place-actions">
          <a className="btn secondary" href={item.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />Website</a>
          {item.lat !== undefined
            ? <button type="button" className="btn secondary" onClick={() => { setView("map"); setActiveId(item.id); }}><MapPin aria-hidden="true" />On the map</button>
            : <span />}
        </div>
      </article>)}</div>
      {results.length === 0 && <div className={styles.empty}><h2>No matches yet.</h2><p>Try another kind of support or clear the search.</p><button className={styles.secondary} onClick={() => { setCategory("all"); setQuery(""); }}>Show all places</button></div>}
    </>}

    <p className={styles.small} style={{ marginTop: 18 }}>Hours, eligibility and stock change, especially around holidays. These are curated listings, not live availability. Check the official page before you go.</p>
  </main>;
}

function PlaceDetails({ item, number, compact = false }: { item: FoodResource; number: number; compact?: boolean }) {
  return <>
    <span className="place-tag">{number > 0 && <span aria-label={`Pin ${number}`}>{number} ·</span>}{typeLabel[item.type]}</span>
    <h3>{item.name}</h3>
    <p className="muted" style={{ margin: "0 0 8px", fontSize: 15 }}>{item.address}</p>
    <p className={compact ? "clamp-2" : undefined} style={{ margin: "0 0 6px", fontSize: 15 }}><b>When:</b> {item.hours}</p>
    <p className={compact ? "clamp-2" : undefined} style={{ margin: 0, fontSize: 15 }}><b>Who:</b> {item.eligibility}</p>
  </>;
}

// Swipeable cards under the map. The centred card is the selected place; its pin is highlighted.
function PlaceCarousel({ places, activeId, onActive }: { places: FoodResource[]; activeId: string; onActive: (id: string) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);
  const frame = useRef(0);
  const index = places.findIndex((place) => place.id === activeId);

  // Bring the selected card to the centre when it was chosen from a pin or the arrows.
  useEffect(() => {
    const node = track.current;
    const card = node?.querySelector<HTMLElement>(`[data-id="${activeId}"]`);
    if (!node || !card) return;
    const target = card.offsetLeft - (node.clientWidth - card.clientWidth) / 2;
    if (Math.abs(node.scrollLeft - target) < 4) return;
    programmatic.current = true;
    node.scrollTo({ left: target, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    const done = window.setTimeout(() => { programmatic.current = false; }, 450);
    return () => window.clearTimeout(done);
  }, [activeId]);

  function onScroll() {
    if (programmatic.current) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const node = track.current;
      if (!node) return;
      const centre = node.scrollLeft + node.clientWidth / 2;
      let best = activeId;
      let distance = Infinity;
      node.querySelectorAll<HTMLElement>("[data-id]").forEach((card) => {
        const gap = Math.abs(card.offsetLeft + card.clientWidth / 2 - centre);
        if (gap < distance) { distance = gap; best = card.dataset.id!; }
      });
      if (best !== activeId) onActive(best);
    });
  }

  const go = (step: number) => onActive(places[(index + step + places.length) % places.length].id);
  return <section aria-label="Selected place" aria-roledescription="carousel">
    <div className="place-carousel" ref={track} onScroll={onScroll}>
      {places.map((place, position) => <article key={place.id} data-id={place.id} className="place-card" data-active={place.id === activeId}
        aria-roledescription="slide" aria-label={`${position + 1} of ${places.length}: ${place.name}`} aria-hidden={place.id !== activeId}
        onClick={() => { if (place.id !== activeId) onActive(place.id); }}>
        <PlaceDetails item={place} number={position + 1} compact />
        <div className="place-actions">
          <a className="btn primary" href={directions(place)} target="_blank" rel="noreferrer" tabIndex={place.id === activeId ? 0 : -1}><Navigation aria-hidden="true" />Directions</a>
          <a className="btn secondary" href={place.sourceUrl} target="_blank" rel="noreferrer" tabIndex={place.id === activeId ? 0 : -1}><ExternalLink aria-hidden="true" />Website</a>
        </div>
      </article>)}
    </div>
    <div className="carousel-nav">
      <button type="button" className="round-btn" aria-label="Previous place" onClick={() => go(-1)}><ChevronLeft size={20} /></button>
      <span aria-live="polite">{index + 1} of {places.length}</span>
      <button type="button" className="round-btn" aria-label="Next place" onClick={() => go(1)}><ChevronRight size={20} /></button>
    </div>
  </section>;
}
