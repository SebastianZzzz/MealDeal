# C: meal planning handoff

## Baseline and contracts

This local feature is based on A's `feature/onboarding` at `772b979`.
`src/types.ts` is an unchanged copy of the supplied v2 shared types. New planning
code imports from `@/types`. A's existing `src/contracts` and authentication stay
intact. `src/features/planning/adapter.ts` translates the older profile fields
and equipment names at the browser boundary. Reconcile the two type entry points
with A before merging; do not make B or D depend on the older planning types.

The v2 requirement uses Supabase Auth, while A's baseline still uses Auth0.
Changing identity providers is A's integration work. Planning uses the current
`getIdentity()` boundary and works with A's default local demo mode.

## Local flow

`/onboarding` → `/cook` (confirm kitchen) → `/cook/plan` → `/cook/options`
→ `/cook/shopping` → `/cook/ready`.

`/cook/ready` is a shopping-completion handoff screen, not D's interactive cooking
mode. No cooking steps appear during shopping. D can replace that screen or
change the navigation target in `ShoppingView.finish()`.

The selected `MealPlan` is stored on this browser under `mealdeal.plan.v2`.
`@/lib/meal-plan-store` exposes `getSelected()` and `setSelected()` for D, including
`chosen.recipes`, `status`, `progress` and item-level `bought` state. Completion is
blocked until every item is bought. Reloading restores progress. Empty lists are
immediately complete. This is demo persistence only; Supabase persistence and
`PATCH /api/plan/:id` are deferred to integration with A's meal_plans table and
user identity. There is no process-global pretend database.

## Planning API

`POST /api/plan` accepts:

```ts
{ request: PlanRequest; profile: UserProfile; pantry: PantryItem[] }
```

All three shapes use v2 types. The browser provides demo profile/pantry context;
cloud integration should load trusted current profile and pantry server-side.
Returns the unmodified `PlanResponse` shape plus additive `meta` (defined in
`src/contracts/planning-api.ts`) with generation
mode, sample-data label, stores, products, warnings and missing-nutrition names
indexed by option ID. Invalid JSON/fields return 400; unavailable catalog or
configuration 503; provider failure 502; no feasible complete plan 422.

Set server-only `GEMINI_API_KEY` to enable structured Gemini generation.
`GEMINI_MODEL` defaults to `gemini-2.5-flash` and can be changed without code edits.
Reference: https://ai.google.dev/api/generate-content and
https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html
Provider failures do not silently switch to demo recipes. With no key and demo
mode enabled, three explicitly marked English vegetarian templates provide a
local smoke-test path; they do not personalize cuisine or notes. With demo mode
disabled and no key, the endpoint returns 503. The demo templates require a pot
and stove; other equipment combinations require Gemini.

## B's catalog handoff

Replace `mock/products.json`, `mock/stores.json` and `mock/foods.json` with arrays
of v2 `Product`, `Store` and `Food`. IDs must be unique and store references must
exist. `mock/catalog-meta.json` contains `{ "isSample": true }`; set it to false
only when the replacement data is actually verified. Current stores and prices
are deliberately fictional samples (10 products), not B's 30–50 item deliverable.
`foods.json` is deliberately empty; no invented or model-estimated nutrients.
B owns nutrition matching and can supply database-derived `Food` entries.

Only gram-based products are accepted for recipes: the current contract supplies
gram quantities and has no piece-weight or density mapping. ml/piece products are
excluded with a warning rather than silently treated as grams. Agree on an
explicit mass mapping with B before enabling those products.

Name-based allergy/diet filters are conservative heuristics, not certified
allergen checks. Unknown dietary text also reaches Gemini. Halal/kosher profiles
exclude meat and fish without certification metadata. The UI asks users to check
labels/certification; richer product metadata is a later catalog improvement.

## Deterministic rules

- Filter expired prices (date-only validity ends on the Vancouver calendar day),
  stores outside a saved home radius, restricted names and unsupported units.
  Without a saved home, explicitly disclose the demo-area fallback.
- Model quantities are base recipe portions. Code scales grams by
  `people × covered meal slots / baseServings`. No double scaling is required in D.
- Timed steps and total minutes use an estimated sublinear batch multiplier,
  capped at 2. Ingredient quantities stay in the ingredient list; step text must
  not embed unscaled quantities. D should display supplied scaled values.
- Every requested slot must be covered. Additional slots and duplicate slots
  within a recipe are rejected. Multiple dishes can share a slot.
- Validate source IDs, finite positive quantities and total pantry availability.
  A's legacy unknown quantity of zero stays unavailable until corrected; do not
  assume unlimited rice. Optional quantities in v2 can represent owned staples.
- Recipe cost uses package price / package grams, ignoring stale extracted unit
  prices. Pantry costs zero. Sum gram requirements across dishes before rounding
  package counts up. Shopping totals are compared to the whole-plan budget.
- Cost per serving divides plan recipe cost by people × requested meal slots,
  including when multiple dishes share one slot. Leftovers use all bought packs.
- Sum only database-backed nutrition. Omit totals if nothing is matched; disclose
  missing foods for partial totals. Pantry foods can also contribute nutrients.
- Reject invalid/over-budget options, with one corrective Gemini retry. Return
  fewer than two only when explicitly warned; never fabricate duplicate options.

## Verification

Run `npm run test:planning`, `npm run lint` and `npm run build`.
The 16 planning tests cover costs, package rounding, pantry limits, meal coverage,
batch scaling, missing nutrition, dates, distance, restrictions, ID validation,
Gemini structured-output requests, corrective retries and provider failures.
No Gemini call or paid service is required by tests.
