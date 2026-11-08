// Deterministic price/size parsing. Gemini and Flipp only give us the text as printed;
// every number stored in a Product is computed here.

export type PackageUnit = "g" | "ml" | "piece";

export type SizeInfo =
  | { kind: "fixed"; qty: number; unit: PackageUnit } // a package of known size
  | { kind: "per_weight"; basisG: number }; // sold by weight, e.g. "per lb"

export interface PriceInfo {
  amount: number; // CAD for one package, or for one weight basis when perWeightG is set
  perWeightG?: number; // set when the price is per weight, e.g. 453.592 for "/lb"
}

export interface NormalizedPrice {
  packageSizeG: number; // grams, ml, or piece count (see packageUnit)
  packageUnit: PackageUnit;
  packagePrice: number;
  pricePer100: number; // CAD per 100 g / 100 ml / 1 piece
  soldByWeight: boolean; // packageSizeG is a nominal amount, not a printed package size
}

const GRAMS: Record<string, number> = {
  g: 1, gr: 1, gram: 1, grams: 1,
  kg: 1000, kilo: 1000, kilos: 1000, kilogram: 1000, kilograms: 1000,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
};
const MILLILITRES: Record<string, number> = {
  ml: 1, millilitre: 1, milliliter: 1, millilitres: 1, milliliters: 1,
  l: 1000, litre: 1000, liter: 1000, litres: 1000, liters: 1000,
};
const PIECES: Record<string, number> = {
  pk: 1, pack: 1, ct: 1, count: 1, ea: 1, each: 1, pc: 1, pcs: 1, piece: 1, pieces: 1, eggs: 1, rolls: 1, buns: 1,
};

// "per lb" style bases, longest first so "100 g" wins over "g".
const WEIGHT_BASES: [RegExp, number][] = [
  [/100\s*g\b/, 100],
  [/\bkg\b/, 1000],
  [/\blbs?\b/, GRAMS.lb],
];

// Package size for items sold by weight. Shopping cost rounds up to whole packages,
// so we use roughly one pound (or 500 g for metric prices) as a sensible "buy about this much" unit.
const NOMINAL_LB_G = GRAMS.lb;
const NOMINAL_METRIC_G = 500;

const round = (value: number, places: number) => Number(value.toFixed(places));
const toNumber = (text: string) => Number(text.replace(",", "."));

export function parseSize(text: string | null | undefined): SizeInfo | null {
  if (!text) return null;
  const s = text.toLowerCase().replace(/\s+/g, " ").trim();

  if (/\b(dozen|doz)\b/.test(s)) {
    const n = s.match(/(\d+(?:\.\d+)?)\s*(?:dozen|doz)/);
    return { kind: "fixed", qty: 12 * (n ? toNumber(n[1]) : 1), unit: "piece" };
  }

  // "4 x 100 g", "6x355 ml"
  const multi = s.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*([a-z]+)/);
  if (multi) {
    const one = unitAmount(toNumber(multi[2]), multi[3]);
    if (one) return { ...one, qty: round(Number(multi[1]) * one.qty, 3) };
  }

  // "per lb", "/kg", "per 100 g", or a bare "lb" with no number in front of it.
  const per = s.match(/(?:per|\/)\s*(100\s*g|kg|lbs?)\b/) ?? (/^\s*(lbs?|kg)\s*$/.test(s) ? s.match(/(lbs?|kg)/) : null);
  if (per) return { kind: "per_weight", basisG: weightBasis(per[1]) };

  const plain = s.match(/(\d+(?:[.,]\d+)?)\s*([a-z]+)/);
  if (plain) return unitAmount(toNumber(plain[1]), plain[2]);
  return null;
}

function unitAmount(qty: number, rawUnit: string): { kind: "fixed"; qty: number; unit: PackageUnit } | null {
  const unit = rawUnit.replace(/\.$/, "");
  if (!(qty > 0)) return null;
  if (unit in GRAMS) return { kind: "fixed", qty: round(qty * GRAMS[unit], 3), unit: "g" };
  if (unit in MILLILITRES) return { kind: "fixed", qty: round(qty * MILLILITRES[unit], 3), unit: "ml" };
  if (unit in PIECES) return { kind: "fixed", qty, unit: "piece" };
  return null;
}

function weightBasis(token: string): number {
  for (const [pattern, grams] of WEIGHT_BASES) if (pattern.test(token)) return grams;
  return GRAMS.lb;
}

// Parses the first price in the text, e.g. "$2.99/lb", "2 for $5", "3/$10", "99¢", "$4.99 ea".
export function parsePrice(text: string | null | undefined): PriceInfo | null {
  if (!text) return null;
  const s = text.toLowerCase().replace(/\s+/g, " ").trim();

  // Multi-buy: "2 for $5", "2/$5", "2 / $5.00"
  const multi = s.match(/(\d+)\s*(?:for|\/)\s*\$\s*(\d+(?:\.\d{1,2})?)/);
  if (multi && Number(multi[1]) > 0) {
    return { amount: round(toNumber(multi[2]) / Number(multi[1]), 4) };
  }

  const dollars = s.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  const cents = s.match(/(\d+)\s*(?:¢|c\b)/);
  let amount: number | null = null;
  let rest = "";
  if (dollars) {
    amount = toNumber(dollars[1]);
    rest = s.slice((dollars.index ?? 0) + dollars[0].length);
  } else if (cents) {
    amount = Number(cents[1]) / 100;
    rest = s.slice((cents.index ?? 0) + cents[0].length);
  } else {
    const bare = s.match(/^(\d+(?:\.\d{1,2})?)\b/);
    if (bare) {
      amount = toNumber(bare[1]);
      rest = s.slice(bare[0].length);
    }
  }
  if (amount === null || !(amount > 0)) return null;

  // A weight basis right after the price ("/lb", " per kg", " only lb") belongs to this price.
  const basis = rest.match(/^\s*(?:\/|per|only|ea\.?)?\s*(100\s*g|kg|lbs?)\b/);
  if (basis) return { amount, perWeightG: weightBasis(basis[1]) };
  return { amount };
}

// Combines a printed size and a printed price into the stored Product numbers.
export function normalizePrice(sizeText: string | null | undefined, priceText: string | null | undefined): NormalizedPrice | null {
  const price = parsePrice(priceText);
  if (!price) return null;
  const size = parseSize(sizeText);

  const perWeightG = price.perWeightG ?? (size?.kind === "per_weight" ? size.basisG : undefined);
  if (perWeightG) {
    // Sold by weight: a printed fixed weight (e.g. "approx. 1.2 kg") wins over the nominal amount.
    const fixedG = size?.kind === "fixed" && size.unit === "g" ? size.qty : undefined;
    const packageSizeG = fixedG ?? (perWeightG === GRAMS.lb ? NOMINAL_LB_G : NOMINAL_METRIC_G);
    const per100 = (price.amount / perWeightG) * 100;
    return {
      packageSizeG: round(packageSizeG, 3),
      packageUnit: "g",
      packagePrice: round((per100 * packageSizeG) / 100, 2),
      pricePer100: round(per100, 4),
      soldByWeight: fixedG === undefined,
    };
  }

  if (!size || size.kind !== "fixed") return null;
  return {
    packageSizeG: size.qty,
    packageUnit: size.unit,
    packagePrice: round(price.amount, 2),
    pricePer100: round(size.unit === "piece" ? price.amount / size.qty : (price.amount / size.qty) * 100, 4),
    soldByWeight: false,
  };
}
