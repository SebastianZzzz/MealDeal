import assert from "node:assert/strict";
import test from "node:test";
import { createInventory, distanceKm, SURPLUS_KEY, validDraft } from "./inventory.ts";
import { buildSampleDraft, PICKUP_DELAYS, PICKUP_DURATIONS } from "./sample-draft.ts";
import { availability, available, listingPage, listingsInRange, sortedListings } from "./presentation.ts";

const now = Date.parse("2026-11-07T23:00:00Z");
const fixture = () => ({
  id: "last-portion", merchantName: "Sample bakery", address: "Sample pickup address", lat: 49.266, lng: -123.243,
  title: "Bread bag", origPrice: 10, price: 3, qtyLeft: 1, allergens: ["wheat"], isSample: true,
  createdAt: new Date(now).toISOString(), pickupStart: new Date(now + 60000).toISOString(), pickupEnd: new Date(now + 3600000).toISOString(),
});
function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function exclusiveLock() {
  let queue = Promise.resolve();
  return (work) => { const next = queue.then(work); queue = next.catch(() => {}); return next; };
}

test("concurrent reservations from separate store instances cannot oversell the last portion", async () => {
  const storage = memoryStorage();
  const lock = exclusiveLock();
  const tabA = createInventory(storage, lock, [fixture()]);
  const tabB = createInventory(storage, lock, [fixture()]);
  const results = await Promise.all(Array.from({ length: 30 }, (_, index) => (index % 2 ? tabA : tabB).reserve("last-portion", now)));
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => result.reason === "sold_out").length, 29);
  assert.equal(tabA.read()[0].qtyLeft, 0);
  await tabB.initialize();
  assert.equal(tabB.read()[0].qtyLeft, 0, "reopening must not reseed sold-out inventory");
});

test("expired and missing listings do not decrement stock", async () => {
  const inventory = createInventory(memoryStorage(), exclusiveLock(), [fixture()]);
  assert.deepEqual(await inventory.reserve("last-portion", now + 3600000), { ok: false, reason: "expired" });
  assert.deepEqual(await inventory.reserve("missing", now), { ok: false, reason: "missing" });
  assert.equal(inventory.read()[0].qtyLeft, 1);
});

test("pickup expiry is checked after acquiring the lock", async () => {
  let time = now;
  const lock = async (work) => { time = now + 3600000; return work(); };
  const inventory = createInventory(memoryStorage(), lock, [fixture()]);
  assert.deepEqual(await inventory.reserve("last-portion", () => time), { ok: false, reason: "expired" });
  assert.equal(inventory.read()[0].qtyLeft, 1);
});

test("posting validates data and forces sample labeling", async () => {
  const inventory = createInventory(memoryStorage(), exclusiveLock(), []);
  const draft = { ...fixture(), isSample: false };
  const saved = await inventory.post(draft, "new-listing", now);
  assert.equal(saved.isSample, true);
  assert.equal(saved.id, "new-listing");
  assert.equal(inventory.read().length, 1);
  await assert.rejects(inventory.post({ ...draft, price: 11 }, "bad-price", now));
  await assert.rejects(inventory.post({ ...draft, qtyLeft: -1 }, "bad-qty", now));
  await assert.rejects(inventory.post(draft, "new-listing", now));
  await assert.rejects(inventory.post(draft, "old-window", now + 7200000));
});

test("corrupted storage is reported without silently replacing existing inventory", async () => {
  const storage = memoryStorage();
  storage.setItem(SURPLUS_KEY, "invalid-json");
  const inventory = createInventory(storage, exclusiveLock(), [fixture()]);
  await assert.rejects(inventory.reserve("last-portion", now));
  assert.equal(storage.getItem(SURPLUS_KEY), "invalid-json");
});

test("a failed write never returns a successful reservation", async () => {
  const inventory = createInventory({ getItem: () => null, setItem: () => { throw new Error("Storage denied"); } }, exclusiveLock(), [fixture()]);
  await assert.rejects(inventory.reserve("last-portion", now), /Storage denied/);
  assert.equal(inventory.read()[0].qtyLeft, 1);
});

test("money, coordinates, quantity and pickup windows must be valid", () => {
  const draft = fixture();
  assert.equal(validDraft(draft), true);
  for (const invalid of [{ price: 1.234 }, { lat: 91 }, { lng: Number.NaN }, { qtyLeft: 1.5 }, { pickupEnd: draft.pickupStart }, { allergens: [""] }]) {
    assert.equal(validDraft({ ...draft, ...invalid }), false);
  }
});

test("distance sorting uses a finite straight-line distance", () => {
  assert.equal(distanceKm({ lat: 49, lng: -123 }, { lat: 49, lng: -123 }), 0);
  const nearby = distanceKm({ lat: 49.266, lng: -123.243 }, { lat: 49.267, lng: -123.244 });
  assert.ok(nearby > 0 && nearby < 1);
});

test("sample composer preserves meal facts and calculates every pickup window at publish time", () => {
  const meal = fixture();
  for (const delay of PICKUP_DELAYS) {
    for (const duration of PICKUP_DURATIONS) {
      const publishedAt = now + 3 * 86400000;
      const draft = buildSampleDraft(meal, { price: 2.99, origPrice: 10, qtyLeft: 2, delay, duration }, publishedAt);
      assert.equal(Date.parse(draft.pickupStart), publishedAt + delay * 60000);
      assert.equal(Date.parse(draft.pickupEnd) - Date.parse(draft.pickupStart), duration * 60000);
      assert.equal(validDraft(draft), true);
      assert.equal(draft.address, meal.address);
      assert.equal(draft.lat, meal.lat);
      assert.deepEqual(draft.allergens, meal.allergens);
      assert.equal(draft.price, 2.99);
      assert.equal("id" in draft, false);
      assert.equal("isSample" in draft, false);
    }
  }
});

test("relative pickup durations remain exact across Vancouver daylight-saving changes", () => {
  const publishedAt = Date.parse("2026-11-01T08:45:00Z");
  const draft = buildSampleDraft(fixture(), { price: 3, origPrice: 10, qtyLeft: 1, delay: 30, duration: 120 }, publishedAt);
  assert.equal(draft.pickupStart, "2026-11-01T09:15:00.000Z");
  assert.equal(draft.pickupEnd, "2026-11-01T11:15:00.000Z");
});

test("sample composer rejects unsupported time choices and invalid price or quantity", () => {
  const choices = { price: 3, origPrice: 10, qtyLeft: 1, delay: 30, duration: 60 };
  for (const invalid of [{ delay: -30 }, { delay: 15 }, { duration: 0 }, { duration: 90 }, { price: 11 }, { price: 1.234 }, { qtyLeft: 0 }, { qtyLeft: 1.5 }]) {
    assert.throws(() => buildSampleDraft(fixture(), { ...choices, ...invalid }, now));
  }
});

test("availability expires at the boundary and filtering never mutates inventory", () => {
  const active = fixture();
  const soldOut = { ...active, id: "sold-out", qtyLeft: 0, price: 0 };
  const expired = { ...active, id: "expired", pickupEnd: new Date(now).toISOString(), price: 0 };
  assert.equal(available(expired, now), false);
  assert.equal(availability(expired, now), "Pickup ended");
  assert.equal(availability(soldOut, now), "Sold out");
  const items = [expired, soldOut, active];
  assert.deepEqual(sortedListings(items, now, true, null).map((item) => item.id), [active.id]);
  assert.equal(sortedListings(items, now, false, null)[0].id, active.id);
  assert.deepEqual(items, [expired, soldOut, active]);
});

test("meal order switches between price and actual straight-line distance", () => {
  const near = { ...fixture(), id: "near", price: 5 };
  const cheap = { ...fixture(), id: "cheap", lat: 49.3, price: 1 };
  assert.equal(sortedListings([near, cheap], now, true, null)[0].id, "cheap");
  assert.equal(sortedListings([cheap, near], now, true, { lat: near.lat, lng: near.lng })[0].id, "near");
});

test("pickup radius applies independently of the selected price or distance sort", () => {
  const near = fixture();
  const far = { ...fixture(), id: "far", lat: 50, price: 0 };
  const origin = { lat: near.lat, lng: near.lng };
  const inRange = listingsInRange([far, near], origin, 3);
  assert.deepEqual(inRange.map((item) => item.id), [near.id]);
  assert.equal(sortedListings(inRange, now, true, null)[0].id, near.id);
  assert.equal(listingsInRange([near, far], null, 3).length, 2);
});

test("three-meal pagination clamps the page after stock or radius changes", () => {
  const items = Array.from({ length: 8 }, (_, index) => ({ ...fixture(), id: String(index) }));
  assert.deepEqual(listingPage(items, 1).visible.map((item) => item.id), ["3", "4", "5"]);
  assert.equal(listingPage(items, 2).visible.length, 2);
  assert.equal(listingPage(items.slice(0, 2), 2).current, 0);
  assert.deepEqual(listingPage([], 10), { pages: 1, current: 0, visible: [] });
});
