-- B: grocery catalog. Stores, current product prices, nutrition, and price history.
-- Every physical store is its own row ("chain@location"): chains do not always share prices.
create extension if not exists timescaledb;

create table if not exists stores (
  id text primary key check (id ~ '^[a-z0-9-]+@[a-z0-9-]+$'),
  name text not null check (length(name) between 1 and 160),
  chain text not null check (length(chain) <= 80),
  address text not null default '' check (length(address) <= 200),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now()
);

-- Values per 100 g from a nutrition database (CNF / USDA), never model-estimated.
create table if not exists foods (
  id text primary key,
  name text not null,
  kcal numeric not null check (kcal >= 0),
  protein_g numeric not null check (protein_g >= 0),
  fat_g numeric not null check (fat_g >= 0),
  carb_g numeric not null check (carb_g >= 0),
  db_ref text
);

-- The current price of one product at one store. Weights are grams (or ml / pieces).
create table if not exists products (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  food_id text references foods(id) on delete set null,
  name text not null check (length(name) between 1 and 160),
  brand text,
  package_size_g numeric not null check (package_size_g > 0),
  package_unit text not null check (package_unit in ('g', 'ml', 'piece')),
  package_price numeric(10, 2) not null check (package_price >= 0),
  price_per_100 numeric(12, 4) not null check (price_per_100 >= 0),
  is_sale boolean not null default false,
  valid_until timestamptz,
  source text not null check (source in ('flyer', 'report')),
  confidence numeric not null default 1 check (confidence between 0 and 1),
  reported_by text,
  reported_at timestamptz not null default now(),
  category text check (category in ('grain', 'protein', 'vegetable', 'fruit', 'dairy', 'sauce', 'ready_meal', 'other')),
  updated_at timestamptz not null default now()
);

create index if not exists products_store_id_idx on products (store_id);
create index if not exists products_valid_until_idx on products (valid_until);

-- Every flyer import, confirmed report, or sample row. Feeds the 28-day deal check.
create table if not exists price_observations (
  time timestamptz not null,
  product_id text not null references products(id) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  package_price numeric(10, 2) not null check (package_price >= 0),
  price_per_100 numeric(12, 4) not null check (price_per_100 >= 0),
  is_sale boolean not null default false,
  source text not null check (source in ('flyer', 'report', 'sample'))
);

select create_hypertable('price_observations', 'time', if_not_exists => true);

-- Re-importing the same flyer must not add duplicate rows (they would skew the median).
-- Unique indexes on a hypertable must include its time column.
create unique index if not exists price_observations_dedupe_idx on price_observations (product_id, source, time);
create index if not exists price_observations_product_time_idx on price_observations (product_id, time desc);
