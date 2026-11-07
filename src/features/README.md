# Feature ownership

Feature-specific UI, validation, and business logic live here. Route files under
`src/app` should stay thin and import from these folders.

| Folder | Owner | Scope |
| --- | --- | --- |
| `profile` | A | onboarding, preferences, equipment, pantry |
| `catalog` | B | stores, products, flyers, price-tag extraction |
| `planning` | C | Gemini recipe generation, costs, nutrition, shopping list |
| `cooking` | D | guided recipe steps and timers |
| `support` | D | verified UBC food resources |
| `surplus` | D | merchant listings and reservations |

Do not import another feature's private components. Promote shared data shapes to
`src/contracts`, and generic visual components to `src/components/ui`.
