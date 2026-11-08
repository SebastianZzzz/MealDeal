import type { MealPlan } from "@/contracts/types";

/** C supplies final quantities and servings. The cooking UI never scales them again. */
export const demoMealPlan: MealPlan = {
  id: "demo-tomato-eggs-v1",
  userId: "demo-local",
  request: { budget: 15, servings: 2, duration: "one_meal", batchCook: false, cuisines: ["chinese"], meatVeg: "balanced" },
  chosen: {
    id: "demo-tomato-eggs-option",
    title: "A little comfort, on a budget",
    recipes: [
      {
        id: "tomato-eggs",
        title: "Tomato & egg stir-fry",
        mealSlots: ["day1-dinner"],
        servings: 2,
        totalMinutes: 15,
        recipeCost: 3.4,
        ingredients: [
          { productId: "demo-tomato", name: "Tomatoes", qtyG: 400 },
          { productId: "demo-eggs", name: "Eggs, without shells", qtyG: 200 },
          { pantryItemId: "demo-oil", name: "Cooking oil", qtyG: 15 },
          { pantryItemId: "demo-salt", name: "Salt", qtyG: 2 },
        ],
        steps: [
          { index: 1, summary: "Get everything ready", detail: "Wash the tomatoes and cut them into small wedges. Crack the eggs into a bowl, add the salt and beat until combined. Keep raw egg away from ready-to-eat food and wash your hands after handling it." },
          { index: 2, summary: "Gently scramble the eggs", detail: "Warm half the oil in a pan over medium heat. Add the beaten eggs and gently fold until set with no runny egg remaining. Transfer to a clean plate.", timerSec: 120 },
          { index: 3, summary: "Let the tomatoes soften", detail: "Add the remaining oil and tomatoes to the pan. Stir over medium heat until the tomatoes soften and release their juices. The timer is a reminder; check the texture before moving on.", timerSec: 180 },
          { index: 4, summary: "Bring it all together", detail: "Return the cooked eggs to the pan and stir gently until everything is hot throughout. Taste, adjust the seasoning if needed, and serve with the rice." },
        ],
      },
      {
        id: "steamed-rice",
        title: "Simple steamed rice",
        mealSlots: ["day1-dinner"],
        servings: 2,
        totalMinutes: 25,
        recipeCost: 0.6,
        ingredients: [{ pantryItemId: "demo-rice", name: "Dry jasmine rice", qtyG: 150 }],
        steps: [
          { index: 1, summary: "Rinse and add water", detail: "Rinse the rice in cool water and drain. Put it in a small pot and add water according to the rice package instructions." },
          { index: 2, summary: "Cover and simmer", detail: "Bring to a boil, then cover and reduce to the lowest heat. Cook for the time on the rice package, checking that the water is absorbed and the grains are tender. Adjust this reminder if your package gives a different time.", timerSec: 900 },
          { index: 3, summary: "Rest, then fluff", detail: "Turn off the heat and leave covered for 5 minutes. Fluff gently with a fork before serving.", timerSec: 300 },
        ],
      },
    ],
    shoppingList: [],
    recipeCost: 4,
    shoppingCost: 8.5,
    costPerServing: 2,
    leftovers: [],
    withinBudget: true,
  },
  status: "cooking",
  progress: {},
  createdAt: "2026-11-07T23:00:00.000Z",
};
