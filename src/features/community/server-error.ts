import { apiError } from "@/lib/api-error";

/** Keep technical failures in server logs and return the shared public contract. */
export function storageError(cause: unknown, message: string): Response {
  console.error("D storage operation failed", cause);
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  if (code === "23505") return apiError("CONFLICT", "This item already exists. Refresh before trying again.");
  if (code.startsWith("23") || code.startsWith("22")) {
    return apiError("VALIDATION_FAILED", "Some saved values are invalid. Check your inputs and try again.");
  }
  if (/^(08|28|53|57)/.test(code) || ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "ERR_INVALID_URL"].includes(code)) {
    return apiError("DATABASE_UNAVAILABLE", message);
  }
  return apiError("INTERNAL", message);
}
