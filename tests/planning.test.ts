import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateOption } from "../src/features/planning/calculate";
import { filterProducts, blockedByProfile } from "../src/features/planning/filter";
import { adaptProfile } from "../src/features/planning/adapter";
import { draftOptionSchema, planRequestSchema } from "../src/features/planning/schema";
import { getMealSlots } from "../src/features/planning/slots";
import { generatePlan } from "../src/features/planning/service";
import type { PlanningInput } from "../src/features/planning/schema";
import { defaultProfile } from "../src/contracts/profile";
import type { DraftOption } from "../src/features/planning/schema";
import type { Food, PantryItem, PlanRequest, Product, Store } from "../src/types";

const request: PlanRequest = { budget: 10, servings: 2, duration: "one_meal", batchCook: false, cuisines: [], meatVeg: "balanced" };
const product: Product = { id: "rice", storeId: "near", name: "Rice", packageSizeG: 500, packagePrice: 2.5, packageUnit: "g", pricePer100: 999, isSale: true, source: "flyer", confidence: 1, reportedAt: "2026-11-07" };
const store: Store = { id: "near", name: "Near", chain: "Test", address: "Test", lat: 49.26, lng: -123.25 };
const food: Food = { id: "food-rice", name: "Rice (test fixture)", kcal: 100, proteinG: 10, fatG: 2, carbG: 20 };

function draft(qtyG = 100, mealSlots = ["day1-dinner"]): DraftOption {
  return { title: "Rice plan", recipes: [{ title: "Rice", mealSlots, baseServings: 1, ingredients: [{ productId: "rice", pantryItemId: null, name: "Model label", qtyG }], steps: [{ summary: "Cook", detail: "Cook the rice.", timerSec: 600 }], totalMinutes: 15 }] };
}

test("sums repeated product quantities before rounding up packages", () => {
  const plan = draft(120);
  plan.recipes.push(structuredClone(plan.recipes[0]));
  const result = calculateOption(plan, request, [product], [], [], "plan").option;
  assert.equal(result.shoppingList[0].packages, 1);
  assert.equal(result.shoppingCost, 2.5);
  assert.equal(result.recipeCost, 2.4);
  assert.equal(result.costPerServing, 1.2);
  assert.equal(result.leftovers[0].qtyG, 20);
  assert.equal(result.recipes[0].ingredients[0].name, "Rice");
});

test("whole-package shopping cost controls the budget", () => {
  const result = calculateOption(draft(1), { ...request, budget: 1 }, [product], [], [], "p").option;
  assert.equal(result.recipeCost, 0.01);
  assert.equal(result.shoppingCost, 2.5);
  assert.equal(result.withinBudget, false);
});

test("exact package boundaries and budget equality are handled", () => {
  const result = calculateOption(draft(250), { ...request, budget: 2.5 }, [product], [], [], "p").option;
  assert.equal(result.shoppingList[0].packages, 1);
  assert.deepEqual(result.leftovers, []);
  assert.equal(result.withinBudget, true);
});

test("batch cooking scales by people times covered meals", () => {
  const req = { ...request, duration: "days" as const, days: 3, batchCook: true };
  const result = calculateOption(draft(100, getMealSlots(req)), req, [product], [], [], "p").option;
  assert.equal(result.recipes[0].servings, 6);
  assert.equal(result.recipes[0].ingredients[0].qtyG, 600);
  assert.equal(result.shoppingList[0].packages, 2);
  assert.equal(result.costPerServing, 0.5);
  assert.ok(result.recipes[0].steps[0].timerSec! > 600);
  assert.equal(result.recipes[0].steps[0].index, 1);
});

test("rejects missing, foreign and duplicate meal slots", () => {
  const req = { ...request, duration: "days" as const, days: 2, batchCook: true };
  assert.throws(() => calculateOption(draft(), req, [product], [], [], "p"), /every requested meal/);
  assert.throws(() => calculateOption(draft(100, ["day3-dinner"]), request, [product], [], [], "p"), /outside/);
  assert.throws(() => calculateOption(draft(100, ["day1-dinner", "day1-dinner"]), request, [product], [], [], "p"), /repeats/);
});

test("rejects multi-meal recipes when batch cooking is off", () => {
  const req = { ...request, duration: "days" as const, days: 2 };
  assert.throws(() => calculateOption(draft(100, getMealSlots(req)), req, [product], [], [], "p"), /disabled/);
});

test("rejects unknown ingredient IDs and dual ingredient sources", () => {
  assert.throws(() => calculateOption(draft(), request, [], [], [], "p"), /unknown/);
  const plan = draft();
  plan.recipes[0].ingredients[0].pantryItemId = "pantry";
  assert.equal(draftOptionSchema.safeParse(plan).success, false);
});

test("pantry is free but finite stock is enforced across recipes", () => {
  const pantry: PantryItem = { id: "owned", userId: "test", name: "Rice", qtyG: 300, updatedAt: "2026-11-07" };
  const plan = draft();
  plan.recipes[0].ingredients = [{ productId: null, pantryItemId: pantry.id, name: "Rice", qtyG: 100 }];
  const result = calculateOption(plan, { ...request, budget: 0 }, [], [pantry], [], "p").option;
  assert.equal(result.shoppingCost, 0);
  assert.equal(result.recipeCost, 0);
  assert.equal(result.withinBudget, true);
  plan.recipes.push(structuredClone(plan.recipes[0]));
  assert.throws(() => calculateOption(plan, request, [], [pantry], [], "p"), /Not enough pantry/);
});

test("nutrition uses database values and omits unquantified data", () => {
  const result = calculateOption(draft(), request, [{ ...product, foodId: food.id }], [], [food], "p");
  assert.equal(result.option.nutritionTotal?.proteinG, 20);
  assert.equal(result.option.recipes[0].nutritionPerServing?.proteinG, 10);
  assert.deepEqual(result.missingNutrition, []);
  const absent = calculateOption(draft(), request, [product], [], [food], "p");
  assert.equal(absent.option.nutritionTotal, undefined);
  assert.deepEqual(absent.missingNutrition, ["Rice"]);
});

test("filters expiry at Vancouver calendar-day boundary, distance and incompatible units", () => {
  const profile = { ...adaptProfile(defaultProfile), home: { lat: store.lat, lng: store.lng }, maxDistanceKm: 5 };
  const products: Product[] = [
    { ...product, id: "today", validUntil: "2026-11-07" },
    { ...product, id: "expired", validUntil: "2026-11-06" },
    { ...product, id: "far", storeId: "far" },
    { ...product, id: "piece", packageUnit: "piece" },
    { ...product, id: "unknown-store", storeId: "missing" },
    { ...product, id: "invalid-date", validUntil: "2026-99-99" },
  ];
  const result = filterProducts(products, [store, { ...store, id: "far", lat: 50 }], profile, new Date("2026-11-08T06:00:00Z"));
  assert.deepEqual(result.map((item) => item.id), ["today"]);
  assert.equal(result[0].pricePer100, 0.5);
});

test("filters common allergy aliases and vegetarian or vegan restrictions", () => {
  const profile = adaptProfile(defaultProfile);
  assert.equal(blockedByProfile("Peanut butter", { ...profile, allergies: ["Peanuts"] }), true);
  assert.equal(blockedByProfile("Firm tofu", { ...profile, allergies: ["Soy"] }), true);
  assert.equal(blockedByProfile("Chicken breast", { ...profile, meatVeg: "vegetarian" }), true);
  assert.equal(blockedByProfile("Milk", { ...profile, dietary: ["Vegan"] }), true);
  assert.equal(blockedByProfile("Rice", { ...profile, dietary: ["Vegan"] }), false);
});

test("validates request bounds and scaled cooking duration", () => {
  assert.equal(planRequestSchema.safeParse({ ...request, duration: "days" }).success, false);
  assert.equal(planRequestSchema.safeParse({ ...request, servings: 0 }).success, false);
  assert.equal(planRequestSchema.safeParse({ ...request, days: 8 }).success, false);
  assert.throws(() => calculateOption(draft(), { ...request, maxCookMinutes: 5 }, [product], [], [], "p"), /cooking time/);
  assert.equal(getMealSlots({ ...request, duration: "days", days: 7, mealsPerDay: 3 }).length, 21);
});

function modelDraft(qtyG = 100): DraftOption {
  const plan = draft(qtyG);
  plan.recipes[0].ingredients[0].productId = "sample-rice";
  return plan;
}

async function withGeminiMock(run: () => Promise<void>, respond: (call: number, init?: RequestInit) => Response) {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousDemo = process.env.NEXT_PUBLIC_DEMO_MODE;
  process.env.GEMINI_API_KEY = "test-placeholder-never-sent";
  process.env.NEXT_PUBLIC_DEMO_MODE = "1";
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    return respond(calls, init);
  };
  try {
    await run();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previousKey;
    }
    if (previousDemo === undefined) {
      delete process.env.NEXT_PUBLIC_DEMO_MODE;
    } else {
      process.env.NEXT_PUBLIC_DEMO_MODE = previousDemo;
    }
  }
}

function geminiResponse(options: DraftOption[]): Response {
  return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ options }) }] } }] });
}

const input: PlanningInput = { request, profile: adaptProfile(defaultProfile), pantry: [] };

test("Gemini request uses structured JSON and code ignores invented prices", async () => {
  await withGeminiMock(async () => {
    const result = await generatePlan(input);
    assert.equal(result.meta.mode, "gemini");
    assert.equal(result.options.length, 2);
    assert.equal(result.options[0].shoppingCost, 2.49);
    assert.equal(result.options[0].recipes[0].ingredients[0].qtyG, 200);
  }, (_call, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.ok(body.generationConfig.responseJsonSchema.properties.options);
    const cheap = { ...modelDraft(), shoppingCost: 0.01 };
    return geminiResponse([cheap, modelDraft(120)]);
  });
});

test("invalid model IDs trigger a corrective retry", async () => {
  let calls = 0;
  await withGeminiMock(async () => {
    const result = await generatePlan(input);
    assert.equal(result.options.length, 2);
    assert.equal(calls, 2);
  }, (call, init) => {
    calls = call;
    if (call === 1) {
      const invalid = modelDraft();
      invalid.recipes[0].ingredients[0].productId = "not-a-candidate";
      return geminiResponse([invalid]);
    }
    assert.match(JSON.parse(String(init?.body)).contents[0].parts[0].text, /Previous attempt failed validation/);
    return geminiResponse([modelDraft(), modelDraft(120)]);
  });
});

test("duplicate options are not presented as distinct and valid options survive retry failure", async () => {
  await withGeminiMock(async () => {
    const result = await generatePlan(input);
    assert.equal(result.options.length, 1);
    assert.ok(result.meta.warnings.some((warning) => warning.includes("Only one")));
  }, (call) => call === 1 ? geminiResponse([modelDraft(), modelDraft()]) : new Response("Provider failed", { status: 503 }));
});

test("provider failures are surfaced instead of silently fabricating demo recipes", async () => {
  await withGeminiMock(async () => {
    await assert.rejects(generatePlan(input), /could not return valid plans/);
  }, () => new Response("Provider failed", { status: 503 }));
});
