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
