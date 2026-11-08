import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Food, Product } from "@/types";
import { acceptFoodMatches, assignFoods, matchFood } from "./nutrition.ts";

const foods: Food[] = JSON.parse(readFileSync(new URL("../../../mock/foods.json", import.meta.url), "utf8"));
const products: Product[] = JSON.parse(readFileSync(new URL("../../../mock/products.json", import.meta.url), "utf8"));
const foodIds = new Set(foods.map((food) => food.id));

test("foods have unique ids, a database reference and plausible values", () => {
  assert.equal(foodIds.size, foods.length);
  for (const food of foods) {
    assert.ok(food.dbRef?.startsWith("USDA"), food.id);
    const fromMacros = food.proteinG * 4 + food.carbG * 4 + food.fatG * 9;
    assert.ok(Math.abs(fromMacros - food.kcal) <= food.kcal * 0.12 + 10, `${food.id}: ${fromMacros} vs ${food.kcal}`);
  }
});

test("code rules match common products and pantry names", () => {
  const cases: [string, string | undefined][] = [
    ["Western Family Jasmine Rice", "rice-white-raw"],
    ["Catelli Protein+ Pasta", "pasta-dry"],
    ["Sapporo Ichiban Noodles", "noodles-ramen-dry"],
    ["Western Family Protein Oatmeal", "oats-dry"],
    ["Natural Bakery Sourdough Bread", "bread-sourdough"],
    ["Country Harvest Bread", "bread-whole-wheat"],
    ["Chicken Breast", "chicken-breast-raw"],
    ["Only Goodness Chicken Drumsticks", "chicken-drumstick-raw"],
    ["Split Chicken Wings", "chicken-wing-raw"],
    ["Pork Loin Chops", "pork-loin-chop-raw"],
    ["Whole Pork Picnic", "pork-shoulder-raw"],
    ["Signature Pork Tenderloin", "pork-tenderloin-raw"],
    ["Swiss Chalet Or Montana's Pork Back Ribs", undefined],
    ["Sunrise Tofu Or Tofu Dessert", "tofu-raw"],
    ["Kraft Cheese Slices", "cheese-processed"],
    ["Boursin Cheese", "cheese-cream"],
    ["Danone Oîkos Greek Yogurt", "yogurt-greek"],
    ["Liberté Méditerranée Yogurt", "yogurt-plain"],
    ["Gala Apples", "apple-raw"],
    ["Pineapple", undefined],
    ["eggs", "egg-raw"],
    ["soy sauce", "soy-sauce"],
    ["Peanut butter", undefined],
    ["Red peppers", "bell-pepper-raw"],
  ];
  for (const [name, expected] of cases) assert.equal(matchFood(name), expected, name);
});

test("every rule result exists in foods.json and almost every seed product matches by code", async () => {
  const assigned = await assignFoods(products, foods);
  for (const product of assigned) if (product.foodId) assert.ok(foodIds.has(product.foodId), product.foodId);
  const unmatched = assigned.filter((product) => !product.foodId).map((product) => product.name);
  assert.deepEqual(unmatched, ["Swiss Chalet Or Montana's Pork Back Ribs"]);
});

test("Gemini answers are limited to requested products and known foods", () => {
  const accepted = acceptFoodMatches([{ id: "a" }, { id: "b" }], [
    { id: "a", foodId: "rice-white-raw" },
    { id: "a", foodId: "pasta-dry" },
    { id: "b", foodId: "none" },
    { id: "c", foodId: "egg-raw" },
  ], foods);
  assert.deepEqual([...accepted], [["a", "rice-white-raw"]]);
});
