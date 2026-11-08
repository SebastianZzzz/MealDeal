/** D's minimal query boundary. A owns the shared pool in src/lib/db.ts. */
export interface Database {
  query(sql: string, parameters: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export class UpdateConflict extends Error {}

/** Reuse A's server-only pool. Missing configuration never falls back to writes. */
export async function getDDatabase(): Promise<Database | null> {
  if (!process.env.DATABASE_URL) return null;
  const { assertDatabaseConfigured, db } = await import("@/lib/db");
  assertDatabaseConfigured();
  return { query: (sql, parameters) => db.query(sql, parameters) };
}

/** Cooking plans use UUIDs; the surplus table deliberately uses text IDs. */
export const isDatabaseId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const isListingId = (id: string) => id.trim().length > 0 && id.length <= 200;
