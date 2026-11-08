import type { SurplusRepository } from "../surplus/repository";
import { apiError, validationError } from "@/lib/api-error";
import { listingDraftSchema } from "../surplus/draft-schema";
import { isListingId } from "./database";
import { storageError } from "./server-error";

export interface ApiDependencies {
  identity: () => Promise<{ sub: string } | null>;
  surplus: () => Promise<SurplusRepository | null>;
  id: () => string;
  now: () => number;
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export const unavailable = () => apiError("DATABASE_UNAVAILABLE", "Shared storage is not connected yet. The local demo is still available.");

class JsonBodyTooLarge extends Error {}

export function invalidJson(cause: unknown, message: string): Response {
  return cause instanceof JsonBodyTooLarge ? apiError("PAYLOAD_TOO_LARGE", "This request is too large. Shorten it and try again.")
    : apiError("VALIDATION_FAILED", message);
}

export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 32_768) throw new JsonBodyTooLarge("Request is too large.");
  return JSON.parse(text);
}

export function createSurplusHandlers(deps: ApiDependencies) {
  return {
    async list() {
      try {
        const repository = await deps.surplus();
        return repository ? json({ items: await repository.list(), mode: "database" }) : unavailable();
      } catch (cause) { return storageError(cause, "Shared listings could not be loaded. Try again later."); }
    },
    async post(request: Request) {
      try {
        const user = await deps.identity();
        if (!user) return apiError("UNAUTHORIZED", "Please sign in before posting.");
        let draft: unknown;
        try { draft = await readJson(request); }
        catch (cause) { return invalidJson(cause, "Send a valid JSON listing."); }
        const parsed = listingDraftSchema(deps.now()).safeParse(draft);
        if (!parsed.success) return validationError(parsed.error, "Check the highlighted listing fields.");
        const repository = await deps.surplus();
        if (!repository) return unavailable();
        // Never accept a client-supplied identity, ID, or sample/verification claim.
        const clean = { ...parsed.data, merchantName: parsed.data.merchantName.trim(), address: parsed.data.address.trim(), title: parsed.data.title.trim() };
        return json({ listing: await repository.post(clean, deps.id(), user.sub) }, 201);
      } catch (cause) { return storageError(cause, "The listing could not be saved. Please try again."); }
    },
    async reserve(id: string) {
      try {
        if (!await deps.identity()) return apiError("UNAUTHORIZED", "Please sign in before reserving.");
        if (!isListingId(id)) return apiError("VALIDATION_FAILED", "Invalid listing ID.", { id: "Choose a valid listing." });
        const repository = await deps.surplus();
        if (!repository) return unavailable();
        const listing = await repository.reserve(id);
        return listing ? json({ listing, reserved: 1, isSample: listing.isSample })
          : apiError("CONFLICT", "This listing is sold out, expired, or no longer available.");
      } catch (cause) { return storageError(cause, "Reservation could not be confirmed. Refresh before trying again."); }
    },
  };
}
