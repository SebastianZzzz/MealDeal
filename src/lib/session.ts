import { isAuth0Configured } from "@/lib/env";

export async function getIdentity() {
  if (!isAuth0Configured()) {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "0") return null;
    return { sub: "demo|student", name: "Demo Student", email: "demo@mealdeal.local" };
  }
  const { auth0 } = await import("@/lib/auth0");
  const session = await auth0.getSession();
  return session?.user ?? null;
}
