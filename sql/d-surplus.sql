-- D's proposed schema for A's Tiger Data/PostgreSQL adapter.
-- Reviewed source only: this migration has NOT been applied to any database.
-- Auth0 IDs are text. No merchant accounts, payments, images, or reservation roster.
CREATE TABLE IF NOT EXISTS surplus_listings (
  id text PRIMARY KEY,
  merchant_name text NOT NULL CHECK (length(merchant_name) BETWEEN 1 AND 100),
  address text NOT NULL CHECK (length(address) BETWEEN 1 AND 300),
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 150),
  orig_price numeric(10,2) NOT NULL CHECK (orig_price >= 0),
  price numeric(10,2) NOT NULL CHECK (price >= 0 AND price <= orig_price),
  qty_left integer NOT NULL CHECK (qty_left BETWEEN 0 AND 10000),
  pickup_start timestamptz NOT NULL,
  pickup_end timestamptz NOT NULL CHECK (pickup_end > pickup_start),
  allergens text[] NOT NULL DEFAULT '{}',
  description text,
  is_sample boolean NOT NULL DEFAULT true,
  posted_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS surplus_available_idx ON surplus_listings (pickup_end, price) WHERE qty_left > 0;
