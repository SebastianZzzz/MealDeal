/** D's minimal query boundary. A owns the shared pool in src/lib/db.ts. */
export interface Database {
  query(sql: string, parameters: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export class UpdateConflict extends Error {}

export async function getDDatabase(): Promise<Database | null> {
  if (!process.env.DATABASE_URL) return null;
  const { db } = await import("@/lib/db");
  return {
    query: async (sql, parameters) => {
      const result = await db.query(sql, parameters);
      return { rows: result.rows as Record<string, unknown>[] };
    },
  };
}
