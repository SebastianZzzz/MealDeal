import type { CookingRepository } from "./repository";
import { isDatabaseId, UpdateConflict } from "../community/database";
import { json, readJson, unavailable } from "../community/http";

export function createCookingHandlers(deps: {
  identity: () => Promise<{ sub: string } | null>;
  repository: () => Promise<CookingRepository | null>;
}) {
  async function access(id: string) {
    const user = await deps.identity();
    if (!user) return { response: json({ error: "Please sign in to sync cooking progress." }, 401) };
    if (!isDatabaseId(id)) return { response: json({ error: "This plan is local only. Open a plan saved to your account before syncing." }, 400) };
    const repository = await deps.repository();
    return repository ? { user, repository } : { response: unavailable() };
  }
  return {
    async get(id: string) {
      try {
        const result = await access(id);
        if (result.response) return result.response;
        const plan = await result.repository!.get(id, result.user!.sub);
        return plan ? json({ plan }) : json({ error: "This plan is not saved to your account yet." }, 404);
      } catch { return json({ error: "Account progress could not be loaded." }, 503); }
    },
    async patch(request: Request, id: string) {
      try {
        const user = await deps.identity();
        if (!user) return json({ error: "Please sign in to sync cooking progress." }, 401);
        let value: unknown;
        try { value = await readJson(request); }
        catch { return json({ error: "Send valid JSON cooking progress." }, 400); }
        const body = value as { progress?: unknown } | null;
        if (!body || typeof body !== "object" || Object.keys(body).some((key) => key !== "progress")
          || !body.progress || typeof body.progress !== "object" || Array.isArray(body.progress)) return json({ error: "Send only a progress object." }, 400);
        const entries = Object.entries(body.progress);
        if (!entries.length || entries.length > 100 || entries.some(([key, index]) => !key || key.length > 200 || !Number.isInteger(index) || Number(index) < 1)) {
          return json({ error: "Invalid recipe progress." }, 400);
        }
        if (!isDatabaseId(id)) return json({ error: "This plan is local only. Open a plan saved to your account before syncing." }, 400);
        const repository = await deps.repository();
        if (!repository) return unavailable();
        const plan = await repository.save(id, user.sub, body.progress as Record<string, number>);
        return plan ? json({ plan }) : json({ error: "This plan is not saved to your account yet." }, 404);
      } catch (cause) {
        return cause instanceof UpdateConflict ? json({ error: cause.message }, 409)
          : json({ error: "Cooking progress could not be saved to your account." }, 503);
      }
    },
  };
}
