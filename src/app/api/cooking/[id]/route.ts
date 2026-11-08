import { cookingHandlers } from "@/features/community/server-runtime";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  return cookingHandlers.get((await context.params).id);
}
export async function PATCH(request: Request, context: Context) {
  return cookingHandlers.patch(request, (await context.params).id);
}
