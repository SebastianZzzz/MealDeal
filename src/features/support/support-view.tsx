"use client";

import Link from "next/link";
import { useState } from "react";
import { foodResources } from "./resources";
import styles from "../community.module.css";
import { ScreenHeader } from "@/components/screen-header";

const categories = [
  { value: "all", label: "All support" }, { value: "food_bank", label: "Food banks" },
  { value: "low_cost_market", label: "Affordable groceries" }, { value: "other", label: "Low-cost meals" },
];

export function SupportView() {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const results = foodResources.filter((item) => (category === "all" || item.type === category)
    && `${item.name} ${item.address} ${item.eligibility}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <main className={styles.page}>
    <ScreenHeader backHref="/" />
    <header className={styles.hero}><p className={styles.eyebrow}>FOOD SUPPORT / VANCOUVER</p><h1>Food support</h1><p>Food banks, affordable groceries, and community meals. Find an option that works for you.</p></header>
    <aside className={styles.notice}><strong>Check before you go.</strong><p>Hours, eligibility, holiday closures, and availability can change. Check the official source or contact the service before travelling. These are curated listings, not live availability.</p></aside>
    <label className={styles.field}>Find a resource<input type="search" placeholder="Search by name, area, or access needs" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className={styles.filters} role="group" aria-label="Resource category">{categories.map((item) => <button key={item.value} aria-pressed={category === item.value} onClick={() => setCategory(item.value)}>{item.label}</button>)}</div>
    <p className={styles.small} role="status">{results.length} curated {results.length === 1 ? "resource" : "resources"}</p>
    <div className={styles.cards}>{results.map((item) => <article className={styles.card} key={item.id}>
      <span className={styles.tag}>{item.type === "food_bank" ? "Food bank" : item.type === "low_cost_market" ? "Affordable groceries" : "Low-cost meals"}</span>
      <h2>{item.name}</h2><p className={styles.address}>{item.address}</p>
      <dl><dt>When to visit</dt><dd>{item.hours}</dd><dt>Access and eligibility</dt><dd>{item.eligibility}</dd></dl>
      <div className={styles.cardFooter}><a href={item.sourceUrl} target="_blank" rel="noreferrer">Check official source ↗</a><span>Verified <time dateTime={item.verifiedAt}>{item.verifiedAt}</time></span></div>
    </article>)}</div>
    {results.length === 0 && <div className={styles.empty}><h2>No matches yet.</h2><p>Try a different area or clear your filters.</p><button className={styles.secondary} onClick={() => { setCategory("all"); setQuery(""); }}>Show all resources</button></div>}
    <footer className={styles.footer}><Link href="/cook/plan">Plan a meal</Link><Link href="/cook/demo">Try the cooking demo</Link><p>No sign-in is needed to browse food support.</p></footer>
  </main>;
}
