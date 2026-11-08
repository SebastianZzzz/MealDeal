import type { PlanOption } from "@/types";

export function storeCount(option: Pick<PlanOption, "shoppingList">): number {
  return new Set(option.shoppingList.map((item) => item.storeId)).size;
}

export function comparePlanOptions(a: PlanOption, b: PlanOption): number {
  return Number(b.withinBudget) - Number(a.withinBudget)
    || storeCount(a) - storeCount(b)
    || a.shoppingCost - b.shoppingCost;
}
