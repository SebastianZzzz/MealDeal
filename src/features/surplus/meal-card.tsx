import { Clock } from "lucide-react";
import type { SurplusListing } from "@/types";
import { distanceKm } from "./inventory";
import { DishArt } from "./dish-art";
import { availability, money, pickup } from "./presentation";
import styles from "./surplus.module.css";

export function MealCard({ item, now, origin, onOpen }: {
  item: SurplusListing; now: number; origin: { lat: number; lng: number } | null;
  onOpen: (item: SurplusListing, trigger: HTMLButtonElement) => void;
}) {
  return <article className={`card ${styles.mealCard}`}>
    <DishArt id={item.id} title={item.title} />
    <div className={styles.tags}>{item.isSample && <span className={styles.tag}>Sample meal</span>}<span className={styles.stock}>{availability(item, now)}</span></div>
    <h2>{item.title}</h2><p className={styles.meta}>{item.merchantName}</p>
    <p className={styles.meta}><Clock size={18} aria-hidden="true" /><span>{pickup(item.pickupStart)} – {pickup(item.pickupEnd)}</span></p>
    {origin && <p className={styles.meta}>{distanceKm(origin, item).toFixed(1)} km · straight-line estimate</p>}
    <div className={styles.cardBottom}>
      <div><strong className={styles.price}>{money(item.price)}</strong><s>{money(item.origPrice)}</s><span className={styles.currency}>CAD / portion</span></div>
      <button type="button" className="btn" aria-label={`View ${item.title}`} onClick={(event) => onOpen(item, event.currentTarget)}>View meal</button>
    </div>
  </article>;
}
