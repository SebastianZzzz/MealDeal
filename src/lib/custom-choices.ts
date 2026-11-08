// Checks for the optional "Other" entries in onboarding. Done locally (no Gemini call): the words must
// look like a real choice and be one we can act on. Diet and allergy entries reach the planner and the
// Gemini prompt, so junk or instructions never get that far. The profile API re-checks the format.

export type ChoiceKind = "dietary" | "allergy" | "equipment" | "goal" | "pantry";

// Letters (any script), spaces, hyphens and apostrophes; 2-40 characters; at most four words.
export const CHOICE_FORMAT = /^(?=.{2,40}$)\p{L}[\p{L}'’-]*(?: [\p{L}'’-]+){0,3}$/u;

const FOODS = [
  "peanut", "tree nut", "nut", "almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "coconut",
  "milk", "dairy", "lactose", "cheese", "butter", "cream", "yogurt", "egg", "wheat", "gluten", "barley", "rye", "oat",
  "soy", "soya", "tofu", "sesame", "mustard", "celery", "lupin", "sulphite", "sulfite", "corn", "maize",
  "fish", "salmon", "tuna", "cod", "anchovy", "shellfish", "shrimp", "prawn", "crab", "lobster", "mollusc", "mussel", "oyster", "clam", "squid", "scallop",
  "pork", "beef", "chicken", "lamb", "mutton", "turkey", "duck", "gelatin", "meat", "bacon", "ham", "sausage",
  "mushroom", "onion", "garlic", "tomato", "potato", "pepper", "chili", "chilli", "eggplant", "aubergine", "zucchini", "carrot", "pea", "bean", "lentil", "chickpea", "legume",
  "broccoli", "cabbage", "spinach", "lettuce", "cucumber", "avocado", "olive", "cilantro", "coriander", "ginger", "cinnamon", "nutmeg", "cumin", "paprika", "msg",
  "apple", "banana", "kiwi", "strawberry", "berry", "peach", "mango", "pineapple", "citrus", "orange", "lemon", "lime", "grape", "melon", "cherry", "plum",
  "rice", "noodle", "pasta", "bread", "flour", "sugar", "honey", "chocolate", "cocoa", "caffeine", "coffee", "tea", "alcohol", "wine", "vinegar", "yeast", "seed", "sunflower", "buckwheat", "quinoa",
];
const DIETS = [
  "vegetarian", "vegan", "halal", "kosher", "pescatarian", "pescetarian", "flexitarian", "jain", "keto", "ketogenic", "paleo", "low carb", "low-carb",
  "low fodmap", "fodmap", "diabetic", "diabetes friendly", "low sodium", "low salt", "low sugar", "low fat", "heart healthy", "plant based", "plant-based",
  "gluten free", "gluten-free", "dairy free", "dairy-free", "lactose free", "lactose-free", "nut free", "nut-free", "egg free", "egg-free", "soy free", "soy-free",
  "no red meat", "raw", "whole food", "mediterranean", "dash", "kidney friendly", "renal",
];
const EQUIPMENT = [
  "stovetop", "stove", "hob", "induction", "hot plate", "burner", "pot", "pan", "saucepan", "frying pan", "skillet", "wok", "dutch oven", "casserole", "sheet pan", "baking tray", "baking dish",
  "oven", "toaster oven", "toaster", "microwave", "rice cooker", "air fryer", "slow cooker", "crock pot", "crockpot", "pressure cooker", "instant pot", "multicooker",
  "steamer", "grill", "griddle", "kettle", "electric kettle", "blender", "immersion blender", "food processor", "mixer", "stand mixer", "hand mixer", "sous vide",
  "waffle maker", "sandwich maker", "panini press", "bread maker", "juicer", "thermometer", "kitchen scale", "scale", "fridge", "freezer",
];
// Pantry staples and seasonings on top of FOODS (pantry names are sent to the planner prompt).
const PANTRY = [
  "salt", "oil", "olive oil", "sesame oil", "soy sauce", "fish sauce", "oyster sauce", "hoisin", "sriracha", "ketchup", "mayo", "mayonnaise",
  "sauce", "stock", "broth", "bouillon", "spice", "herb", "seasoning", "curry", "paste", "miso", "gochujang", "doenjang", "kimchi",
  "starch", "cornstarch", "baking soda", "baking powder", "jam", "peanut butter", "syrup", "dumpling", "tortilla", "bagel", "cereal",
  "frozen vegetable", "spam", "sausage", "leftover", "instant noodle", "ramen", "udon", "soba", "vermicelli", "rice cake", "cracker",
  "bok choy", "kale", "corn", "green onion", "scallion", "leek", "celery", "squash", "pumpkin", "sweet potato", "yam", "beet", "radish",
  "mushroom", "pepper", "parsley", "basil", "oregano", "thyme", "rosemary", "turmeric", "chili flake", "chili oil", "five spice",
];

const GOALS = [
  "high protein", "more protein", "balanced", "low calorie", "fewer calories", "high fiber", "high fibre", "more fiber", "more fibre", "low sugar", "less sugar",
  "low sodium", "less salt", "low fat", "heart healthy", "more vegetables", "more veg", "more fruit", "high iron", "more iron", "more calcium", "low carb",
  "bulking", "cutting", "weight loss", "weight gain", "muscle gain", "energy", "budget friendly", "filling",
];

const words = (text: string) => text.toLowerCase().replace(/[’']/g, "").replace(/-/g, " ").split(/\s+/).filter(Boolean);
const singular = (word: string) => word.replace(/(ies)$/, "y").replace(/(ches|shes|oes|ses)$/, (m) => m.slice(0, -2)).replace(/s$/, "");
const matches = (text: string, list: string[]) => {
  const plain = words(text).map(singular).join(" ");
  return list.some((entry) => {
    const target = words(entry).map(singular).join(" ");
    return plain === target || ` ${plain} `.includes(` ${target} `);
  });
};

const EXAMPLES: Record<ChoiceKind, string> = {
  dietary: "pescatarian, gluten-free or no pork",
  allergy: "mushroom, sesame or shellfish",
  equipment: "wok, steamer or slow cooker",
  goal: "high fiber, low sugar or more vegetables",
  pantry: "jasmine rice, soy sauce or frozen dumplings",
};

export type ChoiceVerdict = "ok" | "bad-format" | "unknown";

/** Local, instant check: format first, then the vocabulary. "unknown" means ask the model. */
export function classifyCustomChoice(kind: ChoiceKind, raw: string): ChoiceVerdict {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!CHOICE_FORMAT.test(text)) return "bad-format";
  const known = kind === "pantry" ? matches(text, FOODS) || matches(text, PANTRY)
    : kind === "allergy" ? matches(text, FOODS)
    : kind === "dietary" ? matches(text, DIETS) || (/^(no|without|avoid)\s/i.test(text) && matches(text, FOODS))
    : kind === "equipment" ? matches(text, EQUIPMENT)
    : matches(text, GOALS);
  return known ? "ok" : "unknown";
}

export function formatProblem(kind: ChoiceKind): string {
  return `Use a short name with letters only, like ${EXAMPLES[kind]}.`;
}

export function notRecognized(kind: ChoiceKind, text: string): string {
  if (kind === "pantry") return `"${text}" doesn't look like food you'd keep at home, so plans couldn't use it. Try something like ${EXAMPLES[kind]}.`;
  return kind === "allergy"
    ? `"${text}" doesn't look like a food, so plans couldn't avoid it. Try something like ${EXAMPLES[kind]}.`
    : `"${text}" doesn't look like a ${kind === "dietary" ? "diet" : kind === "equipment" ? "kitchen tool" : "nutrition goal"} we can use. Try something like ${EXAMPLES[kind]}.`;
}

/** Local-only check used where no model is available: error message, or null when usable. */
export function checkCustomChoice(kind: ChoiceKind, raw: string): string | null {
  const verdict = classifyCustomChoice(kind, raw);
  return verdict === "ok" ? null : verdict === "bad-format" ? formatProblem(kind) : notRecognized(kind, raw.trim());
}
