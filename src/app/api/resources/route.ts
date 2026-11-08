import { foodResources } from "@/features/support/resources";
import { json } from "@/features/community/http";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().toLowerCase();
  const type = params.get("type");
  const types = ["food_bank", "low_cost_market", "community_fridge", "free_meal", "other"];
  if (query.length > 200 || (type && !types.includes(type))) return json({ error: "Invalid search or resource type." }, 400);
  const items = foodResources.filter((item) => (!type || item.type === type)
    && `${item.name} ${item.address} ${item.eligibility}`.toLowerCase().includes(query));
  return json({ items, mode: "curated", notice: "Check the official source before you go. Hours, eligibility and availability may change." });
}
