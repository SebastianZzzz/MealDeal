import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateDeal } from "./deal.ts";
import { sampleHistory } from "./sample-history.ts";

const products = JSON.parse(readFileSync(new URL("../../../mock/products.json", import.meta.url), "utf8"));

test("sample history only covers seeded products and is labeled", () => {
  const rows = sampleHistory(products);
  assert.ok(rows.length >= 12);
  assert.ok(rows.every((row) => row.source === "sample"));
  const ids = new Set(products.map((p: { id: string }) => p.id));
  assert.ok(rows.every((row) => ids.has(row.productId)));
});

test("each sample product produces the verdict it was designed for", () => {
  const rows = sampleHistory(products);
  const verdict = (id: string) => {
    const p = products.find((x: { id: string }) => x.id === id);
    return evaluateDeal(
      { productId: p.id, storeId: p.storeId, pricePer100: p.pricePer100, observedAt: p.reportedAt },
      rows.filter((r) => r.productId === id),
    ).verdict;
  };
  assert.equal(verdict("no-frills@west-5th-avenue:whole-pork-picnic-454g"), "real_deal");
  assert.equal(verdict("save-on-foods@5945-berton-avenue:western-family-jasmine-rice-907g"), "real_deal");
  assert.equal(verdict("save-on-foods@5945-berton-avenue:carrots-1361g"), "normal");
  assert.equal(verdict("no-frills@west-5th-avenue:broccoli-crowns-454g"), "pricier");
});
