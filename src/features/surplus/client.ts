"use client";

import type { SurplusListing } from "@/types";
import { makeBrowserInventory } from "./browser-store";
import { validDraft, type ListingDraft, type ReserveResult } from "./inventory";

export type InventorySource = "local" | "shared";
interface Client {
  list(): Promise<SurplusListing[]>;
  post(draft: ListingDraft, id: string, now: number): Promise<SurplusListing>;
  reserve(id: string, clock: number | (() => number)): Promise<ReserveResult>;
}

async function responseJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "The shared service could not complete this request.");
  return body;
}
function listing(value: unknown): SurplusListing {
  if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string"
    || !("isSample" in value) || typeof value.isSample !== "boolean" || !validDraft(value)) throw new Error("The shared service returned an invalid listing.");
  return value as SurplusListing;
}

export function makeSurplusClient(source: InventorySource): Client {
  if (source === "local") {
    const inventory = makeBrowserInventory();
    return {
      list: async () => navigator.locks ? inventory.initialize() : inventory.read(),
      post: inventory.post, reserve: inventory.reserve,
    };
  }
  return {
    list: async () => {
      const body = await responseJson(await fetch("/api/surplus", { cache: "no-store", signal: AbortSignal.timeout(10000) }));
      if (!Array.isArray(body.items)) throw new Error("Shared listings could not be read.");
      return body.items.map(listing);
    },
    post: async (draft) => {
      const body = await responseJson(await fetch("/api/surplus", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft), signal: AbortSignal.timeout(10000) }));
      return listing(body.listing);
    },
    reserve: async (id) => {
      const response = await fetch(`/api/surplus/${encodeURIComponent(id)}/reserve`, { method: "POST", signal: AbortSignal.timeout(10000) });
      if (response.status === 409) return { ok: false, reason: "sold_out" };
      const body = await responseJson(response);
      return { ok: true, listing: listing(body.listing) };
    },
  };
}
