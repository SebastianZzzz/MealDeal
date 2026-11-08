import type { SurplusRepository } from "../surplus/repository";
import { validDraft } from "../surplus/inventory";
import { isListingId } from "./database";

export interface ApiDependencies {
  identity: () => Promise<{ sub: string } | null>;
  surplus: () => Promise<SurplusRepository | null>;
  id: () => string;
  now: () => number;
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export const unavailable = () => json({ error: "Shared storage is not connected yet. The local demo is still available.", code: "DATABASE_UNAVAILABLE" }, 503);

export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 32_768) throw new Error("Request is too large.");
  return JSON.parse(text);
}

export function createSurplusHandlers(deps: ApiDependencies) {
  return {
    async list() {
      try {
        const repository = await deps.surplus();
        return repository ? json({ items: await repository.list(), mode: "database" }) : unavailable();
      } catch { return json({ error: "Shared listings could not be loaded." }, 503); }
    },
    async post(request: Request) {
      try {
        const user = await deps.identity();
        if (!user) return json({ error: "Please sign in before posting." }, 401);
        let draft: unknown;
        try { draft = await readJson(request); }
        catch { return json({ error: "Send a valid JSON listing." }, 400); }
        if (!validDraft(draft) || draft.qtyLeft < 1 || Date.parse(draft.pickupEnd) <= deps.now()) return json({ error: "Check prices, quantity, location and pickup times." }, 400);
        const repository = await deps.surplus();
        if (!repository) return unavailable();
        // Never accept a client-supplied identity, ID, or sample/verification claim.
        const clean = {
          merchantName: draft.merchantName.trim(), address: draft.address.trim(), title: draft.title.trim(),
          lat: draft.lat, lng: draft.lng, origPrice: draft.origPrice, price: draft.price, qtyLeft: draft.qtyLeft,
          pickupStart: draft.pickupStart, pickupEnd: draft.pickupEnd, allergens: draft.allergens,
          description: draft.description,
        };
        return json({ listing: await repository.post(clean, deps.id(), user.sub) }, 201);
      } catch { return json({ error: "The listing could not be saved. Please try again." }, 503); }
    },
    async reserve(id: string) {
      try {
        if (!await deps.identity()) return json({ error: "Please sign in before reserving." }, 401);
        if (!isListingId(id)) return json({ error: "Invalid listing ID." }, 400);
        const repository = await deps.surplus();
        if (!repository) return unavailable();
        const listing = await repository.reserve(id);
        return listing ? json({ listing, reserved: 1, isSample: listing.isSample })
          : json({ error: "This listing is sold out, expired, or no longer available." }, 409);
      } catch { return json({ error: "Reservation could not be confirmed. Refresh before trying again." }, 503); }
    },
  };
}
