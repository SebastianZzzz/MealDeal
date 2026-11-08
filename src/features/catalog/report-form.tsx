"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Product } from "@/types";
import type { PriceTagResponse } from "@/app/api/extract/price-tag/route";
import { readApiError } from "@/lib/api-error";
import { CATEGORIES } from "./categories.ts";
import { normalizePrice } from "./pricing.ts";
import type { NearbyStore } from "./stores.ts";
import { ScreenHeader } from "@/components/screen-header";

const DEMO_CENTER = { lat: 49.2644, lng: -123.2537 };
const MAX_SIDE = 1280;

interface DraftItem {
  key: number;
  name: string;
  brand: string;
  sizeText: string;
  priceText: string;
  isSale: boolean;
  category: Product["category"];
  confidence: number;
}

let nextKey = 1;
const blankItem = (): DraftItem => ({
  key: nextKey++, name: "", brand: "", sizeText: "", priceText: "", isSale: false, category: "other", confidence: 1,
});

const todayInVancouver = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Vancouver" });

// Shrink the photo in the browser so uploads stay small and fast. The photo is never stored.
async function resizePhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

function pricePreview(item: DraftItem): { ok: boolean; text: string } {
  const n = normalizePrice(item.sizeText, item.priceText);
  if (!n) return { ok: false, text: 'Size or price not recognised. Try a size like "500 g", "2 lb" or "per lb", and a price like "$3.99" or "2 for $5".' };
  if (n.packageUnit === "piece") return { ok: true, text: `${n.packageSizeG} pieces · $${n.packagePrice.toFixed(2)} · $${n.pricePer100.toFixed(2)} each` };
  const unit = n.packageUnit === "ml" ? "ml" : "g";
  const size = `${Math.round(n.packageSizeG)} ${unit}`;
  const weightNote = n.soldByWeight ? " (sold by weight, priced per ~1 lb)" : "";
  return { ok: true, text: `${size} · $${n.packagePrice.toFixed(2)} · $${n.pricePer100.toFixed(2)} / 100 ${unit}${weightNote}` };
}

export function ReportForm() {
  const [center, setCenter] = useState(DEMO_CENTER);
  const [locationNote, setLocationNote] = useState("Finding stores near you…");
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [storeId, setStoreId] = useState("");
  const [date, setDate] = useState(todayInVancouver());
  const [items, setItems] = useState<DraftItem[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Product[] | null>(null);

  async function loadStores(at: { lat: number; lng: number }) {
    try {
      const response = await fetch(`/api/stores?lat=${at.lat}&lng=${at.lng}&km=5`);
      const data = (await response.json()) as { stores: NearbyStore[] };
      setStores(data.stores);
      setStoreId((current) => current || data.stores[0]?.id || "");
    } catch {
      setLocationNote("Could not load nearby stores.");
    }
  }

  useEffect(() => {
    const fallBackToDemo = (note: string) => {
      setLocationNote(note);
      void loadStores(DEMO_CENTER);
    };
    if (!navigator.geolocation) return fallBackToDemo("Location unavailable — showing stores near UBC.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const at = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCenter(at);
        setLocationNote("Nearest store is pre-selected. Change it if it's wrong.");
        void loadStores(at);
      },
      () => fallBackToDemo("Location unavailable — showing stores near UBC. Pick your store below."),
      { timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  async function readPhoto(file: File) {
    setReading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("image", await resizePhoto(file), "price-tag.jpg");
      form.append("lat", String(center.lat));
      form.append("lng", String(center.lng));
      const response = await fetch("/api/extract/price-tag", { method: "POST", body: form });
      if (!response.ok) throw new Error((await readApiError(response)).error);
      const result = (await response.json()) as PriceTagResponse;
      setItems(result.items.map((item) => ({
        key: nextKey++,
        name: item.name,
        brand: item.brand ?? "",
        sizeText: item.sizeText,
        priceText: item.priceText,
        isSale: item.isSale,
        category: item.category,
        confidence: item.confidence,
      })));
      if (result.nearbyStores.length) {
        setStores(result.nearbyStores);
        setStoreId((current) => current || result.nearbyStores[0].id);
      }
      setDate(result.date);
    } catch (cause) {
      setError(`${cause instanceof Error ? cause.message : "Could not read the photo."} You can enter the price manually.`);
    } finally {
      setReading(false);
    }
  }

  function update(key: number, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function submit() {
    const store = stores.find((s) => s.id === storeId);
    const ready = items.filter((item) => item.name.trim() && pricePreview(item).ok);
    if (!store || ready.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const results: Product[] = [];
      for (const item of ready) {
        const { distanceKm: _distance, ...storeData } = store;
        const response = await fetch("/api/products", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            storeId: store.id, store: storeData, name: item.name, brand: item.brand || undefined,
            sizeText: item.sizeText, priceText: item.priceText, isSale: item.isSale,
            category: item.category, confidence: item.confidence, date,
          }),
        });
        if (!response.ok) {
          const failure = await readApiError(response);
          const details = Object.values(failure.fields ?? {}).join(" ");
          throw new Error(`${item.name || "This price"}: ${failure.error}${details ? ` ${details}` : ""}`);
        }
        results.push((await response.json()).product);
      }
      setSaved(results);
      setItems([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the prices.");
    } finally {
      setSaving(false);
    }
  }

  const storeName = stores.find((s) => s.id === storeId)?.name ?? "";
  const readyCount = items.filter((item) => item.name.trim() && pricePreview(item).ok).length;

  if (saved) {
    return (
      <main className="page">
        <p className="planning-eyebrow">THANK YOU</p>
        <h1>Prices shared with your community</h1>
        <section className="card">
          <p className="muted">Community-reported at {storeName} · {date}</p>
          <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
            {saved.map((p) => <li key={p.id}>{p.name} — ${p.packagePrice.toFixed(2)}</li>)}
          </ul>
        </section>
        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          <Link className="btn primary" href="/cook">Plan a meal with these prices</Link>
          <button className="btn secondary" onClick={() => setSaved(null)}>Report another price</button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <ScreenHeader backHref="/" />
      <p className="planning-eyebrow">SHARE A PRICE</p>
      <h1>Snap a price tag.</h1>
      <p className="muted">We read the tag and work out the price per 100 g. Your photo is not saved.</p>

      <label className="btn primary" style={{ width: "100%", marginTop: 16, opacity: reading ? 0.6 : 1 }}>
        {reading ? "Reading the tag…" : items.length ? "Take another photo" : "Take a photo"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={reading}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void readPhoto(file);
          }}
        />
      </label>
      <button className="btn secondary" style={{ width: "100%", marginTop: 10 }} onClick={() => setItems((c) => [...c, blankItem()])}>
        Enter a price manually
      </button>

      {error && <p role="alert" style={{ color: "#a32626", lineHeight: 1.5 }}>{error}</p>}

      {items.map((item) => {
        const preview = pricePreview(item);
        const unsure = item.confidence < 0.7;
        return (
          <section key={item.key} className="card" style={{ marginTop: 16, borderColor: unsure ? "#e0b84c" : undefined }}>
            {unsure && <p style={{ margin: 0, color: "#8a6200", fontWeight: 700 }}>Hard to read — please double-check.</p>}
            <label className="field">Product<input value={item.name} onChange={(e) => update(item.key, { name: e.target.value })} placeholder="e.g. Jasmine rice" /></label>
            <label className="field">Brand (optional)<input value={item.brand} onChange={(e) => update(item.key, { brand: e.target.value })} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label className="field">Size<input value={item.sizeText} onChange={(e) => update(item.key, { sizeText: e.target.value })} placeholder="900 g / per lb" /></label>
              <label className="field">Price<input value={item.priceText} onChange={(e) => update(item.key, { priceText: e.target.value })} placeholder="$3.99" inputMode="decimal" /></label>
            </div>
            <p style={{ margin: "12px 0 0", color: preview.ok ? "var(--green)" : "#a32626", fontWeight: 700, lineHeight: 1.5 }}>{preview.text}</p>
            <label className="field">Category
              <select value={item.category} onChange={(e) => update(item.key, { category: e.target.value as Product["category"] })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
              </select>
            </label>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
                <input type="checkbox" checked={item.isSale} onChange={(e) => update(item.key, { isSale: e.target.checked })} style={{ width: 22, height: 22 }} />
                On sale
              </label>
              <button className="chip" style={{ minHeight: 44 }} onClick={() => setItems((c) => c.filter((i) => i.key !== item.key))}>Remove</button>
            </div>
          </section>
        );
      })}

      {items.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <label className="field">Store
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.distanceKm} km</option>)}
            </select>
          </label>
          <p className="muted" style={{ margin: "8px 0 0" }}>{locationNote}</p>
          <label className="field">Date seen<input type="date" value={date} max={todayInVancouver()} onChange={(e) => setDate(e.target.value)} /></label>
          <button type="button" className="btn primary" style={{ width: "100%", marginTop: 18 }} disabled={saving || !storeId || readyCount === 0} onClick={submit}>
            {saving ? "Saving…" : `Share ${readyCount} price${readyCount === 1 ? "" : "s"}`}
          </button>
          <p className="muted" style={{ fontSize: 16 }}>Shared prices are shown to everyone as “community-reported” with the date.</p>
        </section>
      )}

      <p className="muted" style={{ marginTop: 28, fontSize: 16 }}>Store data © OpenStreetMap contributors</p>
    </main>
  );
}
