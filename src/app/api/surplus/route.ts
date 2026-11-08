import { surplusHandlers } from "@/features/community/server-runtime";

export const runtime = "nodejs";
export async function GET() { return surplusHandlers.list(); }
export async function POST(request: Request) { return surplusHandlers.post(request); }
