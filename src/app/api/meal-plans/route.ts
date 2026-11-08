import { z } from "zod";
import { assertDatabaseConfigured, db } from "@/lib/db";
import { getIdentity } from "@/lib/session";
import { apiError, validationError } from "@/lib/api-error";
import { parseCurrentPlan } from "@/features/cooking/plan-storage";
import { planFromRow, PLAN_COLUMNS } from "@/features/planning/plan-row";
import type { MealPlan } from "@/types";

export const runtime = "nodejs";
const MAX_BODY = 256 * 1024;
const saveSchema = z.object({ request: z.unknown(), chosen: z.unknown() });

async function identityOrError() {
  try {
    const identity = await getIdentity();
    return identity?.sub ? { identity } : { response: apiError("UNAUTHORIZED", "Please log in to access saved plans.") };
  } catch {
    return { response: apiError("SERVICE_UNAVAILABLE", "Sign-in is unavailable right now. Please try again later.") };
  }
}

function localDemo(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL;
}

// Only the authenticated account's unfinished plans are returned, with a bounded result size.
export async function GET() {
  const access = await identityOrError();
  if (access.response) {
    return access.response;
  }
  if (localDemo()) {
    return Response.json({ plans: [], mode: "demo" }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    assertDatabaseConfigured();
    const columns = PLAN_COLUMNS.split(", ").map((column) => `p.${column}`).join(", ");
    const result = await db.query(
      `select ${columns} from meal_plans p join users u on u.id = p.user_id
       where u.auth0_id = $1 and p.status in ('shopping', 'cooking')
       order by p.updated_at desc, p.created_at desc, p.id desc limit 20`,
      [access.identity!.sub],
    );
    return Response.json({ plans: result.rows.map((row) => planFromRow(row, access.identity!.sub)), mode: "database" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/meal-plans failed", error instanceof Error ? error.name : "Unknown error");
    return apiError("DATABASE_UNAVAILABLE", "Your saved plans are unavailable right now. Please try again later.");
  }
}

export async function POST(request: Request) {
  const access = await identityOrError();
  if (access.response) {
    return access.response;
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return apiError("VALIDATION_FAILED", "The plan request could not be read.");
  }
  if (Buffer.byteLength(text, "utf8") > MAX_BODY) {
    return apiError("PAYLOAD_TOO_LARGE", "This plan is too large to save.");
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return apiError("VALIDATION_FAILED", "The plan request is not valid.");
  }
  const body = saveSchema.safeParse(value);
  if (!body.success) {
    return validationError(body.error, "Send a meal request and chosen option.");
  }
  const identity = access.identity!;
  // Reuse D's schema so restored plans remain compatible with cooking mode.
  const candidate = { id: "pending", userId: identity.sub, request: body.data.request, chosen: body.data.chosen, status: "shopping", progress: {}, createdAt: new Date().toISOString() };
  let plan: MealPlan;
  try {
    plan = parseCurrentPlan(JSON.stringify(candidate))!;
  } catch {
    return apiError("VALIDATION_FAILED", "This plan could not be saved. Please choose it again.");
  }
  if (plan.chosen.shoppingList.some((item) => item.bought)) {
    return apiError("VALIDATION_FAILED", "A new plan starts with nothing bought.");
  }
  if (localDemo()) {
    return Response.json({ plan: null, mode: "demo" }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    assertDatabaseConfigured();
    const result = await db.query(
      `insert into meal_plans (user_id, request, chosen, status, progress)
       select u.id, $2::jsonb, $3::jsonb, 'shopping', '{}'::jsonb from users u where u.auth0_id = $1
       returning ${PLAN_COLUMNS}`,
      [identity.sub, JSON.stringify(plan.request), JSON.stringify(plan.chosen)],
    );
    if (!result.rows[0]) {
      return apiError("CONFLICT", "Finish setting up your kitchen before saving a plan.");
    }
    return Response.json({ plan: planFromRow(result.rows[0], identity.sub), mode: "database" }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("POST /api/meal-plans failed", error instanceof Error ? error.name : "Unknown error");
    return apiError("DATABASE_UNAVAILABLE", "Your plan could not be saved to your account right now.");
  }
}
