import type { PlanRequest } from "@/types";

export function getMealSlots(request: PlanRequest): string[] {
  if (request.duration === "one_meal") {
    return ["day1-dinner"];
  }
  const names = request.mealsPerDay === 3 ? ["breakfast", "lunch", "dinner"]
    : request.mealsPerDay === 2 ? ["lunch", "dinner"] : ["dinner"];
  const slots: string[] = [];
  for (let day = 1; day <= (request.days ?? 1); day++) {
    for (const name of names) {
      slots.push(`day${day}-${name}`);
    }
  }
  return slots;
}
