import { test } from "node:test";
import assert from "node:assert/strict";
import { recordPrice, rowToProduct, selectProducts, type Queryable } from "./catalog-sql.ts";

const product = {
  id: "save-on-foods@5945-berton-avenue:carrots-1361g",
  storeId: "save-on-foods@5945-berton-avenue",
  name: "Carrots",
  packageSizeG: 1360.776,
  packageUnit: "g" as const,
  packagePrice: 3.99,
  pricePer100: 0.2932,
  isSale: true,
  source: "report" as const,
  confidence: 1,
  reportedAt: "2026-11-07T20:00:00.000Z",
  category: "vegetable" as const,
};

function fakeDb(failOn?: RegExp) {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const db: Queryable = {
    async query(sql, params) {
      calls.push({ sql: sql.trim().split(/\s+/).slice(0, 3).join(" "), params });
      if (failOn?.test(sql)) throw new Error("boom");
      return { rows: [] };
    },
  };
  return { db, calls };
}

test("rowToProduct converts pg numeric strings and nulls to the Product contract", () => {
  const p = rowToProduct({
    id: "x", store_id: "s@a", food_id: null, name: "Rice", brand: null, package_size_g: "907",
    package_unit: "g", package_price: "2.99", price_per_100: "0.3297", is_sale: true,
    valid_until: new Date("2026-11-12T04:59:59Z"), source: "flyer", confidence: "1",
    reported_by: null, reported_at: new Date("2026-11-05T07:00:00Z"), category: "grain",
  });
  assert.equal(p.packageSizeG, 907);
  assert.equal(p.packagePrice, 2.99);
  assert.equal(p.pricePer100, 0.3297);
  assert.equal(p.foodId, undefined);
  assert.equal(p.brand, undefined);
  assert.equal(p.validUntil, "2026-11-12T04:59:59.000Z");
  assert.equal(p.reportedAt, "2026-11-05T07:00:00.000Z");
});

test("recordPrice writes the product and its history row in one transaction", async () => {
  const { db, calls } = fakeDb();
  await recordPrice(db, product);
  assert.deepEqual(calls.map((c) => c.sql), ["begin", "insert into products", "insert into price_observations", "commit"]);
  const observation = calls[2].params!;
  assert.deepEqual(observation, [product.reportedAt, product.id, product.storeId, 3.99, 0.2932, true, "report"]);
});

test("recordPrice rolls back when the history insert fails", async () => {
  const { db, calls } = fakeDb(/price_observations/);
  await assert.rejects(recordPrice(db, product), /boom/);
  assert.deepEqual(calls.map((c) => c.sql), ["begin", "insert into products", "insert into price_observations", "rollback"]);
});

test("selectProducts passes filters as parameters, never as SQL text", async () => {
  const { db, calls } = fakeDb();
  const now = new Date("2026-11-08T00:00:00Z");
  await selectProducts(db, { storeIds: ["a@b"], category: "protein", now });
  assert.deepEqual(calls[0].params, [["a@b"], "protein", false, now]);
  await selectProducts(db, {});
  assert.deepEqual(calls[1].params?.slice(0, 3), [null, null, false]);
});
