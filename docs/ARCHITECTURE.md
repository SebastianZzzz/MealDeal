# MealDeal architecture

MealDeal is one Next.js App Router application deployed to Vercel. Auth0 owns
identity; authenticated server routes access Tiger Data through one PostgreSQL
pool. Gemini may interpret
images and compose recipes, but deterministic application code validates IDs and
calculates prices, quantities, and nutrition.

## Repository layout

```text
src/
  app/          pages and HTTP route handlers; keep these thin
  components/   reusable cross-feature visual components
  contracts/    A-owned local profile and pantry shapes
  features/     private feature UI and business logic
  lib/          server-only infrastructure adapters (Auth0 and PostgreSQL)
  types.ts      shared cross-team contract; changed only via a dedicated PR
db/
  migrations/   immutable, ordered database changes
docs/           architecture and team decisions
public/         static assets; user images are never stored
```

## Dependency direction

`app → features → types`, while `lib` contains external-service adapters.
Features must not reach into another feature's private files. When B and C agree
on a product shape, for example, it is added to `src/types.ts` in its own small
PR before either module depends on it. A's profile and pantry shapes are the
exception and remain private to `src/contracts/profile.ts`.

## API ownership

| Route area | Owner |
| --- | --- |
| `/api/me`, `/api/pantry`, `/api/units/suggest` | A |
| `/api/stores`, `/api/products`, `/api/extract/*` | B |
| `/api/plan`, `/api/plan/[id]` | C |
| `/api/resources`, `/api/surplus/*` | D |

All API inputs must be validated. Secrets stay server-only and must never use a
`NEXT_PUBLIC_` prefix.

## API errors

Every non-2xx JSON response has the shape `ApiError` from `src/types.ts`:

```json
{ "error": "Please log in to save your profile.", "code": "UNAUTHORIZED", "fields": { "defaultServings": "Must be at least 1" } }
```

- Build responses with `apiError(code, message, fields?)` or `validationError(zodError)` from `src/lib/api-error.ts`. The code decides the status (`VALIDATION_FAILED` 400, `UNAUTHORIZED` 401, `NOT_FOUND` 404, `CONFLICT` 409, `UNPROCESSABLE` 422, `INTERNAL` 500, `UPSTREAM_FAILED` 502, `SERVICE_UNAVAILABLE`/`DATABASE_UNAVAILABLE` 503).
- `error` is one sentence a user can act on. Never put SQL errors, provider bodies or stack traces in it; log those with `console.error` instead.
- Don't map every failure to one status: constraint violations are 400/409, bugs are 500, an unreachable DB is 503.
- In the browser, use `readApiError(response)` and show `error`, plus `fields` next to the matching inputs. Don't replace them with a generic message.
