"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Clock, MapPin, X } from "lucide-react";
import type { SurplusListing } from "@/types";
import { DishArt } from "./dish-art";
import { SurplusFeedback, type Feedback } from "./feedback";
import { availability, available, money, pickup } from "./presentation";
import styles from "./surplus.module.css";

function containDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") {
    return;
  }
  const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]');
  const first = controls[0];
  const last = controls[controls.length - 1];
  const target = event.shiftKey ? last : first;
  const boundary = event.shiftKey ? first : last;
  if (target && document.activeElement === boundary) {
    event.preventDefault();
    target.focus();
  }
}

export function MealDetail({ item, now, busy, feedback, onClose, onReserve, onRetry }: {
  item: SurplusListing; now: number; busy: boolean; feedback: Feedback | null;
  onClose: () => void; onReserve: () => void;
  onRetry?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return <dialog ref={dialog} role="dialog" aria-modal="true" aria-labelledby="meal-detail-title"
    className={`sheet ${styles.detail}`} onKeyDown={containDialogFocus} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className={styles.detailHeading}>
      <span className={styles.tag}>{item.isSample ? "Sample meal" : "Surplus meal"}</span>
      <button type="button" className="icon-btn" aria-label="Close meal details" onClick={onClose} autoFocus><X size={22} aria-hidden="true" /></button>
    </div>
    <div className={styles.detailBody}>
      <DishArt id={item.id} title={item.title} />
      <h2 id="meal-detail-title">{item.title}</h2>
      <p>{item.merchantName}</p>
      <div className={styles.priceRow}><strong className={styles.price}>{money(item.price)}</strong><s>{money(item.origPrice)}</s><span>CAD · {availability(item, now)}</span></div>
      <dl className={styles.facts}>
        <dt><MapPin size={18} aria-hidden="true" />Pickup location</dt><dd>{item.address}</dd>
        <dt><Clock size={18} aria-hidden="true" />Pickup · Vancouver time</dt><dd>{pickup(item.pickupStart)} – {pickup(item.pickupEnd)}</dd>
        <dt>Allergens</dt><dd>{item.allergens.length ? item.allergens.join(", ") : "None declared. This does not mean allergen-free."} Confirm ingredients and cross-contact with the merchant.</dd>
      </dl>
      {item.description && <p>{item.description}</p>}
      <aside className="planning-notice">{item.isSample ? "Simulation only. No real food is held and no payment is taken." : "Pay at pickup. No online payment is taken."}</aside>
    </div>
    <div className={styles.detailActions}>
      <SurplusFeedback feedback={feedback} />
      {onRetry && <button type="button" className={`btn ${styles.retry}`} onClick={onRetry}>Refresh meals</button>}
      <button type="button" className="btn primary" disabled={busy || !available(item, now)} onClick={onReserve}>
        {busy ? "Reserving…" : !available(item, now) ? availability(item, now) : item.isSample ? "Reserve one · sample" : "Reserve one"}
      </button>
    </div>
  </dialog>;
}
