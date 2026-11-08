import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptClassifications } from "./classify.ts";

const inputs = [
  { id: "a", name: "Jasmine Rice" },
  { id: "b", name: "Chicken Drumsticks" },
];

test("acceptClassifications keeps answers for requested ids only", () => {
  const result = acceptClassifications(inputs, [
    { id: "a", category: "grain", mealFood: true },
    { id: "b", category: "protein", mealFood: true },
    { id: "invented", category: "fruit", mealFood: true },
  ]);
  assert.deepEqual([...result.keys()], ["a", "b"]);
  assert.equal(result.get("b")?.category, "protein");
});

test("acceptClassifications ignores duplicates and unknown categories", () => {
  const result = acceptClassifications(inputs, [
    { id: "a", category: "grain", mealFood: true },
    { id: "a", category: "fruit", mealFood: false },
    // @ts-expect-error: simulate a category outside the enum
    { id: "b", category: "candy", mealFood: false },
  ]);
  assert.equal(result.get("a")?.category, "grain");
  assert.equal(result.has("b"), false);
});
