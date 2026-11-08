import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { z } from "zod";
import { assertDatabaseConfigured, db } from "@/lib/db";
import { getIdentity } from "@/lib/session";

export const runtime = "nodejs";

const pantrySchema = z.array(z.object({
  name: z.string().trim().min(1).max(100),
  foodId: z.string().uuid().nullable().optional(),
  qtyG: z.number().min(0).max(100000),
})).max(100);

export async function GET() {
  const identity = await getIdentity();
  if (!identity?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) {
    return NextResponse.json({ items: [], mode: "demo" });
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
    return NextResponse.json({
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
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const identity = await getIdentity();
  if (!identity?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = pantrySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL) {
    return NextResponse.json({ items: parsed.data, mode: "demo" });
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
      return NextResponse.json({ error: "Complete profile first" }, { status: 409 });
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
    return NextResponse.json({ items: savedItems, mode: "database" });
  } catch (error) {
    if (client && transactionOpen) await client.query("rollback");
    console.error("PUT /api/pantry failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  } finally {
    client?.release();
  }
}
