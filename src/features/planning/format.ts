import { GRAMS_PER, type UnitPrefs } from "@/types";

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);
}

export function formatWeight(grams: number, units: UnitPrefs): string {
  const value = grams / GRAMS_PER[units.weight];
  const digits = units.weight === "g" ? 1 : 3;
  return `${new Intl.NumberFormat(units.lang, { maximumFractionDigits: digits }).format(value)} ${units.weight === "jin" ? "斤" : units.weight}`;
}

export function formatMealSlots(slots: string[]): string {
  return slots.map((slot) => slot.replace(/^day(\d+)-/, "Day $1 ")).join(", ");
}
