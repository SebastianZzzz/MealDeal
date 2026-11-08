-- Align databases that already applied the earlier A draft with D's merged
-- repository contract. Fresh databases already receive this shape from the
-- preceding migration; every statement here remains safe and idempotent.
alter table surplus_listings alter column id drop default;
alter table surplus_listings alter column id type text using id::text;
alter table surplus_listings add column if not exists posted_by text;
update surplus_listings set posted_by = 'demo|student' where posted_by is null;
alter table surplus_listings alter column posted_by set not null;
alter table surplus_listings alter column is_sample set default true;
alter table surplus_listings drop column if exists updated_at;

alter table surplus_listings drop constraint if exists surplus_listings_merchant_name_check;
alter table surplus_listings drop constraint if exists surplus_listings_address_check;
alter table surplus_listings drop constraint if exists surplus_listings_lat_check;
alter table surplus_listings drop constraint if exists surplus_listings_lng_check;
alter table surplus_listings drop constraint if exists surplus_listings_title_check;
alter table surplus_listings drop constraint if exists surplus_listings_orig_price_check;
alter table surplus_listings drop constraint if exists surplus_listings_price_check;
alter table surplus_listings drop constraint if exists surplus_listings_qty_left_check;
alter table surplus_listings drop constraint if exists surplus_listings_pickup_end_check;

alter table surplus_listings
  add constraint surplus_listings_merchant_name_check check (length(merchant_name) between 1 and 100),
  add constraint surplus_listings_address_check check (length(address) between 1 and 300),
  add constraint surplus_listings_lat_check check (lat between -90 and 90),
  add constraint surplus_listings_lng_check check (lng between -180 and 180),
  add constraint surplus_listings_title_check check (length(title) between 1 and 150),
  add constraint surplus_listings_orig_price_check check (orig_price >= 0),
  add constraint surplus_listings_price_check check (price >= 0 and price <= orig_price),
  add constraint surplus_listings_qty_left_check check (qty_left between 0 and 10000),
  add constraint surplus_listings_pickup_end_check check (pickup_end > pickup_start);

drop index if exists surplus_listings_pickup_qty_idx;
create index if not exists surplus_available_idx
  on surplus_listings(pickup_end, price) where qty_left > 0;
