"use client";

import { useEffect, useState } from "react";
import type { SurplusListing } from "@/types";
import { SURPLUS_CHANGED } from "./browser-store";
import { makeSurplusClient, type InventorySource } from "./client";
import { SURPLUS_KEY } from "./inventory";

export function useInventory(source: InventorySource) {
  const [items, setItems] = useState<SurplusListing[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(0);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    let latestRequest = 0;
    async function load() {
      const request = ++latestRequest;
      try {
        const next = await makeSurplusClient(source).list();
        if (active && request === latestRequest) {
          setItems(next); setLoadError(""); setReady(true); setNow(Date.now());
        }
      } catch (cause) {
        if (active && request === latestRequest) {
          setLoadError(cause instanceof Error ? cause.message : "Could not load meals. Try again.");
          setReady(true);
        }
      }
    }
    function storage(event: StorageEvent) {
      if (event.key === SURPLUS_KEY || event.key === null) {
        void load();
      }
    }
    const refresh = () => { void load(); };
    void load();
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener("storage", storage);
    window.addEventListener(SURPLUS_CHANGED, refresh);
    return () => {
      active = false;
      window.clearInterval(tick);
      window.removeEventListener("storage", storage);
      window.removeEventListener(SURPLUS_CHANGED, refresh);
    };
  }, [source, reload]);

  function refresh() {
    setLoadError("");
    setReload((value) => value + 1);
  }

  return { items, setItems, ready, loadError, now, refresh };
}
