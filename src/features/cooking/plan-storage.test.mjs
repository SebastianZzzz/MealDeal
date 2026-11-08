import assert from "node:assert/strict";
import test from "node:test";
import { demoMealPlan } from "./mock-plan.ts";
import { canCook, CURRENT_PLAN_KEY, parseCurrentPlan, saveCurrentProgress } from "./plan-storage.ts";

function storageFor(plan) {
  const values = new Map([[CURRENT_PLAN_KEY, JSON.stringify(plan)]]);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("missing, malformed, and incompatible saved plans have distinct safe outcomes", () => {
  assert.equal(parseCurrentPlan(null), null);
  for (const raw of ["bad json", "null", "{}", JSON.stringify({ chosen: { recipes: [] } })]) assert.throws(() => parseCurrentPlan(raw));
  const plan = structuredClone(demoMealPlan);
  plan.chosen.recipes[0].steps[0].index = 2;
  assert.throws(() => parseCurrentPlan(JSON.stringify(plan)));
});

test("cooking requires the shopping stage to be complete", () => {
  const plan = structuredClone(demoMealPlan);
  assert.equal(canCook(plan), true);
  plan.status = "shopping";
  assert.equal(canCook(plan), false);
  plan.status = "cooking";
  plan.chosen.shoppingList = [{ bought: false }];
  assert.equal(canCook(plan), false);
});

test("saving D's progress preserves C's quantities, shopping list, request and metadata", () => {
  const plan = structuredClone(demoMealPlan);
  plan.chosen.shoppingList = [{ productId: "tomato", storeId: "market", name: "Tomatoes", packages: 1, packageSizeG: 500, packagePrice: 2, lineTotal: 2, bought: true }];
  const latest = structuredClone(plan);
  latest.integrationMetadata = { fromC: true };
  const storage = storageFor(latest);
  const next = saveCurrentProgress(storage, plan, { "tomato-eggs": 2, "steamed-rice": 1 });
  assert.deepEqual(next.chosen, latest.chosen);
  assert.deepEqual(next.request, latest.request);
  assert.deepEqual(next.integrationMetadata, latest.integrationMetadata);
  assert.equal(next.status, "cooking");
  assert.equal(JSON.parse(storage.getItem(CURRENT_PLAN_KEY)).progress["tomato-eggs"], 2);
});

test("all recipes complete marks done; restarting one recipe restores cooking", () => {
  const plan = structuredClone(demoMealPlan);
  const storage = storageFor(plan);
  const done = Object.fromEntries(plan.chosen.recipes.map((item) => [item.id, item.steps.length + 1]));
  assert.equal(saveCurrentProgress(storage, plan, done).status, "done");
  assert.equal(saveCurrentProgress(storage, plan, { ...done, "tomato-eggs": 1 }).status, "cooking");
});

test("a stale cooking tab cannot overwrite another chosen plan or unfinished shopping", () => {
  const plan = structuredClone(demoMealPlan);
  const changed = structuredClone(plan);
  changed.id = "a-different-plan";
  const storage = storageFor(changed);
  assert.throws(() => saveCurrentProgress(storage, plan, {}));
  assert.equal(parseCurrentPlan(storage.getItem(CURRENT_PLAN_KEY)).id, changed.id);
  changed.id = plan.id; changed.status = "shopping";
  storage.setItem(CURRENT_PLAN_KEY, JSON.stringify(changed));
  assert.throws(() => saveCurrentProgress(storage, plan, { "tomato-eggs": 1, "steamed-rice": 1 }));
});
