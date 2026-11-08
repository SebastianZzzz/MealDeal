import assert from "node:assert/strict";
import test from "node:test";
import { createInventory, distanceKm, SURPLUS_KEY, validDraft } from "./inventory.ts";

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
