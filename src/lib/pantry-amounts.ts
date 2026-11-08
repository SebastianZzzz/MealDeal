// Rough pantry amounts. Students rarely know grams, so onboarding asks "how much, roughly?"
// and the planner gets an estimate. Seasonings only need "I have it": recipes use a spoonful.

export type PantryKind = "seasoning" | "ingredient";
export type PantryAmount = "unknown" | "little" | "some" | "plenty";

export const PANTRY_AMOUNTS: { value: PantryAmount; label: string }[] = [
  { value: "unknown", label: "Not sure" },
  { value: "little", label: "A little" },
  { value: "some", label: "Some" },
  { value: "plenty", label: "Plenty" },
];

const SEASONING_WORDS = [
  "soy sauce", "salt", "black pepper", "white pepper", "peppercorn", "sugar", "oil", "vinegar", "cooking wine", "mirin", "sake",
  "sauce", "ketchup", "mayo", "mayonnaise", "mustard", "honey", "syrup", "msg", "bouillon", "stock cube",
  "spice", "powder", "paste", "seasoning", "garlic powder", "chili flakes", "cumin", "paprika", "oregano",
  "basil", "thyme", "cinnamon", "curry", "sesame", "gochujang", "doenjang", "miso", "sriracha", "dressing",
  "butter", "ghee", "starch", "baking soda", "baking powder", "yeast",
];
const STAPLE_WORDS = ["rice", "noodle", "pasta", "spaghetti", "macaroni", "flour", "oat", "quinoa", "couscous", "bread", "tortilla", "potato"];

const hasWord = (name: string, words: string[]) => {
  const text = ` ${name.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim()} `;
  return words.some((word) => text.includes(` ${word} `) || text.includes(` ${word}s `) || text.includes(` ${word}es `));
};

export function guessPantryKind(name: string): PantryKind {
  const plain = name.trim().toLowerCase();
  return plain === "pepper" || hasWord(name, SEASONING_WORDS) ? "seasoning" : "ingredient";
}

// Grams (or ml) for one rough amount; undefined means "enough for the whole plan".
const ESTIMATE_G: Record<"staple" | "other", Record<Exclude<PantryAmount, "unknown" | "plenty">, number>> = {
  staple: { little: 300, some: 1000 },
  other: { little: 150, some: 400 },
};

export function estimatePantryGrams(item: { name: string; qtyG?: number; kind?: PantryKind; amount?: PantryAmount }): number | undefined {
  if (item.qtyG !== undefined && item.qtyG > 0) return item.qtyG; // an exact amount always wins
  const kind = item.kind ?? guessPantryKind(item.name);
  if (kind === "seasoning") return undefined;
  const amount = item.amount ?? "unknown";
  if (amount === "unknown" || amount === "plenty") return undefined;
  return ESTIMATE_G[hasWord(item.name, STAPLE_WORDS) ? "staple" : "other"][amount];
}
