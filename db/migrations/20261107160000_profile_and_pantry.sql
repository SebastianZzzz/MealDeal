create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth0_id text not null unique,
  role text not null default 'student' check (role in ('student', 'merchant')),
  lang text not null default 'en' check (lang in ('en', 'zh')),
  units jsonb not null default '{"lang":"en","weight":"lb","volume":"cup"}',
  dietary text[] not null default '{}',
  allergies text[] not null default '{}',
  cuisines text[] not null default '{}',
  meat_veg_ratio text not null default 'balanced',
  default_servings integer not null default 1 check (default_servings between 1 and 20),
  equipment text[] not null default array['Stovetop', 'Pot'],
  max_distance_km numeric not null default 3 check (max_distance_km between 0.5 and 50),
  nutrition_goal text not null default '',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  food_id uuid,
  qty_g numeric not null default 0 check (qty_g >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists pantry_items_user_id_idx on pantry_items(user_id);
