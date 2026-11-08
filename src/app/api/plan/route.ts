import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/session";
import { planInputSchema } from "@/features/planning/schema";
import { generatePlan, PlanningError } from "@/features/planning/service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const identity = await getIdentity();
  if (!identity?.sub) {
    return NextResponse.json({ error: "Please sign in before planning." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON planning request." }, { status: 400 });
  }
  const parsed = planInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check your meal details and kitchen profile.", issues: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(await generatePlan(parsed.data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PlanningError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Planning failed:", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "The product catalog is unavailable. Please try again later." }, { status: 503 });
  }
}
