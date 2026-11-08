import type { PantryItem, Product, Store, UserProfile } from "@/types";

const restrictions: Record<string, RegExp> = {
  peanut: /peanut|花生/i,
  tree_nuts: /almond|walnut|cashew|hazelnut|pecan|pistachio|brazil nut|macadamia|坚果/i,
  dairy: /milk|cheese|yogurt|butter|cream|whey|奶|乳/i,
  egg: /\beggs?\b|蛋/i,
  gluten: /wheat|pasta|noodle|bread|flour|barley|rye|soy sauce|小麦|面|酱油/i,
  shellfish: /shrimp|prawn|crab|lobster|clam|mussel|oyster|scallop|虾|蟹|蚝|贝/i,
  soy: /soy|tofu|edamame|豆腐|黄豆|酱油/i,
  fish: /fish|salmon|tuna|cod|sardine|anchov|鱼/i,
  sesame: /sesame|芝麻/i,
  meat: /chicken|beef|pork|bacon|ham|turkey|lamb|duck|sausage|gelatin|鸡|牛肉|猪|羊肉|鸭/i,
  pork: /pork|bacon|ham|猪/i,
};

function restrictionKey(value: string): string {
  const name = value.toLowerCase().trim().replaceAll(/[ _-]/g, "");
  const aliases: Record<string, string> = {
    peanuts: "peanut", peanut: "peanut", 花生: "peanut", treenuts: "tree_nuts",
    nuts: "tree_nuts", dairy: "dairy", milk: "dairy", lactose: "dairy", 牛奶: "dairy",
    eggs: "egg", egg: "egg", 鸡蛋: "egg", gluten: "gluten", wheat: "gluten",
    shellfish: "shellfish", soy: "soy", soybean: "soy", 大豆: "soy", fish: "fish",
    sesame: "sesame", nopork: "pork", porkfree: "pork",
  };
  return aliases[name] ?? name;
}

export function blockedByProfile(name: string, profile: UserProfile): boolean {
  for (const allergy of profile.allergies) {
    const expression = restrictions[restrictionKey(allergy)];
    if (expression ? expression.test(name) : name.toLowerCase().includes(allergy.toLowerCase())) {
      return true;
    }
  }
  for (const dietary of profile.dietary) {
    const key = dietary.toLowerCase().replaceAll(/[ _-]/g, "");
    if (["vegetarian", "vegan", "halal", "kosher"].includes(key)
      && (restrictions.meat.test(name) || restrictions.fish.test(name) || restrictions.shellfish.test(name))) {
      return true;
    }
    if (key === "vegan" && (restrictions.dairy.test(name) || restrictions.egg.test(name) || /honey|蜂蜜/i.test(name))) {
      return true;
    }
    const expression = restrictions[restrictionKey(dietary)];
    if (expression?.test(name)) {
      return true;
    }
  }
  if (profile.meatVeg === "vegetarian") {
    return restrictions.meat.test(name) || restrictions.fish.test(name) || restrictions.shellfish.test(name);
  }
  return false;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

function priceIsCurrent(validUntil: string, today: string, now: Date): boolean {
  if (/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) {
    const timestamp = Date.parse(`${validUntil}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === validUntil && validUntil >= today;
  }
  return Date.parse(validUntil) >= now.getTime();
}

export function filterProducts(products: Product[], stores: Store[], profile: UserProfile, now = new Date()): Product[] {
  const storeMap = new Map(stores.map((store) => [store.id, store]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return products.filter((product) => {
    const store = storeMap.get(product.storeId);
    if (!store || product.packageUnit !== "g" || product.packageSizeG <= 0 || product.packagePrice < 0) {
      return false;
    }
    if (product.validUntil) {
      if (!priceIsCurrent(product.validUntil, today, now)) {
        return false;
      }
    }
    if (profile.home && distanceKm(profile.home, store) > profile.maxDistanceKm) {
      return false;
    }
    return !blockedByProfile(product.name, profile);
  }).map((product) => ({
    ...product,
    // Recompute from the package; an extracted unit price is never authoritative.
    pricePer100: product.packagePrice * 100 / product.packageSizeG,
  })).sort((a, b) => a.pricePer100 - b.pricePer100);
}

export function filterPantry(items: PantryItem[], profile: UserProfile): PantryItem[] {
  return items.filter((item) => !blockedByProfile(item.name, profile));
}
