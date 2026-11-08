import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/session";
import { planInputSchema } from "@/features/planning/schema";
import { generatePlan, PlanningError } from "@/features/planning/service";
import { apiError, validationError } from "@/lib/api-error";
import { firstChoiceProblem } from "@/lib/choice-model";
import type { ApiErrorCode } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function planningErrorCode(status: number): ApiErrorCode {
  switch (status) {
    case 422:
      return "UNPROCESSABLE";
    case 502:
      return "UPSTREAM_FAILED";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return "INTERNAL";
  }
}

export async function POST(request: Request) {
  let identity;
  try {
    identity = await getIdentity();
  } catch {
    return apiError("SERVICE_UNAVAILABLE", "Sign-in is unavailable right now. Please try again later.");
  }
  if (!identity?.sub) {
    return apiError("UNAUTHORIZED", "Please sign in before planning.");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_FAILED", "Send a valid JSON planning request.");
  }
  const parsed = planInputSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error, "Check your meal details and kitchen profile.");
  }
  // The profile comes from the browser, so diet and allergy entries are checked again before they
  // can reach the prompt.
  for (const [field, kind] of [["dietary", "dietary"], ["allergies", "allergy"]] as const) {
    const problem = await firstChoiceProblem(kind, parsed.data.profile[field]);
    if (problem) {
      return apiError(problem.check.retry ? "SERVICE_UNAVAILABLE" : "VALIDATION_FAILED", problem.check.message, { [`profile.${field}.${problem.index}`]: problem.check.message });
    }
  }
  try {
    return NextResponse.json(await generatePlan(parsed.data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PlanningError) {
      return apiError(planningErrorCode(error.status), error.message);
    }
    console.error("Planning failed:", error instanceof Error ? error.name : "Unknown error");
    return apiError("DATABASE_UNAVAILABLE", "The product catalog is unavailable. Please try again later.");
  }
}
