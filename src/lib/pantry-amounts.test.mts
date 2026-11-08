import { test } from "node:test";
import assert from "node:assert/strict";
import { estimatePantryGrams, guessPantryKind } from "./pantry-amounts.ts";

test("seasonings are detected from common names", () => {
  for (const name of ["Soy sauce", "salt", "Olive oil", "black pepper", "Pepper", "Rice vinegar", "Chili flakes", "sesame oil"]) {
    assert.equal(guessPantryKind(name), "seasoning", name);
  }
  for (const name of ["Rice", "eggs", "Chicken thighs", "tofu", "Broccoli", "spaghetti", "Peppers"]) {
    assert.equal(guessPantryKind(name), "ingredient", name);
  }
});

test("seasonings never limit the plan", () => {
  assert.equal(estimatePantryGrams({ name: "soy sauce", amount: "little" }), undefined);
  assert.equal(estimatePantryGrams({ name: "Salt", kind: "seasoning" }), undefined);
});

test("rough amounts depend on whether the item is a staple", () => {
  assert.equal(estimatePantryGrams({ name: "Jasmine rice", amount: "little" }), 300);
  assert.equal(estimatePantryGrams({ name: "Jasmine rice", amount: "some" }), 1000);
  assert.equal(estimatePantryGrams({ name: "Eggs", amount: "little" }), 150);
  assert.equal(estimatePantryGrams({ name: "Chicken thighs", amount: "some" }), 400);
});

test("plenty and not sure mean no limit; an exact amount wins", () => {
  assert.equal(estimatePantryGrams({ name: "Rice", amount: "plenty" }), undefined);
  assert.equal(estimatePantryGrams({ name: "Rice", amount: "unknown" }), undefined);
  assert.equal(estimatePantryGrams({ name: "Rice" }), undefined);
  assert.equal(estimatePantryGrams({ name: "Rice", amount: "little", qtyG: 2000 }), 2000);
  assert.equal(estimatePantryGrams({ name: "Rice", amount: "little", qtyG: 0 }), 300);
});

test("the user can override a wrong guess", () => {
  assert.equal(estimatePantryGrams({ name: "Peanut butter", kind: "ingredient", amount: "little" }), 150);
  assert.equal(estimatePantryGrams({ name: "Frozen dumplings", kind: "seasoning", amount: "little" }), undefined);
});
