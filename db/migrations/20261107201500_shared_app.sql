create table if not exists meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  request jsonb not null,
  chosen jsonb not null,
  status text not null default 'shopping' check (status in ('shopping', 'cooking', 'done')),
  progress jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meal_plans_user_id_created_at_idx
  on meal_plans(user_id, created_at desc);

create table if not exists food_resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('food_bank', 'low_cost_market', 'community_fridge', 'free_meal', 'other')),
  address text not null,
  lat double precision,
  lng double precision,
  hours text not null,
  eligibility text not null,
  source_url text not null,
  verified_at date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
