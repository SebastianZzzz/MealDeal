"use client";

import sampleMerchants from "../../../mock/surplus-listings.json";
import type { SurplusListing } from "@/types";
import { createInventory } from "./inventory";

export const SURPLUS_CHANGED = "mealdeal:surplus-changed";

export function makeBrowserInventory() {
  const now = Date.now();
  const seeds: SurplusListing[] = sampleMerchants.map((item) => ({
    ...item, isSample: true, createdAt: new Date(now).toISOString(),
    pickupStart: new Date(now + 30 * 60_000).toISOString(), pickupEnd: new Date(now + 4 * 60 * 60_000).toISOString(),
  }));
  return createInventory(localStorage, (work) => {
    if (!navigator.locks) throw new Error("Posting and reservations are unavailable in this browser. Try a current browser and allow local storage.");
    return navigator.locks.request("mealdeal.surplus.inventory.v1", { mode: "exclusive" }, work);
  }, seeds);
}

export function notifySurplusChanged() { window.dispatchEvent(new Event(SURPLUS_CHANGED)); }
