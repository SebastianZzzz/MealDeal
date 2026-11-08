import assert from "node:assert/strict";
import test from "node:test";
import { createSurplusHandlers } from "../src/features/community/http.ts";
import { createCookingHandlers } from "../src/features/cooking/http.ts";
import { createSurplusRepository } from "../src/features/surplus/repository.ts";
import { createCookingRepository } from "../src/features/cooking/repository.ts";
import { getDDatabase, UpdateConflict } from "../src/features/community/database.ts";
import { demoMealPlan } from "../src/features/cooking/mock-plan.ts";
import { GET as resources } from "../src/app/api/resources/route.ts";
import { verifiedIdentity } from "../src/features/community/server-runtime.ts";
import { ApiRequestError, requireOk } from "../src/features/community/api-client.ts";
import { syncCookingPlan } from "../src/features/cooking/cloud-client.ts";

const planId = "10000000-0000-4000-8000-000000000001";
const listingId = "20000000-0000-4000-8000-000000000001";
const userId = "30000000-0000-4000-8000-000000000001";

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
  assert.equal((await api.reserve(listingId)).status, 401);
  assert.equal(called, false);
});

test("missing shared storage returns 503 rather than a false successful write", async () => {
  const api = surplus();
  assert.equal((await api.list()).status, 503);
  assert.equal((await api.post(request(draft))).status, 503);
  assert.equal((await api.reserve(listingId)).status, 503);
});

test("posting rejects malformed input and ignores client ownership/verification claims", async () => {
  let received;
  const api = surplus({ surplus: async () => ({ post: async (...args) => { received = args; return { ...args[0], id: args[1], isSample: true }; } }) });
  assert.equal((await api.post(request({ ...draft, price: 11 }))).status, 400);
  assert.equal((await api.post(new Request("http://localhost/api/surplus", { method: "POST", body: "bad-json" }))).status, 400);
  const response = await api.post(request({ ...draft, id: "forged", userId: "someone-else", isSample: false, postedBy: "forged" }));
  assert.equal(response.status, 201);
  assert.equal(received[1], "server-id");
  assert.equal(received.length, 3);
  assert.equal(received[2], "auth0|owner");
  assert.equal(received[0].userId, undefined);
  assert.equal(received[0].isSample, undefined);
  assert.equal((await response.json()).listing.isSample, true);
});

test("reservation reports a conditional-update miss as conflict and never retries a write", async () => {
  let calls = 0;
  const repository = createSurplusRepository({ query: async (sql, params) => {
    calls++; assert.deepEqual(params, [listingId]); assert.match(sql, /qty_left > 0/); assert.match(sql, /pickup_end > clock_timestamp/); return { rows: [] };
  } });
  const api = surplus({ surplus: async () => repository });
  const response = await api.reserve(listingId);
  assert.equal(response.status, 409);
  assert.equal(calls, 1);
});

test("database exceptions are logged without leaking SQL or credentials to callers", async (context) => {
  const logged = context.mock.method(console, "error", () => {});
  const api = surplus({ surplus: async () => ({ list: async () => { throw Object.assign(new Error("postgres://secret@example/private"), { code: "ECONNREFUSED" }); } }) });
  const response = await api.list();
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, "DATABASE_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(body), /secret|postgres/);
  assert.equal(logged.mock.callCount(), 1);
});

async function apiFailure(response, status, code) {
  assert.equal(response.status, status);
  const body = await response.json();
  assert.equal(body.code, code);
  assert.equal(typeof body.error, "string");
  assert.ok(body.error.length > 0);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return body;
}

test("D endpoints return shared codes for validation, auth, missing plans, conflicts and storage", async () => {
  const signedOut = surplus({ identity: async () => null });
  await apiFailure(await signedOut.post(request(draft)), 401, "UNAUTHORIZED");
  await apiFailure(await signedOut.reserve(listingId), 401, "UNAUTHORIZED");
  const noCookingAuth = createCookingHandlers({ identity: async () => null, repository: async () => null });
  await apiFailure(await noCookingAuth.get(planId), 401, "UNAUTHORIZED");
  await apiFailure(await noCookingAuth.patch(request({ progress: { recipe: 1 } }), planId), 401, "UNAUTHORIZED");
  for (const response of [await surplus().list(), await surplus().post(request(draft)), await surplus().reserve(listingId)]) {
    await apiFailure(response, 503, "DATABASE_UNAVAILABLE");
  }
  const noCookingDb = createCookingHandlers({ identity: async () => ({ sub: "owner" }), repository: async () => null });
  await apiFailure(await noCookingDb.get(planId), 503, "DATABASE_UNAVAILABLE");
  await apiFailure(await noCookingDb.patch(request({ progress: { recipe: 1 } }), planId), 503, "DATABASE_UNAVAILABLE");
  const missingPlan = createCookingHandlers({ identity: async () => ({ sub: "owner" }), repository: async () => ({ get: async () => null, save: async () => null }) });
  await apiFailure(await missingPlan.get(planId), 404, "NOT_FOUND");
  await apiFailure(await missingPlan.patch(request({ progress: { recipe: 1 } }), planId), 404, "NOT_FOUND");
  const conflict = surplus({ surplus: async () => ({ reserve: async () => null }) });
  await apiFailure(await conflict.reserve(listingId), 409, "CONFLICT");
  const stalePlan = createCookingHandlers({ identity: async () => ({ sub: "owner" }), repository: async () => ({ save: async () => { throw new UpdateConflict("Reload before saving."); } }) });
  const stale = await apiFailure(await stalePlan.patch(request({ progress: { recipe: 1 } }), planId), 409, "CONFLICT");
  assert.equal(stale.error, "Reload before saving.");
});

test("validation errors identify listing, progress, ID and resource fields", async () => {
  const listing = await apiFailure(await surplus().post(request({ ...draft, price: 11, qtyLeft: 0, lat: 100, pickupEnd: new Date(now - 1).toISOString() })), 400, "VALIDATION_FAILED");
  for (const field of ["price", "qtyLeft", "lat", "pickupEnd"]) assert.ok(listing.fields[field]);
  await apiFailure(await surplus().post(new Request("http://localhost/api/surplus", { method: "POST", body: "bad-json" })), 400, "VALIDATION_FAILED");
  const invalidId = await apiFailure(await surplus().reserve(""), 400, "VALIDATION_FAILED");
  assert.ok(invalidId.fields.id);
  const cooking = createCookingHandlers({ identity: async () => ({ sub: "owner" }), repository: async () => null });
  const progress = await apiFailure(await cooking.patch(request({ progress: { recipe: -1 } }), planId), 400, "VALIDATION_FAILED");
  assert.ok(progress.fields.progress);
  const json = new Request("http://localhost/api/cooking/plan", { method: "PATCH", body: "not-json" });
  await apiFailure(await cooking.patch(json, planId), 400, "VALIDATION_FAILED");
  const local = await apiFailure(await cooking.get("local-only-plan"), 400, "VALIDATION_FAILED");
  assert.ok(local.fields.id);
  const filters = await apiFailure(await resources(new Request(`http://localhost/api/resources?type=invalid&q=${"x".repeat(201)}`)), 400, "VALIDATION_FAILED");
  assert.ok(filters.fields.type);
  assert.ok(filters.fields.q);
});

test("oversized listing and progress bodies use the shared 413 error", async () => {
  await apiFailure(await surplus().post(request({ description: "x".repeat(33000) })), 413, "PAYLOAD_TOO_LARGE");
  const cooking = createCookingHandlers({ identity: async () => ({ sub: "owner" }), repository: async () => null });
  await apiFailure(await cooking.patch(request({ progress: { ["x".repeat(33000)]: 1 } }), planId), 413, "PAYLOAD_TOO_LARGE");
});

test("database constraints and unexpected bugs are not mislabeled as unavailable storage", async (context) => {
  context.mock.method(console, "error", () => {});
  for (const [code, status, expected] of [["23505", 409, "CONFLICT"], ["23514", 400, "VALIDATION_FAILED"], ["22P02", 400, "VALIDATION_FAILED"], ["57P01", 503, "DATABASE_UNAVAILABLE"], ["42P01", 500, "INTERNAL"]]) {
    const api = surplus({ surplus: async () => ({ list: async () => { throw Object.assign(new Error("SQL details must stay in logs"), { code }); } }) });
    const body = await apiFailure(await api.list(), status, expected);
    assert.doesNotMatch(body.error, /SQL details/);
  }
});

test("browser error helper preserves server messages and field hints, including conflicts", async () => {
  for (const [status, code] of [[400, "VALIDATION_FAILED"], [401, "UNAUTHORIZED"], [409, "CONFLICT"], [503, "DATABASE_UNAVAILABLE"]]) {
    await assert.rejects(requireOk(Response.json({ error: "The server's specific explanation.", code, fields: { price: "Check the price." } }, { status })), error => {
      assert.ok(error instanceof ApiRequestError);
      assert.equal(error.message, "The server's specific explanation.");
      assert.equal(error.code, code);
      assert.equal(error.fields.price, "Check the price.");
      return true;
    });
  }
  await assert.rejects(requireOk(new Response("<html>Unavailable</html>", { status: 503 })), error => error instanceof ApiRequestError && error.code === "SERVICE_UNAVAILABLE" && !error.message.includes("html"));
  await requireOk(Response.json({ listing: {} }));
});

test("cooking client keeps account errors and successful plan responses intact", async (context) => {
  const fetch = context.mock.method(globalThis, "fetch", async () => Response.json({ error: "Please sign in to restore this plan.", code: "UNAUTHORIZED" }, { status: 401 }));
  await assert.rejects(syncCookingPlan(planId), error => error instanceof ApiRequestError && error.message === "Please sign in to restore this plan." && error.code === "UNAUTHORIZED");
  fetch.mock.mockImplementation(async () => Response.json({ plan: { ...demoMealPlan, id: planId } }));
  assert.equal((await syncCookingPlan(planId, { "tomato-eggs": 2 })).id, planId);
});

test("unconfigured storage does not import or create a second database pool", async () => {
  const original = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    assert.equal(await getDDatabase(), null);
  } finally {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  }
});

test("cooking rejects local/malformed UUIDs and surplus rejects empty/overlong IDs", async () => {
  const fail = async () => { throw new Error("Database should not be accessed"); };
  const stock = surplus({ surplus: fail });
  const cooking = createCookingHandlers({ identity: async () => ({ sub: "auth0|owner" }), repository: fail });
  for (const id of ["local-demo", "listing' OR 1=1 --", "", "00000000-0000-0000-0000-00000000000z"]) {
    assert.equal((await cooking.get(id)).status, 400);
    assert.equal((await cooking.patch(request({ progress: { recipe: 1 } }), id)).status, 400);
  }
  for (const id of ["", "  ", "a".repeat(201)]) assert.equal((await stock.reserve(id)).status, 400);
});

test("posting matches A's surplus schema and preserves numeric/date values", async () => {
  const created = new Date("2026-11-07T23:00:00.123Z");
  const repository = createSurplusRepository({ query: async (sql, params) => {
    assert.match(sql, /posted_by/);
    assert.equal(params.length, 14);
    assert.equal(params[13], "auth0|owner");
    return { rows: [{ id: listingId, merchant_name: draft.merchantName, address: draft.address,
      title: draft.title, lat: draft.lat, lng: draft.lng, orig_price: "10.00", price: "3.00",
      qty_left: 2, pickup_start: new Date(draft.pickupStart), pickup_end: new Date(draft.pickupEnd),
      allergens: draft.allergens, is_sample: true, created_at: created }] };
  } });
  const saved = await repository.post(draft, listingId, "auth0|owner");
  assert.equal(saved.id, listingId);
  assert.equal(saved.price, 3);
  assert.equal(saved.createdAt, created.toISOString());
  assert.equal(saved.isSample, true);
});

test("text surplus IDs remain usable and SQL never requires the removed updated_at column", async () => {
  const id = "sample:bread-bag' OR 1=1 --";
  let writes = 0;
  const repository = createSurplusRepository({ query: async (sql, params) => {
    assert.deepEqual(params, [id]);
    assert.doesNotMatch(sql, /updated_at/);
    writes++;
    return { rows: [] };
  } });
  const response = await surplus({ surplus: async () => repository }).reserve(id);
  assert.equal(response.status, 409);
  assert.equal(writes, 1);
});

test("D follows A's development demo identity but production requires Auth0", async () => {
  const keys = ["NODE_ENV", "NEXT_PUBLIC_DEMO_MODE", "AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET", "APP_BASE_URL"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_DEMO_MODE = "1";
    assert.deepEqual(await verifiedIdentity(), { sub: "demo|student" });
    process.env.NODE_ENV = "production";
    assert.equal(await verifiedIdentity(), null);
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_DEMO_MODE = "0";
    assert.equal(await verifiedIdentity(), null);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("an Auth0 user without an owned plan cannot write cooking progress", async () => {
  let reads = 0;
  const repository = createCookingRepository({ query: async (sql, params) => {
    assert.match(sql, /^SELECT/);
    assert.deepEqual(params, [planId, "auth0|other"]);
    reads++;
    return { rows: [] };
  } });
  assert.equal(await repository.save(planId, "auth0|other", { "tomato-eggs": 2 }), null);
  assert.equal(reads, 1);
});

test("cooking API scopes operations to Auth0 and accepts only progress", async () => {
  let received;
  const api = createCookingHandlers({ identity: async () => ({ sub: "auth0|owner" }), repository: async () => ({
    get: async () => null,
    save: async (...args) => { received = args; return demoMealPlan; },
  }) });
  assert.equal((await api.get(planId)).status, 404);
  assert.equal((await api.patch(request({ progress: { "tomato-eggs": 2 }, chosen: {} }), planId)).status, 400);
  const response = await api.patch(request({ progress: { "tomato-eggs": 2 } }), planId);
  assert.equal(response.status, 200);
  assert.deepEqual(received, [planId, "auth0|owner", { "tomato-eggs": 2 }]);
});

test("cooking API handles signed-out, disconnected and concurrent-update outcomes", async () => {
  const signedOut = createCookingHandlers({ identity: async () => null, repository: async () => null });
  assert.equal((await signedOut.get(planId)).status, 401);
  assert.equal((await signedOut.patch(request({ progress: { recipe: 1 } }), planId)).status, 401);
  const unavailable = createCookingHandlers({ identity: async () => ({ sub: "owner" }), repository: async () => null });
  assert.equal((await unavailable.get(planId)).status, 503);
  const conflict = createCookingHandlers({ identity: async () => ({ sub: "owner" }), repository: async () => ({ save: async () => { throw new UpdateConflict("Reload this plan."); } }) });
  assert.equal((await conflict.patch(request({ progress: { recipe: 1 } }), planId)).status, 409);
});

test("cooking repository preserves C's chosen plan and derives completion on the server", async () => {
  const plan = { ...structuredClone(demoMealPlan), id: planId, userId };
  const row = { id: plan.id, user_id: userId, request: plan.request, chosen: plan.chosen, status: plan.status, progress: {}, created_at: plan.createdAt };
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
  assert.equal(saved.userId, userId);
  assert.match(queries[0].sql, /JOIN users u ON u.id = p.user_id/);
  assert.match(queries[0].sql, /u.auth0_id = \$2/);
  assert.match(queries[1].sql, /u.auth0_id = \$2/);
  assert.deepEqual(queries[1].params.slice(0, 2), [plan.id, "auth0|owner"]);
  assert.deepEqual(JSON.parse(queries[1].params[4]), plan.chosen);
  assert.doesNotMatch(queries[1].sql, /SET\s+chosen|SET\s+shopping/i);
});

test("cooking repository rejects unknown steps and a race without overwriting shopping", async () => {
  const plan = { ...structuredClone(demoMealPlan), id: planId, userId };
  const row = { id: plan.id, user_id: userId, request: plan.request, chosen: plan.chosen, status: plan.status, progress: {}, created_at: plan.createdAt };
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
