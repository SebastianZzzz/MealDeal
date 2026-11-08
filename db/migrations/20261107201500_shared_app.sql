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
