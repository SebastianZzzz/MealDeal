import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePrice, parsePrice, parseSize } from "./pricing.ts";

test("parseSize: fixed weights, volumes and counts", () => {
  assert.deepEqual(parseSize("1.5 kg"), { kind: "fixed", qty: 1500, unit: "g" });
  assert.deepEqual(parseSize("900 g"), { kind: "fixed", qty: 900, unit: "g" });
  assert.deepEqual(parseSize("2 lb bag"), { kind: "fixed", qty: 907.184, unit: "g" });
  assert.deepEqual(parseSize("2 L"), { kind: "fixed", qty: 2000, unit: "ml" });
  assert.deepEqual(parseSize("355 mL"), { kind: "fixed", qty: 355, unit: "ml" });
  assert.deepEqual(parseSize("4 x 100 g"), { kind: "fixed", qty: 400, unit: "g" });
  assert.deepEqual(parseSize("6x355ml"), { kind: "fixed", qty: 2130, unit: "ml" });
  assert.deepEqual(parseSize("12 pk"), { kind: "fixed", qty: 12, unit: "piece" });
  assert.deepEqual(parseSize("1 dozen"), { kind: "fixed", qty: 12, unit: "piece" });
});

test("parseSize: sold by weight", () => {
  assert.deepEqual(parseSize("per lb"), { kind: "per_weight", basisG: 453.592 });
  assert.deepEqual(parseSize("/kg"), { kind: "per_weight", basisG: 1000 });
  assert.deepEqual(parseSize("per 100 g"), { kind: "per_weight", basisG: 100 });
  assert.deepEqual(parseSize("lb"), { kind: "per_weight", basisG: 453.592 });
});

test("parseSize: unknown text", () => {
  assert.equal(parseSize(""), null);
  assert.equal(parseSize("assorted varieties"), null);
});

test("parsePrice: plain, per weight, multi-buy, cents", () => {
  assert.deepEqual(parsePrice("$4.99"), { amount: 4.99 });
  assert.deepEqual(parsePrice("$4.99 ea"), { amount: 4.99 });
  assert.deepEqual(parsePrice("$2.99/lb"), { amount: 2.99, perWeightG: 453.592 });
  assert.deepEqual(parsePrice("$9.90/kg"), { amount: 9.9, perWeightG: 1000 });
  assert.deepEqual(parsePrice("$1.29/100g"), { amount: 1.29, perWeightG: 100 });
  assert.deepEqual(parsePrice("$4.49 only lb $9.90/kg"), { amount: 4.49, perWeightG: 453.592 });
  assert.deepEqual(parsePrice("2 for $5"), { amount: 2.5 });
  assert.deepEqual(parsePrice("3/$10"), { amount: 3.3333 });
  assert.deepEqual(parsePrice("99¢"), { amount: 0.99 });
  assert.equal(parsePrice("Great deal"), null);
});

test("normalizePrice: packaged goods", () => {
  assert.deepEqual(normalizePrice("2 kg", "$4.99"), {
    packageSizeG: 2000, packageUnit: "g", packagePrice: 4.99, pricePer100: 0.2495, soldByWeight: false,
  });
  assert.deepEqual(normalizePrice("400 g", "2 for $5"), {
    packageSizeG: 400, packageUnit: "g", packagePrice: 2.5, pricePer100: 0.625, soldByWeight: false,
  });
  assert.deepEqual(normalizePrice("12 pk", "$3.60"), {
    packageSizeG: 12, packageUnit: "piece", packagePrice: 3.6, pricePer100: 0.3, soldByWeight: false,
  });
});

test("normalizePrice: sold by weight uses a nominal package", () => {
  // $2.99/lb -> 1 lb nominal package
  assert.deepEqual(normalizePrice("per lb", "$2.99/lb"), {
    packageSizeG: 453.592, packageUnit: "g", packagePrice: 2.99, pricePer100: 0.6592, soldByWeight: true,
  });
  // $8.80/kg -> 500 g nominal package
  assert.deepEqual(normalizePrice(null, "$8.80/kg"), {
    packageSizeG: 500, packageUnit: "g", packagePrice: 4.4, pricePer100: 0.88, soldByWeight: true,
  });
  // A printed weight beats the nominal amount
  assert.deepEqual(normalizePrice("1.2 kg", "$5.00/kg"), {
    packageSizeG: 1200, packageUnit: "g", packagePrice: 6, pricePer100: 0.5, soldByWeight: false,
  });
});

test("normalizePrice: missing size for a packaged item is rejected", () => {
  assert.equal(normalizePrice(null, "$4.99"), null);
  assert.equal(normalizePrice("2 kg", null), null);
});
