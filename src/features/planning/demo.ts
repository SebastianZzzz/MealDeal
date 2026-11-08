import type { PantryItem, PlanRequest, Product, UserProfile } from "@/types";
import type { DraftOption, DraftRecipe } from "./schema";
import { getMealSlots } from "./slots";

interface Template { title: string; grain: RegExp; protein: RegExp; vegetable: RegExp; minutes: number }
const templates: Template[] = [
  { title: "Rice, chickpea & vegetable bowls", grain: /rice/i, protein: /chickpea/i, vegetable: /mixed vegetables|carrot/i, minutes: 25 },
  { title: "Tomato & lentil pasta", grain: /pasta/i, protein: /cooked lentil/i, vegetable: /tomato/i, minutes: 20 },
  { title: "Tofu & vegetable rice bowls", grain: /rice/i, protein: /tofu/i, vegetable: /mixed vegetables|carrot/i, minutes: 25 },
];

function ingredient(product: Product, grams: number, pantry: PantryItem[]): DraftRecipe["ingredients"][number] {
  const owned = pantry.find((item) => item.name.toLowerCase() === product.name.toLowerCase()
    && (item.qtyG === undefined || item.qtyG >= grams));
  return {
    name: product.name, qtyG: grams,
    productId: owned ? null : product.id, pantryItemId: owned?.id ?? null,
  };
}

export function createDemoOptions(request: PlanRequest, profile: UserProfile, products: Product[], pantry: PantryItem[]): DraftOption[] {
  if (!profile.equipment.includes("stove") || !profile.equipment.includes("pot")) {
    return [];
  }
  const slots = getMealSlots(request);
  const options: DraftOption[] = [];
  for (const template of templates) {
    const grain = products.find((item) => template.grain.test(item.name));
    const protein = products.find((item) => template.protein.test(item.name));
    const vegetable = products.find((item) => template.vegetable.test(item.name));
    if (!grain || !protein || !vegetable) {
      continue;
    }
    const groups = request.batchCook ? [slots] : slots.map((slot) => [slot]);
    const recipes = groups.map((mealSlots): DraftRecipe => ({
      title: template.title, mealSlots, baseServings: 1,
      ingredients: [ingredient(grain, 80, pantry), ingredient(protein, 150, pantry), ingredient(vegetable, 160, pantry)],
      steps: [
        { summary: "Prepare the ingredients", detail: `Measure ${grain.name}, ${protein.name} and ${vegetable.name} using the ingredient list. Wash and cut the vegetables as needed.`, timerSec: null },
        { summary: "Cook the grain", detail: `Cook ${grain.name} in water in a pot, following its package instructions for the listed quantity. The timer is an estimate; follow the package and check doneness.`, timerSec: 12 * 60 },
        { summary: "Warm the protein and vegetables", detail: `Once the grain is cooked, add ${protein.name} and ${vegetable.name} with a little water. Heat thoroughly, stirring as needed.`, timerSec: 5 * 60 },
        { summary: "Serve and portion", detail: "Divide into the number of portions shown in the recipe. Follow local food storage guidance for any portions saved for later meals.", timerSec: null },
      ],
      totalMinutes: template.minutes,
    }));
    options.push({ title: template.title, recipes });
  }
  return options;
}
