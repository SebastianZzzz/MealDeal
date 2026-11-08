import assert from "node:assert/strict";
import test from "node:test";
import { dietaryFieldErrors, normalizeDietary, withDietary } from "./profile-validation.ts";

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

const base = { dietary: [] as string[], meatVegRatio: "more_meat" as const };

test("picking vegetarian or vegan sets a vegetarian meal balance", () => {
  assert.deepEqual(withDietary(base, ["Vegetarian"]), { dietary: ["Vegetarian"], meatVegRatio: "vegetarian" });
  assert.deepEqual(withDietary(base, ["Halal", "Vegan"]), { dietary: ["Halal", "Vegan"], meatVegRatio: "vegetarian" });
});

test("vegan and vegetarian replace each other", () => {
  const vegetarian = withDietary(base, ["Vegetarian"]);
  assert.deepEqual(withDietary(vegetarian, ["Vegetarian", "Vegan"]).dietary, ["Vegan"]);
  assert.deepEqual(withDietary({ ...vegetarian, dietary: ["Vegan"] }, ["Vegan", "Vegetarian"]).dietary, ["Vegetarian"]);
});

test("removing the last plant-based diet goes back to balanced; other changes keep the balance", () => {
  assert.deepEqual(withDietary({ dietary: ["Vegetarian", "Halal"], meatVegRatio: "vegetarian" }, ["Halal"]), { dietary: ["Halal"], meatVegRatio: "balanced" });
  assert.deepEqual(withDietary(base, ["Kosher"]), { dietary: ["Kosher"], meatVegRatio: "more_meat" });
});

test("older profiles keep a vegetarian meal balance as a dietary need", () => {
  assert.deepEqual(normalizeDietary({ dietary: [], meatVegRatio: "vegetarian" }), { dietary: ["Vegetarian"], meatVegRatio: "vegetarian" });
  assert.deepEqual(normalizeDietary({ dietary: ["vegan"], meatVegRatio: "balanced" }), { dietary: ["vegan"], meatVegRatio: "vegetarian" });
  assert.deepEqual(normalizeDietary(base), base);
});
