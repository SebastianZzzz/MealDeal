import { surplusHandlers } from "@/features/community/server-runtime";

export const runtime = "nodejs";
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return surplusHandlers.reserve(id);
}
