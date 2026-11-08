import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateDeal, median, verdictFor } from "./deal.ts";

const current = { productId: "p", storeId: "s@a", pricePer100: 0.8, observedAt: "2026-11-07T12:00:00Z" };
const daysAgo = (n: number) => new Date(Date.parse(current.observedAt) - n * 86_400_000).toISOString();
const point = (pricePer100: number, days: number, source: "flyer" | "report" | "sample" = "flyer") => ({
  pricePer100, observedAt: daysAgo(days), source,
});

test("median handles odd and even counts", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test("verdict thresholds are inclusive at ±10%", () => {
  assert.equal(verdictFor(-10), "real_deal");
  assert.equal(verdictFor(-9.9), "normal");
  assert.equal(verdictFor(9.9), "normal");
  assert.equal(verdictFor(10), "pricier");
});

test("real deal: 20% below the 28-day median", () => {
  const deal = evaluateDeal(current, [point(1.0, 7), point(1.0, 14), point(1.1, 21), point(0.9, 27)]);
  assert.equal(deal.verdict, "real_deal");
  assert.equal(deal.medianPer100, 1);
  assert.equal(deal.diffPct, -20);
  assert.equal(deal.observations, 4);
});

test("pricier and normal", () => {
  assert.equal(evaluateDeal(current, [point(0.7, 3), point(0.7, 10), point(0.7, 17)]).verdict, "pricier");
  assert.equal(evaluateDeal(current, [point(0.78, 3), point(0.8, 10), point(0.82, 17)]).verdict, "normal");
});

test("fewer than 3 earlier observations is not enough data", () => {
  const deal = evaluateDeal(current, [point(1.0, 7), point(1.0, 14)]);
  assert.equal(deal.verdict, "not_enough_data");
  assert.equal(deal.medianPer100, undefined);
});

test("ignores the current observation, future rows and rows older than 28 days", () => {
  const history = [
    { pricePer100: 0.8, observedAt: current.observedAt, source: "report" as const }, // itself
    point(5, -1), // in the future
    point(5, 29), // too old
    point(1.0, 1), point(1.0, 2),
  ];
  const deal = evaluateDeal(current, history);
  assert.equal(deal.observations, 2);
  assert.equal(deal.verdict, "not_enough_data");
});

test("flags sample history so the UI can label it", () => {
  const deal = evaluateDeal(current, [point(1, 7, "sample"), point(1, 14, "sample"), point(1, 21, "flyer")]);
  assert.equal(deal.hasSampleData, true);
});
