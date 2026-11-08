import assert from "node:assert/strict";
import test from "node:test";
import { createSession, formatTime, remainingMs, restoreSession, timerKey, updateSession } from "./session.ts";

function fixture() {
  return {
    id: "plan-a", userId: "user-a", status: "cooking", progress: {},
    chosen: { id: "option-a", recipes: [
      { id: "main", steps: [{ index: 1, timerSec: 60 }, { index: 2 }] },
      { id: "side", steps: [{ index: 1, timerSec: 90 }] },
    ] },
  };
}

test("steps advance once, cannot be skipped, and each recipe finishes independently", () => {
  const plan = fixture();
  let session = createSession(plan);
  assert.equal(updateSession(plan, session, { type: "complete", recipeId: "main", index: 2 }), session);
  session = updateSession(plan, session, { type: "complete", recipeId: "main", index: 1 });
  assert.deepEqual(session.progress, { main: 2, side: 1 });
  assert.equal(updateSession(plan, session, { type: "complete", recipeId: "main", index: 1 }), session);
  session = updateSession(plan, session, { type: "complete", recipeId: "main", index: 2 });
  assert.deepEqual(session.progress, { main: 3, side: 1 });
  assert.equal(updateSession(plan, session, { type: "complete", recipeId: "main", index: 3 }), session);
});

test("timers use deadlines, survive reload, and expire after time in the background", () => {
  const plan = fixture();
  const initial = createSession(plan);
  assert.deepEqual(initial.timers, {});
  const started = updateSession(plan, initial, { type: "start", recipeId: "main", index: 1, now: 1000 });
  const restored = restoreSession(plan, JSON.stringify(started));
  const timer = restored.timers[timerKey("main", 1)];
  assert.equal(remainingMs(timer, 21000), 40000);
  assert.equal(remainingMs(timer, 90000), 0);
  assert.equal(restored.progress.main, 1, "expiry must not auto-complete the cooking step");
  assert.equal(updateSession(plan, started, { type: "start", recipeId: "main", index: 1, now: 5000 }), started, "double-start must not extend the deadline");
});

test("pausing and resuming preserves the remaining duration across reload", () => {
  const plan = fixture();
  let session = updateSession(plan, createSession(plan), { type: "start", recipeId: "main", index: 1, now: 1000 });
  session = updateSession(plan, session, { type: "pause", recipeId: "main", index: 1, now: 21000 });
  session = restoreSession(plan, JSON.stringify(session));
  assert.equal(remainingMs(session.timers[timerKey("main", 1)], 99000), 40000);
  session = updateSession(plan, session, { type: "start", recipeId: "main", index: 1, now: 100000 });
  assert.equal(session.timers[timerKey("main", 1)].endsAt, 140000);
});

test("completing or restarting one recipe clears only its own timers", () => {
  const plan = fixture();
  let session = createSession(plan);
  for (const recipeId of ["main", "side"]) session = updateSession(plan, session, { type: "start", recipeId, index: 1, now: 1000 });
  session = updateSession(plan, session, { type: "complete", recipeId: "main", index: 1 });
  assert.equal(session.timers[timerKey("main", 1)], undefined);
  assert.ok(session.timers[timerKey("side", 1)]);
  session = updateSession(plan, session, { type: "restart", recipeId: "side" });
  assert.deepEqual(session.progress, { main: 2, side: 1 });
  assert.deepEqual(session.timers, {});
});

test("resetting an expired timer allows another manual start", () => {
  const plan = fixture();
  let session = updateSession(plan, createSession(plan), { type: "start", recipeId: "main", index: 1, now: 1000 });
  session = updateSession(plan, session, { type: "resetTimer", recipeId: "main", index: 1, now: 90000 });
  session = updateSession(plan, session, { type: "start", recipeId: "main", index: 1, now: 100000 });
  assert.equal(session.timers[timerKey("main", 1)].endsAt, 160000);
});

test("invalid storage and changed recipes cannot restore stale progress", () => {
  const plan = fixture();
  const fresh = createSession(plan);
  for (const raw of ["not json", "null", "{}", JSON.stringify({ ...fresh, progress: { main: -1, side: 1 } })]) {
    assert.deepEqual(restoreSession(plan, raw), fresh);
  }
  const stale = updateSession(plan, fresh, { type: "complete", recipeId: "main", index: 1 });
  const revised = fixture();
  revised.chosen.recipes[0].steps[0].timerSec = 120;
  assert.deepEqual(restoreSession(revised, JSON.stringify(stale)), createSession(revised));
  const corruptTimer = { ...fresh, timers: { [timerKey("main", 1)]: { remainingMs: -1, endsAt: "bad" } } };
  assert.deepEqual(restoreSession(plan, JSON.stringify(corruptTimer)).timers, {});
});

test("server progress and completed plan state initialize correctly", () => {
  const plan = fixture();
  plan.progress = { main: 2, side: 1 };
  assert.deepEqual(createSession(plan).progress, plan.progress);
  plan.status = "done";
  assert.deepEqual(createSession(plan).progress, { main: 3, side: 2 });
});

test("clock rounds up a partial second and never displays negative values", () => {
  assert.equal(formatTime(59999), "01:00");
  assert.equal(formatTime(1), "00:01");
  assert.equal(formatTime(-1000), "00:00");
});
