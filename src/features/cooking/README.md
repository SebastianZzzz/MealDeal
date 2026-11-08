# Cooking feature (D)

## Routes and contracts

- `/cook/cooking` reads the selected `MealPlan` from `mealdeal.currentPlan`.
- Missing/invalid plans link to `/cook/plan` and `/cook/demo`.
- Unfinished shopping links back to `/cook/shopping` before exposing steps.
- `/cook/demo` remains an explicitly labeled, independent sample plan.
- `src/types.ts` is the untouched shared contract; imports use `@/types`.
  `session.ts` uses the relative type import `../../types` for Node tests.
- The home page is owned by A and has no D changes. D pages link to the demo.

## Persistence and units

The cooking route validates browser data at its boundary. Ingredients, portions,
and durations come from C already scaled; D applies no additional scaling.
Only `units` is read from `mealdeal.profile`. Grams are converted for display
using `GRAMS_PER`; changing the selector does not modify the profile.

Recipes start collapsed. Opening a recipe exposes its current step. Other steps
can be previewed, but only the current step can be completed. Recipe progress is
1-based; `steps.length + 1` means complete. Completing every recipe sets the
shared plan status to `done`; restarting one recipe sets it back to `cooking`.
D re-reads the current plan and updates only progress/status, preserving C's
shopping list, final quantities, request, and additive metadata. A changed plan
cannot be overwritten by a stale cooking tab. The sample route never writes the
selected plan.

Versioned per-user/per-plan cooking state also stores timer deadlines in
localStorage. Timers start manually, support pause/resume/reset, and recover
after refresh/backgrounding. Expiry never auto-completes a step. Restarting a
recipe clears only its own timers and requires inline confirmation. Storage
errors appear on the page. Timers do not promise sound or background OS alarms.

The shared contract currently carries ingredient mass only. Do not treat pieces
or millilitres as grams without an agreed mapping from B/C.

## Integration boundaries

C owns navigation from `/cook/shopping` to `/cook/cooking` and writing the
`mealdeal.currentPlan` key. The older C branch used a different key and a
`/cook/ready` handoff; this implementation follows the superseding team update.
A owns Auth0 and the later Tiger Data adapter at `src/lib/db.ts`. This change
adds no database, cloud progress endpoint, image storage, or identity provider.

## Verification

```sh
node --experimental-strip-types --test src/features/cooking/session.test.mjs src/features/cooking/plan-storage.test.mjs src/features/surplus/inventory.test.mjs
npm run lint
npm run build
```

If Turbopack cannot open its internal process port in the local environment,
use `npm run build -- --webpack`.

Manual checks: missing/malformed current plan; unfinished shopping; a valid C
plan; fold/open both recipes; finish steps; start/pause/reset timers; refresh;
return after timer expiry; change units; complete all recipes; restart one.
Check a narrow phone viewport and denied browser storage.
