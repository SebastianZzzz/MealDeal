# Cooking feature (D)

The standalone demo is at `/cook/demo`. It does not require onboarding or cloud
credentials. The home page links to it; A's existing `/cook` preflight is retained.

`CookingGuide` takes a final `MealPlan` from C using `@/contracts/types`, copied
unchanged from the team's supplied `types.ts`. A's older `contracts/profile.ts`
and `contracts/planning.ts` remain in place for A to migrate; do not interchange
their similarly named types with the new contract or export both via one barrel.

## Behavior

- Recipes start collapsed. Opening one shows its current step, initially step 1.
- Other steps can be previewed, but only the current step can be completed.
- Completion folds the current step, opens the next, and clears that step's timer.
- Timers start manually, support pause/resume/reset, and persist an absolute end
  time. Expiry reminds the user to check the food; it never completes the step.
- Each recipe's progress and timer are independent. Restart requires an inline
  confirmation and affects only that recipe.
- Browser storage uses a versioned key with user and plan IDs. Invalid or outdated
  saved data falls back to the supplied plan. Changed recipe content invalidates
  local progress. Storage failures are shown to the user.
- Final quantities and servings come from C and are never scaled again. Weight
  display uses the shared deterministic conversion table and defaults to the
  saved profile's weight unit. The local selector changes only the cooking view.

## Integration with C and A

Render `<CookingGuide key={plan.id} plan={plan} unitPrefs={profile.units} />` after
loading the selected plan and confirming its shopping stage is complete. Use
`isDemo` only for sample data. This demo has no live plan API or cloud writes.
The parent must remount when the selected plan changes; keep the plan prop stable
between progress updates.

`CookingSession.progress` mirrors `MealPlan.progress`: current step is **1-based**;
`recipe.steps.length + 1` means that recipe is complete. C should supply ordered,
contiguous step indexes starting at 1. This completion convention is a proposed
D integration contract and must be agreed with C before cloud integration.
All recipes complete means the plan can move to `done`.

Timers are separate local UI state, since the shared `MealPlan` has no timer
fields. A/C should agree how to persist them before adding cross-device recovery.
For `PATCH /api/plan/:id`, merge only the relevant progress/status fields, retain
the shopping list, and scope every update to the authenticated owner. Do not
submit this local demo to a real plan endpoint.

Ingredients currently carry `qtyG`, so this view treats their amounts as mass.
Do not label ml or pieces as grams. B/C need to supply explicit ingredient units
before the cooking UI can support those dimensions.

## Verify

```sh
node --experimental-strip-types --test src/features/cooking/session.test.mjs
npm run lint
npm run build
```

Use `npm run build -- --webpack` if the environment blocks Turbopack's internal
process/port setup. This was the successful production build used for local QA.

Manual checks at `/cook/demo`: open both recipes; preview a later step; complete
one step; start and pause a timer; refresh while it is running; return after its
deadline; change display units; finish both recipes; restart only one recipe.
Also check a narrow phone viewport and denied/corrupted browser storage. Timers
do not promise audio, background notifications, or an OS alarm.
