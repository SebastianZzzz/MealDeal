import type { PoolClient } from "pg";
import { z } from "zod";
import { assertDatabaseConfigured, db } from "@/lib/db";
import { getIdentity } from "@/lib/session";
import { apiError, validationError } from "@/lib/api-error";

export const runtime = "nodejs";

const pantrySchema = z.array(z.object({
  name: z.string().trim().min(1).max(100),
  foodId: z.string().uuid().nullable().optional(),
  qtyG: z.number().min(0).max(100000),
})).max(100);

function isConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string" && error.code.startsWith("23");
}

export async function GET() {
  const identity = await getIdentity();
  if (!identity?.sub) return apiError("UNAUTHORIZED", "Please log in to view your pantry.");
  if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) {
    return Response.json({ items: [], mode: "demo" });
  }
  try {
    assertDatabaseConfigured();
    const result = await db.query(
      `select p.id, p.name, p.food_id, p.qty_g, p.updated_at
       from pantry_items p
       join users u on u.id = p.user_id
       where u.auth0_id = $1
       order by p.name`,
      [identity.sub],
    );
    return Response.json({
      items: result.rows.map((item) => ({
        id: item.id,
        name: item.name,
        foodId: item.food_id,
        qtyG: Number(item.qty_g),
        updatedAt: new Date(item.updated_at).toISOString(),
      })),
      mode: "database",
    });
  } catch (error) {
    console.error("GET /api/pantry failed", error instanceof Error ? error.message : "Unknown error");
    return apiError("DATABASE_UNAVAILABLE", "Your pantry is unavailable right now. Please try again later.");
  }
}

export async function PUT(request: Request) {
  const identity = await getIdentity();
  if (!identity?.sub) return apiError("UNAUTHORIZED", "Please log in to save your pantry.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_FAILED", "The pantry request is not valid.");
  }
  const parsed = pantrySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) {
    return Response.json({ items: parsed.data, mode: "demo" });
  }
  let client: PoolClient | undefined;
  let transactionOpen = false;
  try {
    assertDatabaseConfigured();
    client = await db.connect();
    await client.query("begin");
    transactionOpen = true;
    const userResult = await client.query("select id from users where auth0_id = $1 limit 1", [identity.sub]);
    const userId = userResult.rows[0]?.id as string | undefined;
    if (!userId) {
      await client.query("rollback");
      transactionOpen = false;
      return apiError("CONFLICT", "Complete your profile before saving pantry items.");
    }

    await client.query("delete from pantry_items where user_id = $1", [userId]);
    const savedItems = [];
    for (const item of parsed.data) {
      const result = await client.query(
        `insert into pantry_items (user_id, name, food_id, qty_g)
         values ($1, $2, $3, $4)
         returning id, name, food_id, qty_g, updated_at`,
        [userId, item.name, item.foodId ?? null, item.qtyG],
      );
      const saved = result.rows[0];
      savedItems.push({
        id: saved.id,
        name: saved.name,
        foodId: saved.food_id,
        qtyG: Number(saved.qty_g),
        updatedAt: new Date(saved.updated_at).toISOString(),
      });
    }
    await client.query("commit");
    transactionOpen = false;
    return Response.json({ items: savedItems, mode: "database" });
  } catch (error) {
    if (client && transactionOpen) await client.query("rollback");
    console.error("PUT /api/pantry failed", error instanceof Error ? error.message : "Unknown error");
    if (isConstraintError(error)) {
      return apiError("CONFLICT", "One or more pantry items conflict with saved data. Please review them and try again.");
    }
    return apiError("DATABASE_UNAVAILABLE", "Your pantry could not be saved because the database is unavailable.");
  } finally {
    client?.release();
  }
}
