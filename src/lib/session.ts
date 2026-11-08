import { isAuth0Configured } from "@/lib/env";

export async function getIdentity() {
  if (!isAuth0Configured()) return null;
  const { auth0 } = await import("@/lib/auth0");
  const session = await auth0.getSession();
  return session?.user ?? null;
}
