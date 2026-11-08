# MealDeal

Mobile-first budget-to-meal planning for UBC students.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Profile and pantry data remain in browser storage until the authenticated API
successfully persists them to the shared database.

## Cooking and community features (D)

- `/cook/cooking`: cook the selected plan; `/cook/demo`: independent sample plan.
- `/support`: curated food resources; `/api/resources`: resource query API.
- `/eat-out` and `/eat-out/post`: local sample listings and reservations.
- `/eat-out/shared` and `/eat-out/shared/post`: shared API preview, pending the database adapter.

Run D tests with Node.js 22.18 or newer:

```bash
node --experimental-strip-types --import ./tests/d-paths.mjs --test tests/d-api.test.mjs src/features/cooking/session.test.mjs src/features/cooking/plan-storage.test.mjs src/features/surplus/inventory.test.mjs
```

## Connect Auth0 and Tiger Data

1. Create a Regular Web Application in Auth0. Set callback URL to `http://localhost:3000/auth/callback` and logout URL to `http://localhost:3000`.
2. Fill the Auth0 variables in `.env.local`.
3. Add the pooled Tiger Data `DATABASE_URL` to `.env.local`.
4. Run `npm run db:migrate`.

Auth0 owns identity. Next.js validates the encrypted Auth0 session and performs
all PostgreSQL access server-side through the shared pool in `src/lib/db.ts`.
No database credentials or image storage are exposed to the browser.

## Shared contracts

The cross-team contract lives in `src/types.ts` and must only change through a
small dedicated PR to `main`. A-owned local profile and pantry shapes remain in
`src/contracts/profile.ts`; planning converts them through its adapter. See
`docs/ARCHITECTURE.md` and `CONTRIBUTING.md` before starting a feature branch.

## Local planning feature (C)

See [C planning handoff](docs/PLANNING.md) for the v2 contract, local flow, Gemini setup, demo data and integration boundaries.
