# Devpost submission draft

Team draft: confirm integrated/deployed features and sponsor eligibility before
submitting. D has prepared this text, not submitted it to Devpost.

## Project name

MealDeal

## Tagline

Turn a food budget into a practical plan: shop, cook, and find local support.

## Inspiration

An affordable recipe is useful only if someone can afford the full grocery
packages, has the equipment to cook it, and can find help when the budget still
falls short. We wanted one mobile-first entry point for those next decisions.

Food Banks Canada's HungerCount 2026 recorded 2,355,075 food bank visits in March
2026. This counts visits rather than unique people and provides national
context, not a measurement of our app's impact.
[Official report](https://foodbankscanada.ca/hungercount-report-2026/).

## What it does

The team project combines grocery price-tag reporting, budget-based meal
planning, shopping lists and guided cooking. The planner starts with candidate
products, validates recipe references and computes full-package shopping cost
separately from ingredient-use cost. Cooking consumes the selected plan's final
quantities and supports step progression, timers and browser-local recovery.

Food Support lists curated Vancouver/UBC resources with official links,
verification dates and access details. A simplified surplus-food flow provides
sample listing publication, browsing and reservation interactions.

## How we built it

Next.js App Router, TypeScript, React and Tailwind provide a mobile-first web
application. Auth0 is the team's identity provider. Gemini is used in the team's
price-tag interpretation and constrained recipe generation modules; application
code validates outputs and performs arithmetic. Confirm which Gemini calls ran
in the final demonstration before recording the sponsor submission.

The shared contract is `src/types.ts`. Each feature owns its UI and routes.
Current local demos use bundled data and localStorage. D's HTTP interfaces and
parameterized SQL repositories are prepared for A's shared Tiger Data adapter,
which is a separate integration prerequisite. No images or payments are stored.

## Challenges

We had to distinguish recipe cost from checkout cost, keep portions consistent
across planning and cooking, and make refresh recovery reliable. We also needed
to distinguish curated facts, example data, local simulations and genuinely
shared backend state so the demo communicates its limits accurately.

## Accomplishments

- A shared plan format connecting shopping decisions to cooking steps.
- Deterministic unit conversion, package arithmetic and budget comparisons in
  the relevant team modules.
- Guided cooking with independent recipe progress and recoverable timers.
- Source-linked community support resources.
- Explicitly labeled surplus demos and prepared atomic reservation SQL.

## What we learned

Useful AI features need a dependable numerical and interaction layer around
them. Data contracts, recovery states and honest source labels matter as much as
the initial generated answer.

## What's next

Connect and validate shared persistence, conduct community usability testing,
expand verified price/resource coverage, and evaluate accessibility and task
completion. Nutrition should use database-backed values and disclose missing
coverage; the demo must not present estimated nutrients as verified facts.

## Community Impact statement

MealDeal is intended to reduce the effort of turning a constrained food budget
into a concrete next step. We place cooking and community support alongside one
another, show checkout costs and make resource sources visible. Our initial demo
focuses on Vancouver while aiming to serve people facing food insecurity across
different ages and backgrounds. We have not yet measured savings, reduced food
waste, active users, or health outcomes. Those are future evaluation questions.

## Data and implementation disclosure

- Cooking demo recipes and sample surplus merchants are illustrative.
- Local reservations do not contact real merchants or hold food.
- Curated support records link to official sources and show verification dates.
- Reported/seeded prices must retain their source/date labels.
- Browser-local progress is implemented. Database-backed shared inventory and
  account sync may be described as active only after A's adapter and schema are
  connected and verified in the final build.
- D's unit/API tests use injected dependencies for backend tests; they do not
  prove a live database integration or a completed mobile usability study.

## Submission fields to finish as a team

- Repository URL: https://github.com/SebastianZzzz/MealDeal
- Deployed URL: add the actual working URL after deployment.
- Demo recording: add the verified backup recording if available.
- Team member names/roles: confirm with the team.
- Awards: confirm the event's categories and the team's target entries.
- Sponsor: Gemini API if used and eligible; confirm any other sponsor entries.
- Review every feature claim against the final deployed build before submitting.
