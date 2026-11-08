// Code rules that link a product or pantry name to a nutrition-database food id (see mock/foods.json).
// Dependency-free so browser code (the planning adapter) can use it too.

// Ordered: the first matching rule wins, so specific names come before general ones.
const RULES: [RegExp, string | null][] = [
  [/\btofu\b/, "tofu-raw"],
  [/greek/, "yogurt-greek"],
  [/yog(h)?urt|activia|oikos/, "yogurt-plain"],
  [/ricotta/, "cheese-ricotta"],
  [/cream cheese|boursin/, "cheese-cream"],
  [/(process|slices|singles).*cheese|cheese.*(slices|singles)/, "cheese-processed"],
  [/cheese|cheddar|mozzarella/, "cheese-cheddar"],
  [/\bribs?\b|roasted|cooked|bbq/, null], // prepared or sauced meats: no honest raw match
  [/chicken.*breast|breast.*chicken/, "chicken-breast-raw"],
  [/drumstick/, "chicken-drumstick-raw"],
  [/\bwings?\b/, "chicken-wing-raw"],
  [/chicken/, "chicken-whole-raw"],
  [/\bbeef\b/, "beef-ground-85-raw"],
  [/pork.*tenderloin|tenderloin/, "pork-tenderloin-raw"],
  [/\bchops?\b/, "pork-loin-chop-raw"],
  [/picnic|shoulder|pork butt/, "pork-shoulder-raw"],
  [/salmon/, "salmon-raw"],
  [/\beggs?\b/, "egg-raw"],
  [/lentil/, "lentils-dry"],
  [/peanut butter|rice cake|rice cracker/, null],
  [/\brice\b|basmati|jasmine/, "rice-white-raw"],
  [/noodle|ramen|ichiban/, "noodles-ramen-dry"],
  [/pasta|spaghetti|macaroni|penne|fusilli|linguine/, "pasta-dry"],
  [/\boat(s|meal)?\b/, "oats-dry"],
  [/flour/, "flour-wheat"],
  [/sourdough|baguette|french bread/, "bread-sourdough"],
  [/whole wheat|whole grain|multigrain|country harvest/, "bread-whole-wheat"],
  [/bread|\bbuns?\b|\bloaf\b/, "bread-white"],
  [/potato/, "potato-raw"],
  [/carrot/, "carrot-raw"],
  [/broccoli/, "broccoli-raw"],
  [/tomato/, "tomato-raw"],
  [/onion/, "onion-raw"],
  [/garlic/, "garlic-raw"],
  [/cabbage/, "cabbage-raw"],
  [/spinach/, "spinach-raw"],
  [/mushroom/, "mushroom-raw"],
  [/bell pepper|(red|green|yellow|orange) peppers?\b/, "bell-pepper-raw"],
  [/cucumber/, "cucumber-raw"],
  [/\bapples?\b/, "apple-raw"],
  [/banana/, "banana-raw"],
  [/soy sauce/, "soy-sauce"],
  [/\bbutter\b/, "butter"],
  [/\boil\b/, "oil-vegetable"],
  [/\bsugar\b/, "sugar"],
  [/\bmilk\b/, "milk-2pct"],
];

export function matchFood(name: string, brand?: string): string | undefined {
  const text = `${brand ?? ""} ${name}`.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  for (const [pattern, foodId] of RULES) {
    if (pattern.test(text)) return foodId ?? undefined;
  }
  return undefined;
}
