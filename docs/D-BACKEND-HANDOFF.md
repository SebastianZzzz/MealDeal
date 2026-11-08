# D backend handoff

## Implemented routes

| Route | Behavior |
| --- | --- |
| `GET /api/resources?q=&type=` | Curated resources, official sources, verification dates and travel notice. Available now without a database or sign-in. |
| `GET /api/surplus` | Shared database listings through A's pool. Returns 503 if configuration/storage is unavailable. |
| `POST /api/surplus` | Auth0 sign-in, input validation and a server-generated UUID. All posts remain sample data; no merchant ownership column is required. |
| `POST /api/surplus/[id]/reserve` | Auth0 sign-in and one conditional SQL decrement; 409 for sold-out/expired/missing rows. |
| `GET /api/cooking/[id]` | Read the authenticated owner's saved plan. |
| `PATCH /api/cooking/[id]` | Accept only `{ "progress": { "recipe-id": 2 } }`; derive completion server-side and preserve shopping data. |

No new identity provider, image storage, payment system, merchant accounts,
reservation roster, or shared-contract changes are introduced.

## One connection point for A

`src/features/community/database.ts` defines D's small query interface:

```ts
interface Database {
  query(sql: string, parameters: unknown[]): Promise<{
    rows: Record<string, unknown>[];
  }>;
}
```

`getDDatabase()` reuses A's exported `db` pool from `src/lib/db.ts` and checks
`DATABASE_URL` before loading it. It creates no separate pool. Missing
configuration returns null; connection/query failures become sanitized 503
responses. Secrets remain in the server environment. Signed-out writes return
401, and shared writes never silently fall back to browser storage.
The local browser demos continue independently.

## Schema and ownership

The canonical schema is A's `db/migrations/20261107201500_shared_app.sql`.
`sql/d-surplus.sql` is a matching reference, not an additional migration.
It must not recreate the former text-ID/posted_by schema. Reservations
use one `UPDATE ... SET qty_left = qty_left - 1 WHERE id = $1 AND qty_left > 0
AND pickup_end > clock_timestamp() RETURNING *`. Zero returned rows means no
reservation was made. The database clock checks pickup expiry. The stock check
and decrement occur in the same database statement.

A/C own inserting `meal_plans`. Both its `id` and `user_id` are UUIDs;
`user_id` references `users.id`, while `users.auth0_id` holds the Auth0 sub.
Every D plan query joins `users` and scopes access by the server session's
Auth0 sub. Returned `MealPlan.userId` remains the database UUID, matching A's
profile ID and C's current browser format. A client-supplied owner is never
trusted. Progress updates preserve chosen/shopping data, validate indexes,
require completed shopping, derive `done`, and update `updated_at`.
The previous chosen/progress/status are concurrency conditions; conflicts are
409. A missing or unowned plan is 404. Invalid/local-only IDs return 400 before
reaching UUID columns.

The surplus table has no `posted_by` column. Authentication still guards
posting/reservation, but D stores no merchant account or reservation roster.
The insert explicitly sets `is_sample = true`, regardless of the table default.

## UI connections

- `/support` remains usable with bundled curated resources; its API uses the
  same resource collection.
- `/eat-out` and `/eat-out/post` remain local sample flows.
- `/eat-out/shared` and `/eat-out/shared/post` use the shared HTTP endpoints.
  They show service errors rather than switching silently to local inventory.
- The real cooking page has explicit save/restore account actions. Local progress
  is automatic and remains available if account sync fails. A restored account
  plan must match the current user/recipes and clears old local timer deadlines.
- C still writes a plain `MealPlan` to `mealdeal.currentPlan` and navigates to
  `/cook/cooking`. D does not insert or regenerate C's plans.

## Remaining C/database prerequisite

C currently creates browser-only plans whose IDs are option IDs, not database
UUIDs. C/A must persist the selected plan and completed shopping list to
`meal_plans` under the current `users.id`, then put the returned UUID-backed
`MealPlan` into `mealdeal.currentPlan`. Do not insert an entire client plan from
D's progress-only PATCH. Local cooking works before this handoff is added;
account actions explicitly reject local IDs. A UUID with no stored owned row
returns 404. A configured adapter alone does not create saved plans or sample
merchants. Shared inventory is available at `/eat-out/shared`; `/eat-out` remains
the labeled local demo. Food Support remains bundled curated data.

## Verification limits

API tests inject repositories and identities. Query-repository tests exercise
ownership parameters, row mapping, completion and conflict behavior; they do not
execute against PostgreSQL. The earlier browser-local concurrency test is not a
database concurrency test. After A connects Tiger Data, run the two-client final
portion test in `D-ACCEPTANCE.md` before claiming live shared inventory works.

An isolated PGlite check executed A's table definitions and D's SQL for UUID
ownership, progress conflicts, sample insertion, stock and expiry. This was not
a live Tiger Data or multi-connection concurrency test, and it used no shared
credentials/data. This follow-up syncs main and A's completed database foundation;
D does not change the shared types or take over C's plan persistence.
