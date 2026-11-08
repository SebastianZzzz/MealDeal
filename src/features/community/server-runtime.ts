import { randomUUID } from "node:crypto";
import { getIdentity } from "@/lib/session";
import { isAuth0Configured } from "@/lib/env";
import { getDDatabase } from "./database";
import { createSurplusRepository } from "../surplus/repository";
import { createSurplusHandlers } from "./http";
import { createCookingRepository } from "../cooking/repository";
import { createCookingHandlers } from "../cooking/http";

export async function verifiedIdentity(): Promise<{ sub: string } | null> {
  // The original scaffold supports a local demo identity. It is not cloud auth.
  if (!isAuth0Configured()) return null;
  const identity = await getIdentity();
  return identity?.sub ? { sub: identity.sub } : null;
}

export const surplusHandlers = createSurplusHandlers({
  identity: verifiedIdentity,
  surplus: async () => {
    const db = await getDDatabase();
    return db ? createSurplusRepository(db) : null;
  },
  id: randomUUID,
  now: Date.now,
});

export const cookingHandlers = createCookingHandlers({
  identity: verifiedIdentity,
  repository: async () => {
    const db = await getDDatabase();
    return db ? createCookingRepository(db) : null;
  },
});
