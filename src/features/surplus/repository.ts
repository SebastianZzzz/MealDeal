import type { SurplusListing } from "../../types";
import type { Database } from "../community/database";
import type { ListingDraft } from "./inventory";

function listingFromRow(row: Record<string, unknown>): SurplusListing {
  const iso = (value: unknown) => new Date(value instanceof Date ? value.getTime() : String(value)).toISOString();
  return {
    id: String(row.id), merchantName: String(row.merchant_name), address: String(row.address),
    lat: Number(row.lat), lng: Number(row.lng), title: String(row.title),
    origPrice: Number(row.orig_price), price: Number(row.price), qtyLeft: Number(row.qty_left),
    pickupStart: iso(row.pickup_start), pickupEnd: iso(row.pickup_end),
    allergens: row.allergens as string[], description: row.description == null ? undefined : String(row.description),
    isSample: Boolean(row.is_sample), createdAt: iso(row.created_at),
  };
}

export function createSurplusRepository(db: Database) {
  return {
    async list(): Promise<SurplusListing[]> {
      const { rows } = await db.query("SELECT * FROM surplus_listings WHERE pickup_end > clock_timestamp() ORDER BY price, pickup_end LIMIT 200", []);
      return rows.map(listingFromRow);
    },
    async post(draft: ListingDraft, id: string, auth0Id: string): Promise<SurplusListing> {
      const { rows } = await db.query(`INSERT INTO surplus_listings
        (id, merchant_name, address, lat, lng, title, orig_price, price, qty_left,
         pickup_start, pickup_end, allergens, description, is_sample, posted_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,$14) RETURNING *`,
      [id, draft.merchantName, draft.address, draft.lat, draft.lng, draft.title, draft.origPrice, draft.price,
        draft.qtyLeft, draft.pickupStart, draft.pickupEnd, draft.allergens, draft.description ?? null, auth0Id]);
      if (!rows[0]) throw new Error("The listing was not saved.");
      return listingFromRow(rows[0]);
    },
    async reserve(id: string): Promise<SurplusListing | null> {
      // One conditional UPDATE is the atomic reservation. No read-then-write race.
      const { rows } = await db.query(`UPDATE surplus_listings SET qty_left = qty_left - 1
        WHERE id = $1 AND qty_left > 0 AND pickup_end > clock_timestamp() RETURNING *`, [id]);
      return rows[0] ? listingFromRow(rows[0]) : null;
    },
  };
}

export type SurplusRepository = ReturnType<typeof createSurplusRepository>;
