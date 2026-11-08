-- Reference only: A owns db/migrations/20261107201500_shared_app.sql.
-- Apply canonical migrations with the shared runner, not this file separately.
-- UUID IDs; no posted_by column or merchant account. D explicitly inserts is_sample=true.
create table if not exists surplus_listings (
  id uuid primary key default gen_random_uuid(),
  merchant_name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  title text not null,
  orig_price numeric(10, 2) not null check (orig_price >= 0),
  price numeric(10, 2) not null check (price >= 0),
  qty_left integer not null check (qty_left >= 0),
  pickup_start timestamptz not null,
  pickup_end timestamptz not null,
  allergens text[] not null default '{}',
  description text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pickup_end > pickup_start),
  check (price <= orig_price)
);

create index if not exists surplus_listings_pickup_qty_idx
  on surplus_listings(pickup_start, qty_left)
  where qty_left > 0;
