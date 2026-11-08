import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { calculateOption } from "../src/features/planning/calculate";
import { filterProducts, blockedByProfile } from "../src/features/planning/filter";
import { adaptPantry, adaptProfile } from "../src/features/planning/adapter";
import { draftOptionSchema, planRequestSchema } from "../src/features/planning/schema";
import { getMealSlots } from "../src/features/planning/slots";
import { generatePlan } from "../src/features/planning/service";
import type { PlanningInput } from "../src/features/planning/schema";
import { defaultProfile } from "../src/contracts/profile";
import type { DraftOption } from "../src/features/planning/schema";
import type { ApiError, ApiErrorCode, DealCheck, Food, PantryItem, PlanRequest, Product, Store } from "../src/types";
import { parseProductDeal, preferRealDeals, dealLabel } from "../src/features/planning/deals";
import { loadProductDeals } from "../src/features/planning/deal-client";
import { loadCatalog, type Catalog } from "../src/features/planning/catalog";
import { POST as confirmProductReport } from "../src/app/api/products/route";
import { isExpired } from "../src/features/catalog/index";
import { tmpdir } from "node:os";
import { generateWithGemini, planningModels, PlanningModelError } from "../src/features/planning/gemini";
import { comparePlanOptions, storeCount } from "../src/features/planning/rank-options";
import { POST as postPlan } from "../src/app/api/plan/route";
import * as session from "../src/lib/session";
import * as planningService from "../src/features/planning/service";
import { readApiError } from "../src/lib/api-error";

const request: PlanRequest = { budget: 10, servings: 2, duration: "one_meal", batchCook: false, cuisines: [], meatVeg: "balanced" };
const product: Product = { id: "rice", storeId: "near", name: "Rice", packageSizeG: 500, packagePrice: 2.5, packageUnit: "g", pricePer100: 999, isSale: true, source: "flyer", confidence: 1, reportedAt: "2026-11-07" };
const store: Store = { id: "near", name: "Near", chain: "Test", address: "Test", lat: 49.26, lng: -123.25 };
const food: Food = { id: "food-rice", name: "Rice (test fixture)", kcal: 100, proteinG: 10, fatG: 2, carbG: 20 };
const fixtureCatalog: Catalog = {
  products: [{ ...product, id: "sample-rice", packageSizeG: 900, packagePrice: 2.49 }],
  stores: [store], foods: [], isSample: true,
};

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

test("single-dish options use the recipe title instead of an unrelated summary", () => {
  const plan = draft();
  plan.title = "Apple dinner";
  const option = calculateOption(plan, request, [product], [], [], "p").option;
  assert.equal(option.title, "Rice");
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

test("adapts non-positive onboarding quantities to unknown amounts and preserves finite stock", () => {
  const items = adaptPantry([
    { id: "rice", name: "Rice", qtyG: 0 },
    { id: "soy-sauce", name: "Soy sauce", qtyG: -1 },
    { id: "lentils", name: "Cooked lentils", qtyG: 150 },
  ], "student");
  assert.deepEqual(items.map((item) => item.qtyG), [undefined, undefined, 150]);
  assert.ok(items.every((item) => item.userId === "student"));
  assert.equal(JSON.stringify(items).includes('"qtyG":0'), false);
  const plan = draft(100);
  plan.recipes[0].ingredients = [{ productId: null, pantryItemId: "lentils", name: "Lentils", qtyG: 100 }];
  assert.throws(() => calculateOption(plan, request, [], items, [], "p"), /Not enough pantry/);
});

test("an explicit zero in the shared pantry contract still means no finite stock", () => {
  const pantry: PantryItem = { id: "empty", userId: "student", name: "Rice", qtyG: 0, updatedAt: "2026-11-07" };
  const plan = draft(1);
  plan.recipes[0].ingredients = [{ productId: null, pantryItemId: pantry.id, name: "Rice", qtyG: 1 }];
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

async function withGeminiMock(run: () => Promise<void>, respond: (call: number, init?: RequestInit, url?: string) => Response) {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousDemo = process.env.NEXT_PUBLIC_DEMO_MODE;
  const previousOrigin = process.env.APP_BASE_URL;
  const previousModels = process.env.GEMINI_PLAN_MODELS;
  delete process.env.APP_BASE_URL;
  delete process.env.GEMINI_PLAN_MODELS;
  process.env.GEMINI_API_KEY = "test-placeholder-never-sent";
  process.env.NEXT_PUBLIC_DEMO_MODE = "1";
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    return respond(calls, init, String(url));
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
    if (previousOrigin === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = previousOrigin;
    }
    if (previousModels === undefined) {
      delete process.env.GEMINI_PLAN_MODELS;
    } else {
      process.env.GEMINI_PLAN_MODELS = previousModels;
    }
  }
}

function geminiResponse(options: DraftOption[]): Response {
  return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ options }) }] } }] });
}

const input: PlanningInput = { request, profile: adaptProfile(defaultProfile), pantry: [] };

async function withPlanRoute(
  run: () => Promise<void>,
  generate: typeof planningService.generatePlan = async () => { throw new Error("Unexpected plan generation."); },
  identity: typeof session.getIdentity = async () => ({ sub: "planning-test", name: "Test", email: "test@example.com" }),
) {
  const identityMock = mock.method(session, "getIdentity", identity);
  const planMock = mock.method(planningService, "generatePlan", generate);
  try {
    await run();
  } finally {
    planMock.mock.restore();
    identityMock.mock.restore();
  }
}

function planHttpRequest(value: unknown = input): Request {
  return new Request("http://localhost/api/plan", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value),
  });
}

async function assertPlanApiError(response: Response, status: number, code: ApiErrorCode): Promise<ApiError> {
  const displayed = await readApiError(response.clone());
  const body = await response.json() as ApiError;
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.code, code);
  assert.equal(typeof body.error, "string");
  assert.ok(body.error.length > 0);
  assert.deepEqual(displayed, body);
  assert.ok(Object.keys(body).every((key) => ["error", "code", "fields"].includes(key)));
  return body;
}

test("onboarding rice with qtyG zero reaches Gemini as available pantry and costs $0 without buying rice", async () => {
  const pantryInput: PlanningInput = {
    ...input,
    request: { ...request, budget: 0 },
    pantry: adaptPantry([
      { id: "owned-rice", name: "Rice", qtyG: 0 },
      { id: "owned-soy", name: "Soy sauce", qtyG: 0 },
    ], input.profile.id),
  };
  const realGeneratePlan = planningService.generatePlan;
  await withGeminiMock(async () => {
    await withPlanRoute(async () => {
      const response = await postPlan(planHttpRequest(pantryInput));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const result = await response.json();
      assert.equal(result.options.length, 2);
      for (const option of result.options) {
        assert.equal(option.shoppingCost, 0);
        assert.equal(option.recipeCost, 0);
        assert.equal(option.costPerServing, 0);
        assert.equal(option.withinBudget, true);
        assert.deepEqual(option.shoppingList, []);
        assert.equal(option.recipes[0].ingredients[0].pantryItemId, "owned-rice");
        assert.equal(option.recipes[0].ingredients[0].productId, undefined);
      }
    }, (data) => realGeneratePlan(data, fixtureCatalog));
  }, (_call, init) => {
    const prompt: string = JSON.parse(String(init?.body)).contents[0].parts[0].text;
    const data = JSON.parse(prompt.split("\n").find((line) => line.startsWith('{"request":'))!);
    assert.deepEqual(data.pantry.map((item: PantryItem) => item.id), ["owned-rice", "owned-soy"]);
    assert.ok(data.pantry.every((item: PantryItem) => !("qtyG" in item)));
    assert.match(prompt, /without qtyG are available in normal household amounts/);
    assert.match(prompt, /Prefer pantry items over buying a product for the same ingredient/);
    assert.match(prompt, /Finite pantry quantities are limits for the ENTIRE scaled plan/);
    const options = [100, 120].map((grams) => {
      const option = modelDraft(grams);
      option.recipes[0].ingredients = [
        { productId: null, pantryItemId: "owned-rice", name: "Rice", qtyG: grams },
        { productId: null, pantryItemId: "owned-soy", name: "Soy sauce", qtyG: 5 },
      ];
      return option;
    });
    return geminiResponse(options);
  });
});

test("plan route returns a shared unauthorized error before parsing or generating", async () => {
  await withPlanRoute(async () => {
    await assertPlanApiError(await postPlan(planHttpRequest(null)), 401, "UNAUTHORIZED");
  }, undefined, async () => null);
});

test("plan route uses a shared service error if identity lookup is unavailable", async () => {
  await withPlanRoute(async () => {
    const body = await assertPlanApiError(await postPlan(planHttpRequest()), 503, "SERVICE_UNAVAILABLE");
    assert.doesNotMatch(body.error, /private identity diagnostic/);
  }, undefined, async () => { throw new Error("private identity diagnostic"); });
});

test("plan route returns a shared validation error for malformed JSON", async () => {
  await withPlanRoute(async () => {
    const response = await postPlan(new Request("http://localhost/api/plan", { method: "POST", body: "{broken" }));
    await assertPlanApiError(response, 400, "VALIDATION_FAILED");
  });
});

test("plan route returns dotted field errors instead of a Zod flatten object", async () => {
  await withPlanRoute(async () => {
    const response = await postPlan(planHttpRequest({ ...input, request: { ...request, servings: 0 } }));
    const body = await assertPlanApiError(response, 400, "VALIDATION_FAILED");
    assert.equal(typeof body.fields?.["request.servings"], "string");
  });
});

for (const [status, code, message] of [
  [422, "UNPROCESSABLE", "No complete plan fits these constraints."],
  [502, "UPSTREAM_FAILED", "The recipe service is unavailable right now."],
  [503, "SERVICE_UNAVAILABLE", "Configure GEMINI_API_KEY to generate meal plans."],
  [500, "INTERNAL", "Planning could not be completed."],
] as const) {
  test(`plan route maps planning status ${status} to ${code}`, async () => {
    await withPlanRoute(async () => {
      const body = await assertPlanApiError(await postPlan(planHttpRequest()), status, code);
      assert.equal(body.error, message);
    }, async () => { throw new planningService.PlanningError(message, status); });
  });
}

test("plan route returns a shared database error without leaking catalog diagnostics", async () => {
  const log = mock.method(console, "error", () => {});
  try {
    await withPlanRoute(async () => {
      const body = await assertPlanApiError(await postPlan(planHttpRequest()), 503, "DATABASE_UNAVAILABLE");
      assert.doesNotMatch(body.error, /private database diagnostic/);
      assert.deepEqual(log.mock.calls[0].arguments, ["Planning failed:", "Error"]);
    }, async () => { throw new Error("private database diagnostic"); });
  } finally {
    log.mock.restore();
  }
});

test("Gemini request uses structured JSON and code ignores invented prices", async () => {
  await withGeminiMock(async () => {
    const result = await generatePlan(input, fixtureCatalog);
    assert.equal(result.meta.mode, "gemini");
    assert.equal(result.options.length, 2);
    assert.equal(result.options[0].shoppingCost, 2.49);
    assert.equal(result.options[0].recipes[0].ingredients[0].qtyG, 200);
  }, (_call, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.ok(body.generationConfig.responseJsonSchema.properties.options);
    assert.doesNotMatch(JSON.stringify(body.generationConfig.responseJsonSchema), /"(?:minItems|maxItems|minLength|maxLength|minimum|maximum|exclusiveMinimum|exclusiveMaximum)"\s*:/);
    const cheap = { ...modelDraft(), shoppingCost: 0.01 };
    return geminiResponse([cheap, modelDraft(120)]);
  });
});

test("invalid model IDs trigger a corrective retry", async () => {
  let calls = 0;
  await withGeminiMock(async () => {
    const result = await generatePlan(input, fixtureCatalog);
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
    const result = await generatePlan(input, fixtureCatalog);
    assert.equal(result.options.length, 1);
    assert.ok(result.meta.warnings.some((warning) => warning.includes("Only one")));
  }, (call) => call === 1 ? geminiResponse([modelDraft(), modelDraft()]) : new Response("Provider failed", { status: 503 }));
});

test("balanced prompts prefer main proteins while retaining vegetarian dietary rules", async () => {
  await withGeminiMock(async () => {
    const planningInput = { ...input, profile: { ...input.profile, dietary: ["vegetarian"] } };
    await generatePlan(planningInput, fixtureCatalog);
  }, (_call, init) => {
    const prompt = JSON.parse(String(init?.body)).contents[0].parts[0].text;
    assert.match(prompt, /non-vegetarian balanced or mostly_meat requests, prefer eligible meat, fish, eggs, tofu or legumes/);
    assert.match(prompt, /Vegetarian status includes both profile.meatVeg and vegetarian\/vegan dietary restrictions/);
    assert.match(prompt, /dairy such as cheese or yogurt can supply the protein ingredient when permitted/);
    assert.match(prompt, /Vegan plans must exclude dairy and eggs/);
    assert.match(prompt, /"dietary":\["vegetarian"\]/);
    return geminiResponse([modelDraft(), modelDraft(120)]);
  });
});

test("a $15 mostly_meat request recovers two options after duplicate and over-budget proposals", async () => {
  const catalog: Catalog = {
    ...fixtureCatalog,
    products: [
      ...fixtureCatalog.products,
      { ...product, id: "chicken", name: "Chicken", packagePrice: 20 },
      { ...product, id: "tofu", name: "Firm tofu", packagePrice: 3 },
      { ...product, id: "broccoli", name: "Broccoli", packagePrice: 2 },
    ],
  };
  function proteinDraft(proteinId: string, withBroccoli = false): DraftOption {
    const plan = modelDraft();
    plan.recipes[0].ingredients.push({ productId: proteinId, pantryItemId: null, name: proteinId, qtyG: 100 });
    if (withBroccoli) {
      plan.recipes[0].ingredients.push({ productId: "broccoli", pantryItemId: null, name: "Broccoli", qtyG: 100 });
    }
    return plan;
  }
  let calls = 0;
  await withGeminiMock(async () => {
    const result = await generatePlan({ ...input, request: { ...request, budget: 15, meatVeg: "mostly_meat" } }, catalog);
    assert.equal(calls, 3);
    assert.equal(result.options.length, 2);
    assert.deepEqual(result.options.map((option) => option.shoppingCost), [5.49, 7.49]);
    assert.ok(result.options.every((option) => option.withinBudget));
    assert.ok(result.options.every((option) => option.shoppingList.some((item) => item.productId === "tofu")));
    assert.ok(result.options.every((option) => !option.shoppingList.some((item) => item.productId === "chicken")));
  }, (call, init) => {
    calls = call;
    const prompt: string = JSON.parse(String(init?.body)).contents[0].parts[0].text;
    assert.match(prompt, /"budget":15/);
    assert.match(prompt, /"meatVeg":"mostly_meat"/);
    if (call > 1) {
      assert.match(prompt, /We have retained 1 valid options/);
      assert.match(prompt, /relax cuisine specificity and the one-store preference/);
      assert.match(prompt, /reduce the meat proportion or use eligible eggs, tofu or legumes/);
      assert.match(prompt, /Never relax the total budget, allergies, dietary restrictions/);
      assert.match(prompt, /"retainedOptions":\[\{"shoppingCost":5.49/);
    }
    if (call === 3) {
      return geminiResponse([proteinDraft("tofu", true)]);
    }
    return geminiResponse([proteinDraft("tofu"), proteinDraft("chicken")]);
  });
});

test("stops after bounded retries without claiming that a second option cannot exist", async () => {
  let calls = 0;
  await withGeminiMock(async () => {
    const result = await generatePlan(input, fixtureCatalog);
    assert.equal(calls, 3);
    assert.equal(result.options.length, 1);
    assert.ok(result.meta.warnings.some((warning) => /Only one complete option was found/.test(warning)));
  }, (call) => {
    calls = call;
    return geminiResponse([modelDraft(), modelDraft()]);
  });
});

test("corrective retries never raise the budget to satisfy the option count", async () => {
  let calls = 0;
  await withGeminiMock(async () => {
    await assert.rejects(generatePlan({ ...input, request: { ...request, budget: 1 } }, fixtureCatalog), /No complete plan/);
    assert.equal(calls, 3);
  }, (call) => {
    calls = call;
    return geminiResponse([modelDraft(), modelDraft(120)]);
  });
});

test("retry proposals still enforce filtered allergies, finite pantry and complete meals", async () => {
  let calls = 0;
  const planningInput: PlanningInput = {
    ...input,
    profile: { ...input.profile, allergies: ["Soy"] },
    pantry: [{ id: "owned", userId: "test", name: "Rice", qtyG: 1, updatedAt: "2026-11-07" }],
  };
  const catalog: Catalog = {
    ...fixtureCatalog,
    products: [...fixtureCatalog.products, { ...product, id: "tofu", name: "Firm tofu" }],
  };
  await withGeminiMock(async () => {
    const result = await generatePlan(planningInput, catalog);
    assert.equal(calls, 3);
    assert.equal(result.options.length, 1);
    assert.equal(result.options[0].recipes[0].ingredients[0].productId, "sample-rice");
  }, (call) => {
    calls = call;
    const invalid = modelDraft(120);
    if (call === 1) {
      invalid.recipes[0].ingredients[0].productId = "tofu";
    } else if (call === 2) {
      invalid.recipes[0].ingredients[0].productId = null;
      invalid.recipes[0].ingredients[0].pantryItemId = "owned";
    } else {
      invalid.recipes[0].mealSlots = ["day2-dinner"];
    }
    return geminiResponse([modelDraft(), invalid]);
  });
});

test("does not make a third corrective call after the shared deadline", async () => {
  const originalNow = Date.now;
  let calls = 0;
  try {
    await withGeminiMock(async () => {
      const result = await generatePlan(input, fixtureCatalog);
      assert.equal(calls, 2);
      assert.equal(result.options.length, 1);
    }, (call) => {
      calls = call;
      if (call === 2) {
        const afterDeadline = originalNow() + 60000;
        Date.now = () => afterDeadline;
      }
      return geminiResponse([modelDraft(), modelDraft()]);
    });
  } finally {
    Date.now = originalNow;
  }
});

test("uses the final corrective attempt for malformed JSON without switching to Flash", async () => {
  let calls = 0;
  await withGeminiMock(async () => {
    const result = await generatePlan(input, fixtureCatalog);
    assert.equal(calls, 3);
    assert.equal(result.options.length, 2);
  }, (call, _init, url) => {
    calls = call;
    assert.match(url!, /gemini-3.5-flash-lite:generateContent$/);
    if (call < 3) {
      return Response.json({ candidates: [{ content: { parts: [{ text: "invalid JSON" }] } }] });
    }
    return geminiResponse([modelDraft(), modelDraft(120)]);
  });
});

test("provider failures are surfaced instead of silently fabricating demo recipes", async () => {
  await withGeminiMock(async () => {
    await assert.rejects(generatePlan(input, fixtureCatalog), /unavailable right now/);
  }, () => new Response("Provider failed", { status: 503 }));
});

test("planning defaults to Lite models and supports a deduplicated explicit list", async () => {
  await withGeminiMock(async () => {
    assert.deepEqual(planningModels(), ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"]);
    process.env.GEMINI_PLAN_MODELS = "gemini-3.1-flash-lite, gemini-3.1-flash-lite, gemini-3.5-flash";
    assert.deepEqual(planningModels(), ["gemini-3.1-flash-lite", "gemini-3.5-flash"]);
    process.env.GEMINI_PLAN_MODELS = "invalid/model";
    assert.throws(planningModels, PlanningModelError);
  }, () => { throw new Error("No provider call expected."); });
});

for (const status of [404, 429, 500, 503]) {
  test(`moves to the second Lite model on HTTP ${status}`, async () => {
    const models: string[] = [];
    await withGeminiMock(async () => {
      const result = await generatePlan(input, fixtureCatalog);
      assert.equal(result.options.length, 2);
      assert.deepEqual(models, ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]);
    }, (call, _init, url) => {
      models.push(new URL(url!).pathname.split("/").pop()!.replace(":generateContent", ""));
      return call === 1 ? new Response("Unavailable", { status }) : geminiResponse([modelDraft(), modelDraft(120)]);
    });
  });
}

test("uses Flash only after both Lite models fail", async () => {
  const models: string[] = [];
  await withGeminiMock(async () => {
    const result = await generatePlan(input, fixtureCatalog);
    assert.equal(result.options.length, 2);
    assert.deepEqual(models, ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"]);
  }, (call, _init, url) => {
    models.push(new URL(url!).pathname.split("/").pop()!.replace(":generateContent", ""));
    return call < 3 ? new Response("Unavailable", { status: 429 }) : geminiResponse([modelDraft(), modelDraft(120)]);
  });
});

test("moves to the next Lite model after a transport failure", async () => {
  let calls = 0;
  await withGeminiMock(async () => {
    const result = await generatePlan(input, fixtureCatalog);
    assert.equal(result.options.length, 2);
    assert.equal(calls, 2);
  }, (call) => {
    calls = call;
    if (call === 1) {
      throw new TypeError("Network unavailable");
    }
    return geminiResponse([modelDraft(), modelDraft(120)]);
  });
});

for (const status of [400, 401, 403]) {
  test(`does not spend another model request on HTTP ${status}`, async () => {
    let calls = 0;
    await withGeminiMock(async () => {
      await assert.rejects(generatePlan(input, fixtureCatalog), /unavailable right now/);
      assert.equal(calls, 1);
    }, (call) => {
      calls = call;
      return new Response("Rejected", { status });
    });
  });
}

test("does not restart an exhausted fallback chain", async () => {
  let calls = 0;
  await withGeminiMock(async () => {
    await assert.rejects(generatePlan(input, fixtureCatalog), /unavailable right now/);
    assert.equal(calls, 3);
  }, (call) => {
    calls = call;
    return new Response("Quota exceeded", { status: 429 });
  });
});

test("corrective retry skips models already known to be unavailable", async () => {
  const models: string[] = [];
  await withGeminiMock(async () => {
    const result = await generatePlan(input, fixtureCatalog);
    assert.equal(result.options.length, 2);
    assert.deepEqual(models, ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.1-flash-lite"]);
  }, (call, _init, url) => {
    models.push(new URL(url!).pathname.split("/").pop()!.replace(":generateContent", ""));
    if (call === 1) {
      return new Response("Quota exceeded", { status: 429 });
    }
    if (call === 2) {
      const invalid = modelDraft();
      invalid.recipes[0].ingredients[0].productId = "unknown";
      return geminiResponse([invalid]);
    }
    return geminiResponse([modelDraft(), modelDraft(120)]);
  });
});

test("stops before requesting a model when the shared deadline has passed", async () => {
  let calls = 0;
  await withGeminiMock(async () => {
    await assert.rejects(generateWithGemini(input.request, input.profile, [], fixtureCatalog.products, undefined,
      { deadline: 0, unavailableModels: new Set() }), PlanningModelError);
    assert.equal(calls, 0);
  }, () => {
    calls++;
    return geminiResponse([modelDraft(), modelDraft(120)]);
  });
});

test("prefers fewer store stops while retaining budget and price ordering", () => {
  const base = calculateOption(draft(), request, [product], [], [], "one-store").option;
  const sameStore = { ...base, shoppingCost: 8, shoppingList: [...base.shoppingList, { ...base.shoppingList[0], productId: "second" }] };
  const twoStores = { ...base, id: "two-store", shoppingCost: 5, shoppingList: [...base.shoppingList, { ...base.shoppingList[0], productId: "second", storeId: "other" }] };
  const cheaperOneStore = { ...base, id: "cheap-one-store", shoppingCost: 6 };
  assert.equal(storeCount(sameStore), 1);
  assert.deepEqual([twoStores, sameStore, cheaperOneStore].sort(comparePlanOptions).map((option) => option.id), ["cheap-one-store", "one-store", "two-store"]);
  assert.ok(comparePlanOptions(twoStores, { ...sameStore, shoppingCost: 20, withinBudget: false }) < 0);
});

test("matches the rice, chicken and broccoli acceptance example", () => {
  const products: Product[] = [
    { ...product, id: "rice", packageSizeG: 2000, packagePrice: 4.99 },
    { ...product, id: "chicken", name: "Chicken", packageSizeG: 1000, packagePrice: 8.8 },
    { ...product, id: "broccoli", name: "Broccoli", packageSizeG: 500, packagePrice: 1.99 },
  ];
  const plan = draft();
  plan.recipes[0].baseServings = 2;
  plan.recipes[0].ingredients = [
    { productId: "rice", pantryItemId: null, name: "Rice", qtyG: 300 },
    { productId: "chicken", pantryItemId: null, name: "Chicken", qtyG: 400 },
    { productId: "broccoli", pantryItemId: null, name: "Broccoli", qtyG: 300 },
  ];
  const result = calculateOption(plan, request, products, [], [], "acceptance").option;
  assert.equal(result.recipeCost, 5.46);
  assert.equal(result.shoppingCost, 15.78);
  assert.equal(result.costPerServing, 2.73);
  assert.equal(result.withinBudget, false);
  assert.deepEqual(result.leftovers.map((item) => item.qtyG), [1700, 600, 200]);
});

test("lean Gemini decoding leaves local recipe bounds enforced", () => {
  assert.equal(draftOptionSchema.safeParse(draft(0)).success, false);
  assert.equal(draftOptionSchema.safeParse(draft(100001)).success, false);
  const plan = draft();
  plan.recipes[0].title = "x".repeat(161);
  assert.equal(draftOptionSchema.safeParse(plan).success, false);
});

const deal: DealCheck = {
  productId: product.id, storeId: product.storeId, currentPer100: 0.5,
  medianPer100: 0.6, diffPct: -16.67, observations: 4,
  hasSampleData: true, verdict: "real_deal",
};

test("validates shared DealCheck identities and marks sample history", () => {
  assert.deepEqual(parseProductDeal(deal, product), deal);
  assert.equal(parseProductDeal({ ...deal, productId: "different" }, product), null);
  assert.equal(parseProductDeal({ ...deal, storeId: "different" }, product), null);
  assert.equal(parseProductDeal({ ...deal, verdict: "unknown-verdict" }, product), null);
  assert.equal(parseProductDeal(null, product), null);
  assert.equal(dealLabel(deal), "Real deal · sample price history");
  assert.equal(dealLabel({ ...deal, verdict: "not_enough_data", hasSampleData: false }), "Not enough price history");
});

test("prefers real deals while preserving the remaining candidate order", () => {
  const products = [product, { ...product, id: "better-deal" }, { ...product, id: "third" }];
  const ranked = preferRealDeals(products, { "better-deal": { ...deal, productId: "better-deal" } });
  assert.deepEqual(ranked.map((item) => item.id), ["better-deal", "rice", "third"]);
  assert.equal(products[0].id, "rice");
});

test("deal endpoint failures preserve planning without fabricated verdicts", async () => {
  const previousFetch = globalThis.fetch;
  const previousOrigin = process.env.APP_BASE_URL;
  process.env.APP_BASE_URL = "https://mealdeal.example";
  try {
    globalThis.fetch = async (url) => {
      assert.equal(String(url), "https://mealdeal.example/api/products/rice/deal");
      return Response.json(deal);
    };
    assert.deepEqual(await loadProductDeals([product]), { rice: deal });
    globalThis.fetch = async () => new Response("Not found", { status: 404 });
    assert.deepEqual(await loadProductDeals([product]), {});
    globalThis.fetch = async () => { throw new Error("Offline"); };
    assert.deepEqual(await loadProductDeals([product]), {});
  } finally {
    globalThis.fetch = previousFetch;
    if (previousOrigin === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = previousOrigin;
    }
  }
});

test("catalog includes newly confirmed reports and updated prices", async () => {
  const reportStore: Store = {
    id: "planning-test@report-store", name: "Planning test store", chain: "Test",
    address: "Test address", lat: 49.26, lng: -123.25,
  };
  const report = {
    storeId: reportStore.id, store: reportStore, name: "Planning integration rice",
    sizeText: "900 g", priceText: "$2.49", isSale: false, category: "grain",
  };
  async function submit(priceText: string) {
    return confirmProductReport(new Request("http://localhost/api/products", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...report, priceText }),
    }));
  }
  const first = await submit(report.priceText);
  assert.equal(first.status, 201);
  const { product: confirmed } = await first.json() as { product: Product };
  const catalog = await loadCatalog();
  assert.equal(catalog.products.find((item) => item.id === confirmed.id)?.source, "report");
  assert.equal(catalog.products.find((item) => item.id === confirmed.id)?.packagePrice, 2.49);
  assert.equal(catalog.stores.find((item) => item.id === reportStore.id)?.name, reportStore.name);
  assert.ok(catalog.products.every((item) => !isExpired(item)));

  const updated = await submit("$1.99");
  assert.equal(updated.status, 201);
  const refreshed = await loadCatalog();
  assert.equal(refreshed.products.find((item) => item.id === confirmed.id)?.packagePrice, 1.99);
  assert.equal(refreshed.products.filter((item) => item.id === confirmed.id).length, 1);
});

test("catalog loading is independent of the process working directory", async () => {
  const previousDirectory = process.cwd();
  process.chdir(tmpdir());
  try {
    const catalog = await loadCatalog();
    assert.ok(catalog.stores.length > 0);
    assert.ok(catalog.products.some((item) => item.source === "report"));
    assert.equal(typeof catalog.isSample, "boolean");
  } finally {
    process.chdir(previousDirectory);
  }
});
