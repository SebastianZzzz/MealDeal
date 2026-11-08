import "server-only";

import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  mealDealDbPool?: Pool;
};

function normalizedConnectionString() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  const url = new URL(raw);
  // `pg` lets sslmode in the URL override the explicit SSL object. Tiger Data
  // uses a certificate chain that is not available in every local trust store,
  // so keep transport encryption enabled and configure verification here.
  url.searchParams.delete("sslmode");
  return url.toString();
}

export const db =
  globalForDb.mealDealDbPool ??
  new Pool({
    connectionString: normalizedConnectionString(),
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.mealDealDbPool = db;
}

export function assertDatabaseConfigured() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
}
