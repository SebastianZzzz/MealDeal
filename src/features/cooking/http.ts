import type { CookingRepository } from "./repository";
import { apiError } from "@/lib/api-error";
import { isDatabaseId, UpdateConflict } from "../community/database";
import { invalidJson, json, readJson, unavailable } from "../community/http";
import { storageError } from "../community/server-error";

export function createCookingHandlers(deps: {
  identity: () => Promise<{ sub: string } | null>;
  repository: () => Promise<CookingRepository | null>;
}) {
  async function access(id: string) {
    const user = await deps.identity();
    if (!user) return { response: apiError("UNAUTHORIZED", "Please sign in to sync cooking progress.") };
    if (!isDatabaseId(id)) return { response: apiError("VALIDATION_FAILED", "This plan is local only. Open a plan saved to your account before syncing.", { id: "Open a plan saved to your account." }) };
    const repository = await deps.repository();
    return repository ? { user, repository } : { response: unavailable() };
  }
  return {
    async get(id: string) {
      try {
        const result = await access(id);
        if (result.response) return result.response;
        const plan = await result.repository!.get(id, result.user!.sub);
        return plan ? json({ plan }) : apiError("NOT_FOUND", "This plan is not saved to your account yet.");
      } catch (cause) { return storageError(cause, "Account progress could not be loaded. Try again later."); }
    },
    async patch(request: Request, id: string) {
      try {
        const user = await deps.identity();
        if (!user) return apiError("UNAUTHORIZED", "Please sign in to sync cooking progress.");
        let value: unknown;
        try { value = await readJson(request); }
        catch (cause) { return invalidJson(cause, "Send valid JSON cooking progress."); }
        const body = value as { progress?: unknown } | null;
        if (!body || typeof body !== "object" || Object.keys(body).some((key) => key !== "progress")
          || !body.progress || typeof body.progress !== "object" || Array.isArray(body.progress)) return apiError("VALIDATION_FAILED", "Send only a progress object.", { progress: "Send recipe IDs and their current step numbers." });
        const entries = Object.entries(body.progress);
        if (!entries.length || entries.length > 100 || entries.some(([key, index]) => !key || key.length > 200 || !Number.isInteger(index) || Number(index) < 1)) {
          return apiError("VALIDATION_FAILED", "Invalid recipe progress.", { progress: "Use positive whole step numbers for each recipe." });
        }
        if (!isDatabaseId(id)) return apiError("VALIDATION_FAILED", "This plan is local only. Open a plan saved to your account before syncing.", { id: "Open a plan saved to your account." });
        const repository = await deps.repository();
        if (!repository) return unavailable();
        const plan = await repository.save(id, user.sub, body.progress as Record<string, number>);
        return plan ? json({ plan }) : apiError("NOT_FOUND", "This plan is not saved to your account yet.");
      } catch (cause) {
        return cause instanceof UpdateConflict ? apiError("CONFLICT", cause.message)
          : storageError(cause, "Cooking progress could not be saved to your account. Try again later.");
      }
    },
  };
}
