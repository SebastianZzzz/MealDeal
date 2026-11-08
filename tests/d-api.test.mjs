import assert from "node:assert/strict";
import test from "node:test";
import { createSurplusHandlers } from "../src/features/community/http.ts";
import { createCookingHandlers } from "../src/features/cooking/http.ts";
import { createSurplusRepository } from "../src/features/surplus/repository.ts";
import { createCookingRepository } from "../src/features/cooking/repository.ts";
import { UpdateConflict } from "../src/features/community/database.ts";
import { demoMealPlan } from "../src/features/cooking/mock-plan.ts";
import { GET as resources } from "../src/app/api/resources/route.ts";

const now = Date.parse("2026-11-07T23:00:00Z");
const draft = { merchantName: "Sample bakery", address: "Sample address", lat: 49.26, lng: -123.24, title: "Bread bag", origPrice: 10, price: 3, qtyLeft: 2, pickupStart: new Date(now).toISOString(), pickupEnd: new Date(now + 3600000).toISOString(), allergens: ["wheat"] };
const request = (body) => new Request("http://localhost/api/surplus", { method: "POST", body: JSON.stringify(body) });
function surplus(overrides = {}) {
  return createSurplusHandlers({ identity: async () => ({ sub: "auth0|owner" }), surplus: async () => null, id: () => "server-id", now: () => now, ...overrides });
}

test("resource API exposes sourced curated data and validates search filters", async () => {
  const response = await resources(new Request("http://localhost/api/resources?type=food_bank&q=AMS"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.mode, "curated");
  assert.equal(body.items.length, 1);
  assert.match(body.items[0].sourceUrl, /^https:\/\//);
  assert.match(body.items[0].verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(body.notice, /before you go/);
  assert.equal((await resources(new Request("http://localhost/api/resources?type=not-a-type"))).status, 400);
});

test("shared writes require authenticated identity before accessing a repository", async () => {
  let called = false;
  const api = surplus({ identity: async () => null, surplus: async () => { called = true; return {}; } });
  assert.equal((await api.post(request(draft))).status, 401);
  assert.equal((await api.reserve("listing")).status, 401);
  assert.equal(called, false);
});

test("missing shared storage returns 503 rather than a false successful write", async () => {
  const api = surplus();
  assert.equal((await api.list()).status, 503);
  assert.equal((await api.post(request(draft))).status, 503);
  assert.equal((await api.reserve("listing")).status, 503);
});

test("posting rejects malformed input and ignores client ownership/verification claims", async () => {
  let received;
  const api = surplus({ surplus: async () => ({ post: async (...args) => { received = args; return { ...args[0], id: args[1], isSample: true }; } }) });
  assert.equal((await api.post(request({ ...draft, price: 11 }))).status, 400);
  assert.equal((await api.post(new Request("http://localhost/api/surplus", { method: "POST", body: "bad-json" }))).status, 400);
  const response = await api.post(request({ ...draft, id: "forged", userId: "someone-else", isSample: false, postedBy: "forged" }));
  assert.equal(response.status, 201);
  assert.equal(received[1], "server-id");
  assert.equal(received[2], "auth0|owner");
  assert.equal(received[0].userId, undefined);
  assert.equal(received[0].isSample, undefined);
  assert.equal((await response.json()).listing.isSample, true);
});

test("reservation reports a conditional-update miss as conflict and never retries a write", async () => {
  let calls = 0;
  const repository = createSurplusRepository({ query: async (_sql, params) => {
    calls++; assert.deepEqual(params, ["listing' OR 1=1 --"]); return { rows: [] };
  } });
  const api = surplus({ surplus: async () => repository });
  const response = await api.reserve("listing' OR 1=1 --");
  assert.equal(response.status, 409);
  assert.equal(calls, 1);
});

test("database exceptions do not leak SQL or credentials to callers", async () => {
  const api = surplus({ surplus: async () => ({ list: async () => { throw new Error("postgres://secret@example/private"); } }) });
  const response = await api.list();
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /secret|postgres/);
});

test("cooking API scopes operations to Auth0 and accepts only progress", async () => {
  let received;
  const api = createCookingHandlers({ identity: async () => ({ sub: "auth0|owner" }), repository: async () => ({
    get: async () => null,
    save: async (...args) => { received = args; return demoMealPlan; },
  }) });
  assert.equal((await api.get("missing")).status, 404);
  assert.equal((await api.patch(request({ progress: { "tomato-eggs": 2 }, chosen: {} }), "plan")).status, 400);
  const response = await api.patch(request({ progress: { "tomato-eggs": 2 } }), "plan");
  assert.equal(response.status, 200);
  assert.deepEqual(received, ["plan", "auth0|owner", { "tomato-eggs": 2 }]);
});

test("cooking API handles signed-out, disconnected and concurrent-update outcomes", async () => {
  const signedOut = createCookingHandlers({ identity: async () => null, repository: async () => null });
  assert.equal((await signedOut.get("plan")).status, 401);
  assert.equal((await signedOut.patch(request({ progress: { recipe: 1 } }), "plan")).status, 401);
  const unavailable = createCookingHandlers({ identity: async () => ({ sub: "owner" }), repository: async () => null });
  assert.equal((await unavailable.get("plan")).status, 503);
  const conflict = createCookingHandlers({ identity: async () => ({ sub: "owner" }), repository: async () => ({ save: async () => { throw new UpdateConflict("Reload this plan."); } }) });
  assert.equal((await conflict.patch(request({ progress: { recipe: 1 } }), "plan")).status, 409);
});

test("cooking repository preserves C's chosen plan and derives completion on the server", async () => {
  const plan = structuredClone(demoMealPlan);
  const row = { id: plan.id, user_id: "auth0|owner", request: plan.request, chosen: plan.chosen, status: plan.status, progress: {}, created_at: plan.createdAt };
  const queries = [];
  const repository = createCookingRepository({ query: async (sql, params) => {
    queries.push({ sql, params });
    if (sql.startsWith("SELECT")) return { rows: [row] };
    return { rows: [{ ...row, progress: JSON.parse(params[2]), status: params[3] }] };
  } });
  const progress = Object.fromEntries(plan.chosen.recipes.map((recipe) => [recipe.id, recipe.steps.length + 1]));
  const saved = await repository.save(plan.id, "auth0|owner", progress);
  assert.equal(saved.status, "done");
  assert.deepEqual(saved.chosen, plan.chosen);
  assert.deepEqual(queries[1].params.slice(0, 2), [plan.id, "auth0|owner"]);
  assert.deepEqual(JSON.parse(queries[1].params[4]), plan.chosen);
  assert.doesNotMatch(queries[1].sql, /SET\s+chosen|SET\s+shopping/i);
});

test("cooking repository rejects unknown steps and a race without overwriting shopping", async () => {
  const plan = structuredClone(demoMealPlan);
  const row = { id: plan.id, user_id: "owner", request: plan.request, chosen: plan.chosen, status: plan.status, progress: {}, created_at: plan.createdAt };
  let writes = 0;
  const repository = createCookingRepository({ query: async (sql) => {
    if (sql.startsWith("SELECT")) return { rows: [row] };
    writes++; return { rows: [] };
  } });
  await assert.rejects(repository.save(plan.id, "owner", { "not-a-recipe": 2 }), UpdateConflict);
  assert.equal(writes, 0);
  await assert.rejects(repository.save(plan.id, "owner", { "tomato-eggs": 2 }), UpdateConflict);
  assert.equal(writes, 1);
});
