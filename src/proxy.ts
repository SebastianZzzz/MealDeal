import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAuth0Configured } from "@/lib/env";

export async function proxy(request: NextRequest) {
  if (!isAuth0Configured()) return NextResponse.next();
  const { auth0 } = await import("@/lib/auth0");
  return auth0.middleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
