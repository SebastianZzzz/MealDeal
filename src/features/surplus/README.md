# Simplified Eat Out (D)

## Local demo

- `/eat-out` browses listings by price or straight-line distance after an explicit
  user request for location. Denied location leaves price browsing available.
- `/eat-out/post` publishes a sample listing without merchant sign-in.
- `mock/surplus-listings.json` contains three fictional merchants. Their initial
  pickup windows are derived from first initialization and then persisted.
- The shared `SurplusListing` type is imported from `@/types` unchanged.
- Every locally posted listing is forced to `isSample: true`; seed and posted
  sample listings are labeled. Reservations explicitly state that no real food
  is held. Prices are CAD. Pickup windows display in Vancouver time.
- There is no payment, reservation roster, image storage, or real merchant
  account. No database or process-global pretend persistence is introduced.

## Inventory guarantee

Inventory lives under `mealdeal.surplus.v1` in localStorage. Initialization,
posting, and reservation all acquire the same exclusive Web Lock. Inside the
lock, reservation reads the latest inventory, rejects missing/expired/sold-out
listings, checks `qtyLeft > 0`, decrements exactly once, and persists before
returning success. Other tabs receive storage updates. Existing inventory is
never silently reseeded, including after corruption or sellout. A storage write
failure cannot produce a successful confirmation.

This is a cooperating-tabs guarantee within one browser origin, not shared
inventory across devices or users. Browsers without Web Locks can browse but
cannot post or reserve. Web Locks need a secure context (HTTPS or localhost).
Reference: https://www.w3.org/TR/web-locks/

## Shared service preview

`/eat-out/shared` and `/eat-out/shared/post` call `GET/POST /api/surplus`
and `POST /api/surplus/[id]/reserve`. Writes require Auth0. IDs are server-generated
UUIDs; client ownership/verification claims are ignored and new listings remain
labeled samples. A's table has no merchant ownership column.
The repository uses one parameterized conditional update with `qty_left > 0`
and an unexpired pickup window. Returning no row means 409, not success.

A supplies Tiger Data through `src/lib/db.ts`; D now reuses that pool. Missing
`DATABASE_URL` or a connection failure returns 503 without silently writing local
inventory. A's canonical migration owns the schema; `sql/d-surplus.sql` is a
matching reference, not another migration. Posting needs no `posted_by` field.
See [the backend handoff](../../../docs/D-BACKEND-HANDOFF.md).
The local demo guarantee and query tests do not prove database concurrency.

## Validation and checks

Posting validates bounded nonempty names/addresses, CAD prices with no more than
two decimals, surplus price no greater than original price, integral quantities,
valid coordinates, and a future pickup end after its start. JSX escapes user
text. Expired and sold-out offers cannot be reserved. Blank allergen information
is not described as allergen-free.

Run `inventory.test.mjs` with Node's TypeScript stripping, alongside the cooking
tests. Tests include 30 simultaneous reservations against one remaining portion,
expired offers, corrupted storage, failed writes, and invalid form values.
Manual checks: post, browse, reserve, refresh, two-tab final-portion race,
location denied, expired pickup, sold-out stock, and storage denied. API tests
also cover sign-in, validation, disconnected storage, server ownership and
conditional-update conflicts. Use [the acceptance checklist](../../../docs/D-ACCEPTANCE.md)
for the two-client database test after database configuration/migrations.
