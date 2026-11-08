# C: meal planning handoff

## Baseline and contracts

This feature merges current `main`, including PR #2's shared contract.
`src/types.ts` is kept exactly as it exists on main; new planning code imports
from `@/types`. Shared-contract changes belong in separate PRs. A's existing
profile scaffold is adapted at the browser boundary by `adapter.ts`.

Authentication is Auth0 only. Tiger Data integration will use A's server-only
shared pool in `src/lib/db.ts`; until it exists, C uses mock JSON and localStorage.
No image storage is added. Recipe generation and new UI text are English.

## Local flow

`/onboarding` → `/cook` (confirm kitchen) → `/cook/plan` → `/cook/options`
→ `/cook/shopping` → `/cook/cooking` (D).

`/cook/ready` is only a compatibility redirect to `/cook/cooking`. No cooking
steps appear during shopping. The cooking page remains owned by D and must be
included from D's branch during integration; C does not copy or implement it.

The selected `MealPlan` is stored directly under `mealdeal.currentPlan`, without
a wrapper. The existing options-cache key is unchanged.
`@/lib/meal-plan-store` exposes `getSelected()` and `setSelected()` for D, including
`chosen.recipes`, `status`, `progress` and item-level `bought` state. Completion is
blocked until every item is bought. Reloading restores progress. Empty lists are
immediately complete. `Start cooking` appears after all items are checked and
saves `status: "cooking"` before navigation. This is demo persistence only; cloud persistence and
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

C imports `listProducts` and `listKnownStores` from `@/features/catalog`, B's
public feature boundary. `listProducts()` is called with its default filtering;
it includes confirmed price-tag reports and excludes expired products. C does
not pass `includeExpired: true` or read product/store JSON with fs.

The `feature/catalog` branch is integrated, including B's 40 flyer products and
real UBC-area stores. The three B-owned seed/metadata files match that branch.
B owns persistence: its current in-memory confirmed reports are lost on server
restart, and its later Tiger Data implementation can replace the accessor
bodies without changing C's caller.

`mock/foods.json` and `mock/catalog-meta.json` use static JSON imports so Next.js
bundles them for Vercel. Catalog loading never depends on process.cwd() or
deployment filesystem paths. `foods.json` remains empty until database-backed
nutrition data is supplied; no nutrient values are invented.

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
The planning tests cover costs, package rounding, pantry limits, meal coverage,
batch scaling, missing nutrition, dates, distance, restrictions, ID validation,
Gemini structured-output requests, corrective retries and provider failures.
No Gemini call or paid service is required by tests.
Planning service tests use a fixed catalog snapshot, so changing weekly flyer
offers does not invalidate arithmetic/model-validation tests. Integration tests
confirm reports through B's product route, check that C sees new/revised prices,
and load the catalog from a different working directory. The test runner resolves
Next.js's @/* alias and rewrites B's relative .ts imports when compiling tests.
The planning test loader uses Node 22.15 or later, matching the CI Node 22 setup.
`npm run test:catalog` runs B's price-normalization checks unchanged.

## P1 deal integration

Use the exact `DealCheck` from `@/types` and B's
`GET /api/products/:id/deal`. Shopping items show verdict labels and explicitly
mark `hasSampleData` history. Invalid payloads, mismatched product/store IDs,
unavailable endpoints and timeouts produce no invented labels.
Candidate selection preserves current filtering and cost rules, then stably
prefers products with `verdict: "real_deal"`. Server lookups use trusted
`APP_BASE_URL`; without it, generation keeps the existing price order. This
integration becomes live when B publishes the endpoint after 20:00.

## Shared-file integration notes

C's PR changes `src/components/preflight.tsx` to connect A's confirmation screen
to `/cook/plan`, and adds scoped planning styles in `src/app/globals.css`.
A should build on both files during integration. C's catalog adapter now calls
B's public accessors and preserves their v2 data shape and store IDs. The adapter
still validates results but owns no separate product/store persistence. Store IDs
such as `save-on-foods@wesbrook-village` are accepted unchanged.
