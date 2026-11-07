# MealDeal architecture

MealDeal is one Next.js App Router application deployed to Vercel. Auth0 owns
identity; authenticated server routes access Supabase. Gemini may interpret
images and compose recipes, but deterministic application code validates IDs and
calculates prices, quantities, and nutrition.

## Repository layout

```text
src/
  app/          pages and HTTP route handlers; keep these thin
  components/   reusable cross-feature visual components
  contracts/    stable types exchanged between feature owners
  features/     private feature UI and business logic
  lib/          infrastructure adapters (Auth0, Supabase, environment)
supabase/
  migrations/   immutable, ordered database changes
  seed/         demo data (to be added by the catalog owner)
docs/           architecture and team decisions
public/         static assets (add only optimized, licensed assets)
```

## Dependency direction

`app → features → contracts`, while `lib` contains external-service adapters.
Features must not reach into another feature's private files. When B and C agree
on a product shape, for example, it is added to `contracts` before either module
depends on it.

## API ownership

| Route area | Owner |
| --- | --- |
| `/api/me`, `/api/pantry`, `/api/units/suggest` | A |
| `/api/stores`, `/api/products`, `/api/extract/*` | B |
| `/api/plan`, `/api/plan/[id]` | C |
| `/api/resources`, `/api/surplus/*` | D |

All API inputs must be validated. Secrets stay server-only and must never use a
`NEXT_PUBLIC_` prefix.
