import { z } from "zod";

// One Gemini call with structured output, tried across several models in order.
// Moves on when a model is missing, out of quota, overloaded or unreachable.

// Cheap models first: on the free tier Flash-Lite allows 500 requests/day, Flash only 20.
// Both Lite models read real flyer snippets correctly in ~1 s. Override with GEMINI_TAG_MODELS="a,b,c".
const DEFAULT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash"];
const RETRYABLE = new Set([404, 429, 500, 503]);

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function catalogModels(): string[] {
  const configured = process.env.GEMINI_TAG_MODELS?.split(",").map((m) => m.trim()).filter(Boolean);
  const models = configured?.length ? configured : DEFAULT_MODELS;
  return models.filter((m) => /^[a-zA-Z0-9.-]+$/.test(m));
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function generateJson<T extends z.ZodType>(
  parts: Part[],
  schema: T,
  options: { timeoutMs?: number } = {},
): Promise<z.infer<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError("Gemini is not configured (missing GEMINI_API_KEY).", 503);
  const models = catalogModels();
  if (models.length === 0) throw new GeminiError("Invalid GEMINI_TAG_MODELS configuration.", 503);

  const request = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(schema, { unrepresentable: "any" }),
      temperature: 0,
    },
  });

  let response: Response | undefined;
  for (const model of models) {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: request,
    }).catch(() => undefined);
    if (response && !RETRYABLE.has(response.status)) break;
  }
  if (!response) throw new GeminiError("Could not reach Gemini.", 502);
  // Never forward provider bodies: they can echo request data.
  if (!response.ok) throw new GeminiError(`Gemini request failed (${response.status}).`, 502);

  const body = await response.json();
  const text: string | undefined = body.candidates?.[0]?.content?.parts
    ?.filter((part: { text?: string; thought?: boolean }) => part.text && !part.thought)
    .map((part: { text: string }) => part.text)
    .join("");
  if (!text) throw new GeminiError("Gemini returned nothing.", 502);
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    throw new GeminiError("Gemini returned data in an unexpected shape.", 502);
  }
}
