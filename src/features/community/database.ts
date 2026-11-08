/** D's minimal query boundary. A owns the shared pool in src/lib/db.ts. */
export interface Database {
  query(sql: string, parameters: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export class UpdateConflict extends Error {}

/**
 * Replace this function body with A's database adapter once its export exists.
 * Example: return { query: (sql, parameters) => pool.query(sql, parameters) };
 * No credentials, connections, global mock database, or fallback writes live here.
 */
export async function getDDatabase(): Promise<Database | null> {
  return null;
}
