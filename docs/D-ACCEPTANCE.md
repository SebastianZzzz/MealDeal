# D acceptance and demo rehearsal

This is a manual acceptance script, not a claim that these checks have passed.
Use the integrated team build with A's database foundation and C's pages.

## Cooking: required demo path

1. Sign in with the real Auth0 flow and complete onboarding. Choose a weight
   unit other than grams, and record it.
2. In C's flow create a plan for two people. Choose an option and confirm the
   stored `mealdeal.currentPlan` is a plain `MealPlan`, not a wrapper.
3. Leave one shopping item unchecked. Starting cooking must remain blocked.
4. Buy/check the remaining items, then use C's Start cooking button. It must
   navigate to `/cook/cooking` and save `status: "cooking"` first.
5. Compare recipe IDs, portions and ingredient grams against C's selected option.
   D must preserve them exactly. Only displayed weights change with the unit.
6. Open a recipe. Only its current step should be expanded initially. Preview a
   later step: its Complete button must not appear.
7. Complete one step. Start the next timed step, pause/resume it, and refresh.
   Background the page, return, and confirm the remaining time reflects elapsed
   wall time. Expiry should not auto-complete the step.
8. Complete all recipes. Verify `mealdeal.currentPlan.status` is `done` and each
   progress index is `steps.length + 1`. The chosen shopping list must be intact.
9. Restart one recipe with confirmation. Other recipes retain their progress;
   the restarted recipe's timers clear and plan status becomes `cooking`.
10. Repeat with batch cooking across multiple meal slots. D must not rescale
    C's quantities, portions or durations.

## Recovery and phone layout

- Remove the selected plan: show planning and demo links, not a crash.
- Supply malformed/invalid local JSON: show recovery, not recipe steps.
- Deny browser storage: display the save failure and keep the session usable.
- Test 320 px and 390 px viewports, keyboard navigation, zoom, readable labels,
  expanded cards, timer controls and the last step button.
- Check that a previously completed shared plan cannot be reopened by stale
  browser progress. Account restore must clear old local timer deadlines.

## Food Support

- Open `/support` without signing in; search and category filters must work.
- Check all official links, visible verified dates, access requirements and the
  check-before-you-go notice. Confirm the AMS temporary closure is visible.
- Call `/api/resources?type=food_bank&q=AMS`; inspect the same curated record.

## API errors and form feedback

- Inspect D responses for invalid input, no session, a missing saved plan,
  a reservation/progress conflict, and unavailable storage. Each non-2xx body
  must contain the shared `error` and `code`; invalid known fields add `fields`.
- Submit a shared listing with its price above the original price. Show the
  server's sentence and a price-specific hint linked to the input. Keep entered
  values on failure. Correct and resubmit: old field hints must clear.
- Force a shared reservation conflict or account-sync failure. The page must
  retain the server's specific explanation, including expired/changed-plan cases.
- A non-JSON service failure must show the shared readable fallback, not a JSON
  parsing exception. SQL details and stack traces must not appear in the UI.

## Local surplus demo

- Post a fictional sample listing with one portion and a future pickup window.
- Open two tabs in the same browser and reserve simultaneously. Exactly one
  succeeds; neither tab shows negative stock. Refresh: stock remains zero.
- Try an expired pickup and invalid price/quantity. Reject both appropriately.
- Deny location: browsing by price remains available. Deny storage: do not report
  a successful reservation. Sample labels must remain visible.

## Shared database: requires configuration and C's persisted-plan handoff

1. A applies the canonical migrations and configures `DATABASE_URL`. D already
   reuses A's pool. A/C insert a UUID plan using `users.id` as `user_id` and
   persist the shopping-complete state. `users.auth0_id` holds the Auth0 sub.
   C saves that returned plan UUID and database user UUID in the browser plan.
2. In production, with no sign-in, posting, reserving and cooking sync must
   return 401. A's development-only demo identity must not work in production.
3. With a signed-in owner, save then restore progress in a separate browser.
   A different account must receive 404 for that plan, never its recipe data.
4. Insert a sample listing with exactly one portion. Use two independent browser
   profiles/HTTP clients to reserve at the same time. Exactly one 200 and one
   409 should result; read the database row and confirm `qty_left = 0`.
5. Verify expired offers cannot reserve, and a database failure cannot produce
   success. Refresh/list requests must reflect stock across devices.
6. Force another plan update between the progress read and write; the stale
   update must return 409 and preserve shopping data.
7. Attempt cooking account sync with an old option/local ID. Return 400 without
   a database query; local cooking must still work. Surplus IDs are text: check
   a valid existing non-UUID listing ID as well as empty/overlong invalid IDs.
8. Post through `/eat-out/shared/post`. Check that `posted_by` uses the server
   identity and `is_sample = true`. Cooking updates change `updated_at`; surplus
   reservations must work without that removed column. `/eat-out` remains the
   local demo.
9. On a test database with A's earlier UUID surplus schema, apply
   `20261107203800_align_surplus_with_d.sql`. Confirm old rows survive, text IDs
   can be inserted, and posting/reserving work with the upgraded schema.

## Backup demo

If cloud prerequisites are unavailable, use `/cook/demo`, `/support` and the local
surplus demo. State clearly which data and reservations are simulated. Use a
recorded verified integrated flow for the main planning story; do not present
the standalone D fixture as a live Gemini-generated plan.
