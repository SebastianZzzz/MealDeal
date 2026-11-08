# MealDeal: four-minute pitch draft

Rehearse with a stopwatch. This script is for the integrated team build; use
only demo steps the team has verified. It does not claim a deployed database,
measured impact, partner merchants, or completed user research.

## 0:00–0:40 — The problem

Imagine opening your fridge with twenty-five dollars left for food. You need to
know what you can buy, what you can cook with it, and what happens if the budget
still does not stretch far enough.

Food Banks Canada recorded more than 2.35 million food bank visits in March
2026. That is visits, not unique people. The scale is national; our prototype
starts with one local community in Vancouver.
[Source: HungerCount 2026](https://foodbankscanada.ca/hungercount-report-2026/).

MealDeal brings three practical choices into one place: cook at home, find food
support, or explore surplus food. People can choose a useful next step without
having to label themselves first.

## 0:40–2:40 — The main demonstration

Here is our cooking flow. We start with a grocery price tag. Gemini transcribes
what it sees, and the user confirms the product, size, store and price.

Next, we enter a budget, servings and kitchen preferences. The planner starts
with available affordable products. It asks Gemini to compose recipes within
that product set. Code validates the references and calculates the quantities
and costs.

There are two different numbers worth showing. Recipe cost is the value of the
food used. Shopping cost is the price of the full packages you must buy today.
We compare the budget against shopping cost, because that is the money leaving
the user's pocket. Pantry ingredients reduce what needs to be purchased, and
leftovers remain visible.

After choosing a plan, we get a shopping list grouped by store. Cooking steps
stay out of the way until shopping is complete.

Now the selected plan opens in guided cooking. Each recipe has its own steps.
Complete one and the next opens. Timers start when the cook is ready; they can
pause, resume and recover after a refresh. Ingredient quantities already come
scaled from the planner. We convert the display unit without multiplying them
again. Completing the recipes saves the plan's progress on this browser.

## 2:40–3:20 — Community support

Sometimes the best next step is finding support. Our curated Vancouver list
shows a service's address, hours, access information, official source and the
date we checked it. A visible notice asks people to verify before travelling.

Our surplus flow demonstrates posting and reserving end-of-day food. The sample
merchants are labeled. Local demo reservations do not hold real food. Shared
inventory has an API and conditional SQL update prepared for the database
adapter; describe it as live only after the team validates that connection.

## 3:20–4:00 — What is distinctive and next

Our focus is budget-to-meal matching: start from affordable available products,
then build a meal, while keeping the checkout cost understandable.

AI handles interpretation and recipe composition. Application code handles
prices, package counts, budgets and quantities. The result leads into actions a
person can take: shop, cook, or find a relevant community resource.

Next we want to test this with community members and measure task completion,
checkout-budget accuracy, resource-link usefulness and accessibility. We have
not measured those outcomes yet. MealDeal is a prototype for making the next
food decision a little clearer and a little less stressful.

## Questions to rehearse

- **Are the prices current?** Show source/date labels and which records are
  seeded, reported or verified. Do not describe all seed data as independently
  verified current offers.
- **Can AI invent costs?** Explain reference validation and deterministic package
  arithmetic; demonstrate actual selected products.
- **Is it allergy-safe?** Name-based filtering is not certification. Users must
  verify ingredients and cross-contact with the source/merchant.
- **Is the inventory shared?** State the actual storage mode in the demonstrated
  build. Browser locks protect local tabs; database updates protect shared stock.
- **What impact have you measured?** No impact metrics yet. Explain the proposed
  evaluation and community feedback plan rather than inventing savings or users.
