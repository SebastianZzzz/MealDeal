-- Reference only: A owns the canonical shared_app and align_surplus_with_d migrations.
-- Use the shared migration runner, not this file separately.
-- Surplus IDs are text; posted_by is required; there is no updated_at column.
-- Cooking plan/user IDs remain UUIDs. This is the current surplus schema only.
create table if not exists surplus_listings (
  id text primary key,
  merchant_name text not null check (length(merchant_name) between 1 and 100),
  address text not null check (length(address) between 1 and 300),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  title text not null check (length(title) between 1 and 150),
  orig_price numeric(10, 2) not null check (orig_price >= 0),
  price numeric(10, 2) not null check (price >= 0 and price <= orig_price),
  qty_left integer not null check (qty_left between 0 and 10000),
  pickup_start timestamptz not null,
  pickup_end timestamptz not null check (pickup_end > pickup_start),
  allergens text[] not null default '{}',
  description text,
  is_sample boolean not null default true,
  posted_by text not null,
  created_at timestamptz not null default current_timestamp
);

create index if not exists surplus_available_idx
  on surplus_listings(pickup_end, price) where qty_left > 0;
