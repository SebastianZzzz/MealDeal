import type { ApiError } from "@/types";
import { readApiError } from "@/lib/api-error";

/** Preserve the shared error and field hints through feature client functions. */
export class ApiRequestError extends Error {
  readonly code: ApiError["code"];
  readonly fields: ApiError["fields"];

  constructor(error: ApiError) {
    super(error.error);
    this.name = "ApiRequestError";
    this.code = error.code;
    this.fields = error.fields;
  }
}

export async function requireOk(response: Response): Promise<void> {
  if (!response.ok) throw new ApiRequestError(await readApiError(response));
}
