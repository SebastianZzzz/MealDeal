# MealDeal

Mobile-first budget-to-meal planning for UBC students.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The default environment enables demo mode, so onboarding works with browser storage before any cloud account is configured.

## Cooking and community features (D)

Open `/cook/cooking` for the selected plan saved by C at `mealdeal.currentPlan`.
The route validates the plan, requires completed shopping, and writes only
cooking progress/status back to the shared plan. Quantities and times are already
scaled by C; D only converts grams to the saved weight display unit.

`/cook/demo` remains an independent sample recipe demo with step progression,
timers, and local recovery after refresh. D's pages link to it. A owns the home
page and its entry points. Missing current plans link to planning and the demo.

`/support` contains four curated Vancouver/UBC resources with official source
links, verified dates, and a check-before-you-go notice. `/eat-out` and
`/eat-out/post` provide a browser-local sample surplus posting/reservation flow.
Web Locks serialize stock updates across cooperating tabs; shared database
inventory will be added by A. All local merchants and reservations are examples.

Run the timer/progress tests with Node.js 22.18 or newer:

```bash
node --experimental-strip-types --test src/features/cooking/session.test.mjs src/features/cooking/plan-storage.test.mjs src/features/surplus/inventory.test.mjs
```

If the local environment blocks Turbopack's internal port, build with
`npm run build -- --webpack`. See `src/features/cooking/README.md` for C/A
integration details and manual checks. Cloud progress saving is not yet connected.

## Authentication and later persistence

1. Create a Regular Web Application in Auth0. Set callback URL to `http://localhost:3000/auth/callback` and logout URL to `http://localhost:3000`.
2. Fill the Auth0 variables in `.env.local`.
3. Set `NEXT_PUBLIC_DEMO_MODE=0` when requiring real Auth0 sign-in.

Auth0 is the only identity provider. Use mock JSON and localStorage for the
current development milestone. A owns the later Tiger Data integration via
`src/lib/db.ts`; legacy database adapters in the initial scaffold are awaiting
that migration. D adds no database service, image storage, or cloud credentials.

## Shared contracts

The shared contract is `src/types.ts`, imported via `@/types`. Do not edit it on
feature branches. Older scaffold types in `src/contracts` are not the shared
contract. See `CONTRIBUTING.md` for the team workflow.
