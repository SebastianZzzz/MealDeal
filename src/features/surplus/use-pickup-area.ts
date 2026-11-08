"use client";

import { useEffect, useRef, useState } from "react";
import type { Point } from "@/components/location-picker";

export function usePickupArea() {
  const [origin, setOrigin] = useState<Point | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [maxKm, setMaxKm] = useState(3);
  const edited = useRef(false);

  useEffect(() => {
    let active = true;
    async function loadSavedArea() {
      try {
        const response = await fetch("/api/me");
        if (!response.ok) {
          return;
        }
        const data = await response.json() as { profile?: { home?: Point; maxDistanceKm?: number } };
        const home = data.profile?.home;
        if (!active || edited.current || !home || !Number.isFinite(home.lat) || !Number.isFinite(home.lng)
          || Math.abs(home.lat) > 90 || Math.abs(home.lng) > 180) {
          return;
        }
        // Match LocationPicker's approximate 100 m area, including older saved profiles.
        setOrigin({ lat: Math.round(home.lat * 1000) / 1000, lng: Math.round(home.lng * 1000) / 1000 });
        const distance = data.profile?.maxDistanceKm;
        if (typeof distance === "number" && Number.isFinite(distance)) {
          setMaxKm(Math.min(15, Math.max(0.5, Math.round(distance * 2) / 2)));
        }
      } catch {
        // A saved area is optional; the location picker and Skip remain available.
      }
    }
    void loadSavedArea();
    return () => { active = false; };
  }, []);

  function change(point: Point | null, name: string | null) {
    edited.current = true;
    setOrigin(point); setArea(name);
  }

  function changeDistance(distance: number) {
    edited.current = true;
    setMaxKm(distance);
  }

  return { origin, area, maxKm, change, changeDistance };
}
