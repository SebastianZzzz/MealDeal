# D backend handoff

## Implemented routes

| Route | Behavior |
| --- | --- |
| `GET /api/resources?q=&type=` | Curated resources, official sources, verification dates and travel notice. Available now without a database or sign-in. |
| `GET /api/surplus` | Shared database listings. Returns 503 until the adapter is connected. |
| `POST /api/surplus` | Auth0 sign-in, input validation, server-generated ID and owner. All posts currently remain sample data. |
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

`getDDatabase()` currently returns `null`. This is intentional: A's
`src/lib/db.ts` and its exported pool/query function do not yet exist on main or
profile-followup. Once A provides the actual export, replace only this resolver
body with the shared pool adapter. Do not add another connection pool or copy
credentials into D files. Node-postgres-style query results map directly.

Until this is wired, shared reads return 503, signed-out writes return 401, and
authenticated writes return 503. No shared write is reported as successful.
The local browser demos continue to work independently.

## Schema and ownership

`sql/d-surplus.sql` is a proposed migration for A to review and apply through the
team's migration process. It has NOT been applied to any database. Reservations
use one `UPDATE ... SET qty_left = qty_left - 1 WHERE id = $1 AND qty_left > 0
AND pickup_end > clock_timestamp() RETURNING *`. Zero returned rows means no
reservation was made. The database clock checks pickup expiry. The stock check
and decrement occur in the same database statement.

A/C own inserting `meal_plans`. The cooking repository expects `id`, `user_id`
(Auth0 `sub`, text), `request` and `chosen` (jsonb), `status`, `progress` (jsonb),
and `created_at`. Confirm these names/types with A before enabling the resolver.
Every plan query includes the authenticated owner. The update changes only
progress/status, checks that shopping is complete, validates recipe indexes,
derives `done`, and uses the previously read chosen/progress JSON as an optimistic
concurrency condition. Conflicts return 409 rather than overwriting newer data.
Client-supplied user IDs, shopping lists, and completion status are not accepted.

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

## Verification limits

API tests inject repositories and identities. Query-repository tests exercise
ownership parameters, row mapping, completion and conflict behavior; they do not
execute against PostgreSQL. The earlier browser-local concurrency test is not a
database concurrency test. After A connects Tiger Data, run the two-client final
portion test in `D-ACCEPTANCE.md` before claiming shared inventory works.

Tests and docs are in English. A/C/B branches are not merged into this D change.
