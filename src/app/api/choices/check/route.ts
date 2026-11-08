import { z } from "zod";
import { apiError, validationError } from "@/lib/api-error";
import { getIdentity } from "@/lib/session";
import { allowCheck, checkChoice } from "@/lib/choice-model";

const schema = z.object({ kind: z.enum(["dietary", "allergy", "equipment", "goal", "pantry"]), value: z.string().max(60) });

// POST /api/choices/check { kind, value } -> { ok, message?, retry? }
// Instant feedback for the "Other" inputs. The same check runs again when the profile is saved and
// when a plan is requested, so skipping this endpoint gains nothing.
export async function POST(request: Request) {
  const identity = await getIdentity();
  if (!identity?.sub) return apiError("UNAUTHORIZED", "Please log in to edit your kitchen.");
  if (!allowCheck(identity.sub)) return apiError("SERVICE_UNAVAILABLE", "Too many checks in a row. Wait a minute and try again.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  return Response.json(await checkChoice(parsed.data.kind, parsed.data.value));
}
