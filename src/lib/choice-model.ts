import { classifyCustomChoice, formatProblem, notRecognized, type ChoiceKind } from "./custom-choices";

// Server-side gate for free-text choices. Local format and vocabulary first; only unknown but
// well-formed words go to the smallest available model, which answers YES or NO. If the model can't
// answer, the word is rejected for now (fail closed): an outage or flood can delay an unusual entry,
// never let one through.
const MODELS = (process.env.GEMINI_CHECK_MODELS ?? "gemini-3.1-flash-lite,gemini-3.5-flash-lite").split(",").map((model) => model.trim()).filter(Boolean);

const QUESTION: Record<ChoiceKind, string> = {
  allergy: "a food, ingredient or food allergen that a person might need to avoid",
  pantry: "a food, ingredient, seasoning or cooking staple someone could keep at home",
  dietary: "a diet, eating pattern, or a food a person avoids for health, religion or ethics",
  equipment: "a kitchen appliance, cookware or cooking tool",
  goal: "a nutrition or eating goal",
};

// Answers are stable, so each word is asked once per server instance.
const verdicts = new Map<string, boolean>();

async function askModel(kind: ChoiceKind, text: string): Promise<boolean | null> {
  const key = `${kind}:${text.toLowerCase()}`;
  if (verdicts.has(key)) return verdicts.get(key)!;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  // The word is quoted data; the model only answers the fixed question about it.
  const prompt = `Is the quoted text ${QUESTION[kind]}? Answer with exactly one word: YES or NO.\nText: "${text.replace(/"/g, "")}"`;
  for (const model of MODELS) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", signal: AbortSignal.timeout(4000),
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 8, thinkingConfig: { thinkingLevel: "minimal" } },
        }),
      });
      if (!response.ok) continue;
      const body = await response.json();
      const answer = String(body.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim().toUpperCase();
      if (answer.startsWith("YES") || answer.startsWith("NO")) {
        verdicts.set(key, answer.startsWith("YES"));
        return answer.startsWith("YES");
      }
    } catch {
      // Try the next model.
    }
  }
  return null;
}

export type ChoiceCheck = { ok: true } | { ok: false; message: string; retry: boolean };

export async function checkChoice(kind: ChoiceKind, raw: string): Promise<ChoiceCheck> {
  const text = raw.trim().replace(/\s+/g, " ");
  const verdict = classifyCustomChoice(kind, text);
  if (verdict === "bad-format") return { ok: false, message: formatProblem(kind), retry: false };
  if (verdict === "ok") return { ok: true };
  const answer = await askModel(kind, text);
  if (answer === true) return { ok: true };
  if (answer === false) return { ok: false, message: notRecognized(kind, text), retry: false };
  return { ok: false, message: `We couldn't check "${text}" right now. Try again in a minute, or pick from the list.`, retry: true };
}

/** First problem among a list of entries, with its index, or null when every entry is usable. */
export async function firstChoiceProblem(kind: ChoiceKind, values: string[]): Promise<{ index: number; check: Extract<ChoiceCheck, { ok: false }> } | null> {
  for (const [index, value] of values.entries()) {
    const check = await checkChoice(kind, value);
    if (!check.ok) return { index, check };
  }
  return null;
}

// A small per-user budget for the check endpoint (per server instance).
const recent = new Map<string, number[]>();
export function allowCheck(user: string, perMinute = 20): boolean {
  const now = Date.now();
  const calls = (recent.get(user) ?? []).filter((at) => now - at < 60_000);
  if (calls.length >= perMinute) return false;
  calls.push(now);
  recent.set(user, calls);
  return true;
}
