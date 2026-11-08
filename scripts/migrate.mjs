import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const rawUrl = process.env.DATABASE_URL;

if (!rawUrl) {
  throw new Error("DATABASE_URL is required");
}

const url = new URL(rawUrl);
url.searchParams.delete("sslmode");

const client = new Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
});

const migrationsDir = path.join(process.cwd(), "db", "migrations");

try {
  await client.connect();
  await client.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const filename of files) {
    const alreadyApplied = await client.query(
      "select 1 from schema_migrations where filename = $1",
      [filename],
    );
    if (alreadyApplied.rowCount) {
      console.log(`skip ${filename}`);
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, filename), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into schema_migrations (filename) values ($1)",
        [filename],
      );
      await client.query("commit");
      console.log(`applied ${filename}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}
