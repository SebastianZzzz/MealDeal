"use client";

import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { readApiError } from "@/lib/api-error";
import { POSTAL_CODE, normalizePostal } from "@/lib/postal";
import { SupportMap } from "@/features/support/support-map";
import { RangeField } from "@/components/range-field";

export type Point = { lat: number; lng: number };
type Status = { tone: "info" | "success" | "error"; text: string; place?: string; after?: string };

// Ponderosa Commons, UBC: the server's default area, shown until a location is set.
const DEMO_CENTER = { lat: 49.2644, lng: -123.2537 };

// About 100 m: enough to find nearby places, not enough to pinpoint a home.
const round = (value: number) => Math.round(value * 1000) / 1000;

async function describe(lat: number, lng: number) {
  try {
    const response = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
    if (!response.ok) return null;
    return (await response.json() as { area: string | null }).area;
  } catch {
    return null;
  }
}

/**
 * "Use my location" or a postal code, one status line (green with the place in bold once found)
 * a map with the distance circle, and the distance slider. Cook's shopping range step and Eat Out
 * use this same block so they look and behave the same.
 */
export function LocationPicker({ value, onChange, setText, emptyText, savedText, mapName, distanceKm, onDistance, distanceLabel }: {
  value: Point | null;
  onChange: (point: Point | null, area: string | null) => void;
  /** "Shopping area set near " — followed by the postal code / area in bold. */
  setText: string;
  emptyText: string;
  savedText: string;
  mapName: string;
  distanceKm: number;
  onDistance: (km: number) => void;
  distanceLabel: string;
}) {
  const [locating, setLocating] = useState(false);
  const [postal, setPostal] = useState("");
  const [status, setStatus] = useState<Status | null>(null);

  function setFromCurrentLocation() {
    if (!navigator.geolocation) { setStatus({ tone: "error", text: "This browser can't share a location. Enter a postal code instead." }); return; }
    setLocating(true);
    setStatus({ tone: "info", text: "Finding you…" });
    navigator.geolocation.getCurrentPosition(async (position) => {
      const point = { lat: round(position.coords.latitude), lng: round(position.coords.longitude) };
      const area = await describe(point.lat, point.lng);
      onChange(point, area);
      setStatus(area
        ? { tone: "success", text: "Found you near ", place: area, after: ". Not right? Enter a postal code." }
        : { tone: "success", text: "Found your location (shown on the map). Not right? Enter a postal code." });
      setLocating(false);
    }, (failure) => {
      setStatus({ tone: "error", text: failure.code === failure.PERMISSION_DENIED
        ? "Location access is off for this site. Allow it (iPhone: Settings > Privacy > Location Services > Safari Websites), or enter a postal code."
        : failure.code === failure.TIMEOUT ? "Finding your location took too long. Try again, or enter a postal code." : "Your location isn't available right now. Enter a postal code instead." });
      setLocating(false);
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  }

  async function setFromPostal() {
    if (!postal.trim()) return;
    // Check the format here so a typo never leaves the page.
    if (!POSTAL_CODE.test(postal.trim())) {
      setStatus({ tone: "error", text: "That isn't a Canadian postal code. Use the format A1A 1A1, like V6T 1Z4." });
      return;
    }
    setLocating(true);
    try {
      const response = await fetch(`/api/geocode?postal=${encodeURIComponent(postal.trim())}`);
      if (!response.ok) throw new Error((await readApiError(response)).error);
      const place = await response.json() as { lat: number; lng: number; postal: string; area: string | null };
      onChange({ lat: place.lat, lng: place.lng }, place.area ?? place.postal);
      setStatus({ tone: "success", text: setText, place: place.area ? `${place.postal} (${place.area})` : place.postal, after: "." });
    } catch (cause) {
      setStatus({ tone: "error", text: cause instanceof Error ? cause.message : "Could not find that postal code." });
    } finally {
      setLocating(false);
    }
  }

  const shown = value ?? DEMO_CENTER;
  return <div className="location-picker">
    {<div className="area-map"><SupportMap label={mapName} radiusKm={distanceKm} points={[{ id: "here", label: "•", name: mapName, lat: shown.lat, lng: shown.lng }]} onSelect={() => undefined} /></div>}
    <span role="status" className={`place-status place-${status?.tone ?? "info"}`}>{status
      ? <>{status.text}{status.place && <strong>{status.place}</strong>}{status.after}</>
      : value ? savedText : emptyText}
      {value && <>{" "}<button type="button" className="link-btn" onClick={() => { onChange(null, null); setStatus({ tone: "info", text: "Location cleared." }); }}>Clear</button></>}</span>
    {/* Both ways to set it on one row, so the setting below stays on screen. */}
    <div className="location-row">
      <button type="button" className="btn secondary" disabled={locating} onClick={setFromCurrentLocation}><LocateFixed aria-hidden="true" />{locating ? "Finding…" : "Use my location"}</button>
      <input className="text-input" aria-label="Postal code" placeholder="Postal" maxLength={7} autoComplete="postal-code" value={postal}
        onChange={(event) => setPostal(normalizePostal(event.target.value).slice(0, 7))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void setFromPostal(); } }} />
      <button type="button" className="btn secondary" disabled={locating || !postal.trim()} onClick={() => void setFromPostal()}>Set</button>
    </div>
    <RangeField id="max-distance" label={distanceLabel} value={distanceKm} min={0.5} max={15} step={0.5} format={(km) => `${km} km`} onChange={onDistance} />
  </div>;
}
