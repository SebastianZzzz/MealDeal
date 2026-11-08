# C: meal planning handoff

## Baseline and contracts

This feature merges current `main`, including PR #2's shared contract.
`src/types.ts` is kept exactly as it exists on main; new planning code imports
from `@/types`. Shared-contract changes belong in separate PRs. A's existing
profile scaffold is adapted at the browser boundary by `adapter.ts`.

Authentication is Auth0 only. Account plans use A's server-only Tiger Data
pool in `src/lib/db.ts`; the browser copy remains usable when account sync fails.
No image storage is added. Recipe generation and new UI text are English.

## Local flow

`/onboarding` → `/cook` (confirm kitchen) → `/cook/plan` → `/cook/options`
→ `/cook/shopping` → `/cook/cooking` (D).

`/cook/ready` is only a compatibility redirect to `/cook/cooking`. No cooking
steps appear during shopping. The integrated cooking page remains owned by D.

The selected `MealPlan` is stored directly under `mealdeal.currentPlan`, without
a wrapper. The existing options-cache key is unchanged.
`@/lib/meal-plan-store` exposes `getSelected()` and `setSelected()` for D, including
`chosen.recipes`, `status`, `progress` and item-level `bought` state. Completion is
blocked until every item is bought. Reloading restores progress. Empty lists are
immediately complete. `Start cooking` appears after all items are checked and
saves `status: "cooking"` before navigation.

`POST /api/meal-plans` saves a selected option to the signed-in account.
`PATCH /api/meal-plans/:id` mirrors shopping changes. The client serializes
updates for each plan and captures each click's payload before waiting. Server
writes compare the chosen plan, progress and status with the read snapshot;
concurrent changes return `CONFLICT` rather than overwriting the winner or
moving a completed cooking session backwards. Sync failures are visible on
the shopping page, with retry and a link to review account plans. Offline
changes remain local until a later successful save.

`GET /api/meal-plans` returns up to 20 recently updated unfinished plans for
the authenticated owner, never cached. `/cook/resume` lists them without
requiring a local profile or plan. Opening one explicitly replaces the local
current plan, clears old option metadata, and goes to shopping or cooking
according to its saved status. Entry links appear in kitchen check and the
empty shopping/cooking states. Local-only plans cannot be recovered on another
device. No migration or new environment variable is required.

## Planning API

`POST /api/plan` accepts:

```ts
{ request: PlanRequest; profile: UserProfile; pantry: PantryItem[] }
```

All three shapes use v2 types. The browser provides demo profile/pantry context;
cloud integration should load trusted current profile and pantry server-side.
The planning-only profile schema adds optional `customEquipment` and
`customNutritionGoal` fields without changing shared `src/types.ts`.
Known nutrition goals map to high_protein, low_calorie or balanced. Custom
tools such as Blender and Tagine, and custom goals such as High fiber, survive
the adapter and reach Gemini as data. These extra fields pass the same
server-side choice checks as other custom choices, failing closed on invalid
or unavailable checks. Custom cookware is not silently mapped to an appliance
the user does not have.
Returns the unmodified `PlanResponse` shape plus additive `meta` (defined in
`src/contracts/planning-api.ts`) with generation
mode, sample-data label, stores, products, warnings and missing-nutrition names
indexed by option ID. All failures use the shared `ApiError` shape through
`apiError()` or `validationError()` from `src/lib/api-error.ts`. Invalid JSON
or fields return `VALIDATION_FAILED` (400), with dotted field messages for
schema errors. Missing sign-in returns `UNAUTHORIZED` (401); identity service
or missing Gemini configuration returns `SERVICE_UNAVAILABLE` (503); provider
failures return `UPSTREAM_FAILED` (502); no feasible complete plan returns
`UNPROCESSABLE` (422); catalog/database failures return `DATABASE_UNAVAILABLE`
(503). The form uses `readApiError()` and displays its `error`, including a
readable fallback if an intermediary returns an empty or non-JSON error body.

Set server-only `GEMINI_API_KEY` to enable structured Gemini generation.
`GEMINI_PLAN_MODELS` defaults to `gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.5-flash`.
The two Lite models are always tried before Flash unless an explicit ordered list
overrides the defaults. This replaces the former single-model `GEMINI_MODEL` setting.
Remove the old variable when updating local/Vercel configuration.
HTTP 404/429/500/503 and transport failures advance to the next model. Other HTTP
errors stop immediately. Corrective recipe retries skip models already known to
be unavailable and share a 50-second generation deadline, with at most 20 seconds
per model call. Exhausted chains are not repeated. Provider bodies are never returned.
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
  At the onboarding boundary, `adaptPantry()` converts non-positive legacy
  quantities to an omitted `qtyG`: these represent owned food with unknown
  amounts. Gemini is told that unknown amounts are available in normal
  household quantities and to prefer matching pantry ingredients over buying
  products. Positive quantities remain limits across the entire scaled plan.
  An explicit zero sent directly using the shared v2 contract remains zero;
  only the legacy onboarding boundary applies this normalization.
- Recipe cost uses package price / package grams, ignoring stale extracted unit
  prices. Pantry costs zero. Sum gram requirements across dishes before rounding
  package counts up. Shopping totals are compared to the whole-plan budget.
- Cost per serving divides plan recipe cost by people × requested meal slots,
  including when multiple dishes share one slot. Leftovers use all bought packs.
- Rank affordable options before over-budget ones, then by number of distinct
  shopping stores, then checkout cost. The prompt also asks for a complete
  one-store option when possible. Cards show store counts and label a recommended
  one-store plan accurately rather than claiming it has the lowest checkout cost.
- Sum only database-backed nutrition. Omit totals if nothing is matched; disclose
  missing foods for partial totals. Pantry foods can also contribute nutrients.
- Reject invalid/over-budget options. If fewer than two survive, make up to two
  corrective Gemini retries within the same 50-second deadline. Retain valid
  options and tell the model their ingredient combinations to avoid duplicates.
  Retries may relax cuisine specificity, the one-store preference and a
  mostly_meat ratio, using eligible eggs, tofu or legumes as alternatives.
  Budget, allergies, dietary restrictions, pantry stock, ingredient IDs,
  equipment, cooking time, servings and complete meal coverage remain unchanged.
  Return fewer than two only with a warning that generation found limited
  choices, not a claim that a second option cannot exist. Never fabricate
  duplicate options or silently switch to demo recipes to fill the count.

## Verification

Run `npm run test:planning`, `npm run lint` and `npm run build`.
CI also runs `test:api`, `test:catalog`, `test:planning` and `test:d` before the
production build. Account-route tests mock the shared pool; they perform no
live database writes. Added regressions cover malformed save bodies,
owner-scoped account discovery, serialized shopping updates, competing writes,
cooking completion conflicts, and preserving custom planning preferences.
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
The request form tells users planning usually takes about 15 seconds and may
take longer while the service is busy. Fallback tests verify all four specified
HTTP statuses, terminal errors, shared deadlines and avoiding repeated quota failures.

## Lite recipe quality check

Live `gemini-3.5-flash-lite` checks covered a two-person dinner, soy/peanut-free
vegetarian planning with pantry rice, and a three-day batch plan. All three
returned complete, cost-validated options. Final sampled requests took about
3–6 seconds, including corrective retries; the UI still allows about 15 seconds.

The first review found starch-only vegetarian dishes and quick-fried pork
shoulder. Prompt guidance now explicitly asks for a suitable protein ingredient,
allows dairy for vegetarian profiles, matches cuts to cooking time, and includes
Health Canada's meat-temperature guidance. The second review improved those
cases, but meal variety and dairy/ingredient-variant choices remain weak. Lite
is useful for basic demo recipes, not reliably validated balanced meal advice.
No protein or calorie adequacy is inferred without database-backed nutrition.

Following PR #3's review, prompts now distinguish non-vegetarian balanced and
mostly_meat requests: prefer eligible meat, fish, eggs, tofu or legumes as the
main protein, rather than defaulting to a rice, apples and yogurt meal when a
preferred protein fits. Dairy remains an allowed protein for vegetarian plans;
vegan and allergy restrictions always take precedence. This is qualitative
prompt guidance, not a nutrient guarantee. Automated regressions verify the
guidance and recover two affordable options from repeated or over-budget model
proposals, including a $15 mostly_meat request.

A fresh live review of these follow-ups returned two balanced dinner options,
three soy/peanut-free vegetarian options and three $15 mostly_meat options,
all passing ingredient, meal-coverage, pantry and cost checks. Each case used
two calls to gemini-3.5-flash-lite in about 4.3-6.2 seconds; no Flash call was
needed. Balanced options used pork tenderloin or tofu rather than dairy as
the main protein. The low-budget options cost $7.48, $8.97 and $12.48.
Quality remains imperfect: the model still used an ambiguous tofu-or-dessert
listing, sometimes substituted fruit for vegetables, and suggested quick
pan-cooking for pork picnic despite the cut-specific prompt. These observed
limitations remain open; the checks establish arithmetic and constraint
handling, not complete recipe quality or nutritional adequacy.

An unrelated plan summary was also observed; single-recipe option titles now
come from the actual recipe title. This deterministic fix has a regression test.
Remaining qualitative issues are disclosed rather than causing extra Flash calls;
Flash remains the last fallback only for unavailable Lite models.

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
