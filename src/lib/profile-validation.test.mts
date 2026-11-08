import assert from "node:assert/strict";
import test from "node:test";
import { dietaryFieldErrors } from "./profile-validation.ts";

test("vegan and vegetarian cannot both be selected", () => {
  assert.deepEqual(
    dietaryFieldErrors({ dietary: ["Vegetarian", "Vegan"], meatVegRatio: "vegetarian" }),
    { dietary: "Vegan already covers vegetarian — choose one." },
  );
});

test("plant-based diets require vegetarian meal balance", () => {
  assert.deepEqual(
    dietaryFieldErrors({ dietary: ["Vegan"], meatVegRatio: "balanced" }),
    { meatVegRatio: "Choose Vegetarian meal balance for a vegetarian or vegan diet." },
  );
});

test("compatible dietary preferences pass", () => {
  assert.deepEqual(
    dietaryFieldErrors({ dietary: ["Vegan", "Halal"], meatVegRatio: "vegetarian" }),
    {},
  );
});
