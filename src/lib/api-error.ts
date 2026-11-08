import type { ApiError, ApiErrorCode } from "@/types";

// Shared error responses (server) and error parsing (browser). No Next.js imports, so both sides can use it.

export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE: 422,
  INTERNAL: 500,
  UPSTREAM_FAILED: 502,
  SERVICE_UNAVAILABLE: 503,
  DATABASE_UNAVAILABLE: 503,
};

export function apiError(code: ApiErrorCode, message: string, fields?: Record<string, string>): Response {
  const body: ApiError = fields && Object.keys(fields).length ? { error: message, code, fields } : { error: message, code };
  return Response.json(body, { status: API_ERROR_STATUS[code], headers: { "Cache-Control": "no-store" } });
}

// Zod issues -> { "units.weight": "Invalid option" }. Keeps the first message per field.
export function fieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

export function validationError(error: { issues: { path: PropertyKey[]; message: string }[] }, message = "Some fields need fixing."): Response {
  return apiError("VALIDATION_FAILED", message, fieldErrors(error));
}

const FALLBACK: Record<number, string> = {
  400: "Some fields need fixing.",
  401: "Please log in and try again.",
  403: "You don't have access to this.",
  404: "Not found.",
  409: "This changed in the meantime. Reload and try again.",
  413: "That upload is too large.",
  422: "We couldn't use that. Check it and try again.",
  502: "A service we depend on failed. Try again.",
  503: "This is unavailable right now. Try again later.",
};

// Browser side: turn any failed response into an ApiError, even if the body is missing or old-style.
export async function readApiError(response: Response): Promise<ApiError> {
  const fallback = FALLBACK[response.status] ?? "Something went wrong. Try again.";
  const codeFor = (status: number): ApiErrorCode =>
    (Object.entries(API_ERROR_STATUS).find(([, s]) => s === status)?.[0] as ApiErrorCode) ?? "INTERNAL";
  try {
    const body = (await response.json()) as Partial<ApiError> & { error?: unknown };
    return {
      error: typeof body.error === "string" && body.error ? body.error : fallback,
      code: body.code ?? codeFor(response.status),
      ...(body.fields ? { fields: body.fields } : {}),
    };
  } catch {
    return { error: fallback, code: codeFor(response.status) };
  }
}
