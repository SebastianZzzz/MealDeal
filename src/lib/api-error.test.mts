import { test } from "node:test";
import assert from "node:assert/strict";
import { apiError, fieldErrors, readApiError, validationError } from "./api-error.ts";

test("apiError sets status, code and no-store", async () => {
  const res = apiError("UNAUTHORIZED", "Please log in to save your profile.");
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { error: "Please log in to save your profile.", code: "UNAUTHORIZED" });
});

test("fieldErrors keeps the first message per dotted path", () => {
  const fields = fieldErrors({ issues: [
    { path: ["units", "weight"], message: "Invalid option" },
    { path: ["units", "weight"], message: "second" },
    { path: ["defaultServings"], message: "Too small" },
  ] });
  assert.deepEqual(fields, { "units.weight": "Invalid option", defaultServings: "Too small" });
});

test("validationError is a 400 with fields", async () => {
  const res = validationError({ issues: [{ path: ["name"], message: "Required" }] });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Some fields need fixing.", code: "VALIDATION_FAILED", fields: { name: "Required" } });
});

test("readApiError understands the shared shape", async () => {
  const err = await readApiError(apiError("UNPROCESSABLE", "Could not read the price.", { priceText: "Try $3.99" }));
  assert.deepEqual(err, { error: "Could not read the price.", code: "UNPROCESSABLE", fields: { priceText: "Try $3.99" } });
});

test("readApiError falls back for old-style or empty bodies", async () => {
  const oldStyle = await readApiError(Response.json({ error: { fieldErrors: {} } }, { status: 400 }));
  assert.deepEqual(oldStyle, { error: "Some fields need fixing.", code: "VALIDATION_FAILED" });
  const empty = await readApiError(new Response("", { status: 503 }));
  assert.equal(empty.code, "SERVICE_UNAVAILABLE");
  assert.equal(empty.error, "This is unavailable right now. Try again later.");
});
