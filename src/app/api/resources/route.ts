import { foodResources } from "@/features/support/resources";
import { json } from "@/features/community/http";
import { apiError } from "@/lib/api-error";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().toLowerCase();
  const type = params.get("type");
  const types = ["food_bank", "low_cost_market", "community_fridge", "free_meal", "other"];
  const fields: Record<string, string> = {};
  if (query.length > 200) fields.q = "Use at most 200 characters.";
  if (type && !types.includes(type)) fields.type = "Choose a supported resource category.";
  if (Object.keys(fields).length) return apiError("VALIDATION_FAILED", "Check the resource search filters.", fields);
  const items = foodResources.filter((item) => (!type || item.type === type)
    && `${item.name} ${item.address} ${item.eligibility}`.toLowerCase().includes(query));
  return json({ items, mode: "curated", notice: "Check the official source before you go. Hours, eligibility and availability may change." });
}
