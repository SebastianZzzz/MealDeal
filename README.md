# MealDeal

Mobile-first budget-to-meal planning for UBC students.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The default environment enables demo mode, so onboarding works with browser storage before any cloud account is configured.

## Connect Auth0 and Supabase

1. Create a Regular Web Application in Auth0. Set callback URL to `http://localhost:3000/auth/callback` and logout URL to `http://localhost:3000`.
2. Fill the Auth0 variables in `.env.local`.
3. Create a Supabase project and run the files in `supabase/migrations` in filename order.
4. Add `SUPABASE_URL` and the server-only service role key to `.env.local`.
5. Set `NEXT_PUBLIC_DEMO_MODE=0` before production deployment.

Auth0 owns identity. Next.js validates the encrypted Auth0 session and performs profile writes server-side. The Supabase service role key is never sent to the browser.

## Shared contracts

Shared contracts live in `src/contracts`. Other feature branches should import these rather than defining duplicates. See `docs/ARCHITECTURE.md` and `CONTRIBUTING.md` before starting a feature branch.

## Local planning feature (C)

See [C planning handoff](docs/PLANNING.md) for the v2 contract, local flow, Gemini setup, demo data and integration boundaries.
