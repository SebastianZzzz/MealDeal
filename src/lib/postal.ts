// Canadian postal codes: letter-digit-letter digit-letter-digit, with the letters Canada Post uses.
export const POSTAL_CODE = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

/** "v6t1z4" -> "V6T 1Z4" */
export function normalizePostal(code: string): string {
  const compact = code.replace(/\s+/g, "").toUpperCase();
  return compact.length > 3 ? `${compact.slice(0, 3)} ${compact.slice(3)}` : compact;
}
