import type { PriceObservation, Product } from "@/types";

// Demo-only price history so the deal check has something to compare against on day one.
// Every row is source "sample" and the UI labels it. Real history accumulates from flyers and reports.

// Weekly multipliers relative to today's price per 100 g (oldest first), chosen to show each verdict.
const SAMPLE_PATTERNS: Record<string, number[]> = {
  "no-frills@west-5th-avenue:whole-pork-picnic-454g": [1.32, 1.28, 1.35, 1.3], // real deal (~-23%)
  "save-on-foods@5945-berton-avenue:western-family-jasmine-rice-907g": [1.2, 1.25, 1.18, 1.22], // real deal
  "save-on-foods@5945-berton-avenue:only-goodness-chicken-drumsticks-454g": [1.15, 1.2, 1.12, 1.18], // real deal
  "save-on-foods@5945-berton-avenue:carrots-1361g": [1.02, 0.97, 1.0, 1.04], // normal
  "save-on-foods@5945-berton-avenue:pork-tenderloin-454g": [0.98, 1.03, 1.01, 0.97], // normal
  "no-frills@west-5th-avenue:broccoli-crowns-454g": [0.85, 0.82, 0.88, 0.84], // pricier (~+18%)
};

const WEEKS_AGO = [27, 20, 13, 6]; // days before the product's current price, oldest first
const DAY_MS = 24 * 60 * 60 * 1000;

export type SampleObservation = Omit<PriceObservation, "observedAt"> & { observedAt: string };

export function sampleHistory(products: Product[]): SampleObservation[] {
  const rows: SampleObservation[] = [];
  for (const product of products) {
    const pattern = SAMPLE_PATTERNS[product.id];
    if (!pattern) continue;
    const anchor = new Date(product.reportedAt).getTime();
    pattern.forEach((factor, i) => {
      rows.push({
        productId: product.id,
        storeId: product.storeId,
        pricePer100: Number((product.pricePer100 * factor).toFixed(4)),
        packagePrice: Number((product.packagePrice * factor).toFixed(2)),
        isSale: false,
        source: "sample",
        observedAt: new Date(anchor - WEEKS_AGO[i] * DAY_MS).toISOString(),
      });
    });
  }
  return rows;
}
