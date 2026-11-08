"use client";

import { useEffect, useRef } from "react";
import type { Circle, Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPoint { id: string; label: string; name: string; lat: number; lng: number }

type Leaflet = typeof import("leaflet");

function pin(L: Leaflet, label: string, active: boolean) {
  return L.divIcon({ className: "", html: `<span class="map-pin${active ? " active" : ""}"><span>${label}</span></span>`, iconSize: [30, 30], iconAnchor: [15, 30] });
}

// OpenStreetMap tiles through Leaflet: no API key. Leaflet touches `window`, so it loads in the browser only.
export function SupportMap({ points, activeId, onSelect, radiusKm, animate = true, label = "Map of food support locations" }: { points: MapPoint[]; activeId?: string; onSelect: (id: string) => void; radiusKm?: number; animate?: boolean; label?: string }) {
  const element = useRef<HTMLDivElement>(null);
  const leaflet = useRef<Leaflet | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  const circle = useRef<Circle | null>(null);
  const select = useRef(onSelect);
  useEffect(() => { select.current = onSelect; }, [onSelect]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !element.current || map.current) {
        return;
      }
      leaflet.current = L;
      const motion = animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // A location step can unmount immediately after a radius change. Disable its
      // zoom transition so Leaflet cannot finish a timer against removed map panes.
      map.current = L.map(element.current, { scrollWheelZoom: false, zoomAnimation: motion, fadeAnimation: motion }).setView([49.265, -123.17], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>",
      }).addTo(map.current);
      element.current.dispatchEvent(new Event("leaflet-ready"));
    });
    const markerMap = markers.current;
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      circle.current = null;
      markerMap.clear();
    };
  }, [animate]);

  // Redraw markers and fit the view when the filtered list changes.
  useEffect(() => {
    const node = element.current;
    function draw() {
      const L = leaflet.current;
      if (!L || !map.current) {
        return;
      }
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
      circle.current?.remove();
      circle.current = null;
      for (const point of points) {
        const marker = L.marker([point.lat, point.lng], { icon: pin(L, point.label, false), title: point.name, alt: point.name, keyboard: true }).addTo(map.current);
        marker.on("click", () => select.current(point.id));
        markers.current.set(point.id, marker);
      }
      if (radiusKm && points.length === 1) {
        // A distance setting: show the whole circle so the slider visibly changes the map.
        circle.current = L.circle([points[0].lat, points[0].lng], { radius: radiusKm * 1000, color: "#00704a", weight: 2, fillOpacity: 0.08 }).addTo(map.current);
        map.current.fitBounds(circle.current.getBounds(), { padding: [12, 12] });
      } else if (points.length > 1) {
        map.current.fitBounds(L.latLngBounds(points.map((point) => [point.lat, point.lng])), { padding: [30, 30], maxZoom: 15 });
      } else if (points.length === 1) {
        map.current.setView([points[0].lat, points[0].lng], 15);
      }
    }
    draw();
    node?.addEventListener("leaflet-ready", draw);
    return () => node?.removeEventListener("leaflet-ready", draw);
  }, [points, radiusKm]);

  // Highlight the selected place without re-fitting the whole map.
  useEffect(() => {
    const L = leaflet.current;
    if (!L || !map.current) {
      return;
    }
    for (const point of points) {
      markers.current.get(point.id)?.setIcon(pin(L, point.label, point.id === activeId));
    }
    const active = points.find((point) => point.id === activeId);
    if (active) {
      const motion = animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.current.panTo([active.lat, active.lng], { animate: motion });
    }
  }, [activeId, points, animate]);

  return <div className="support-map" ref={element} role="region" aria-label={label} />;
}
