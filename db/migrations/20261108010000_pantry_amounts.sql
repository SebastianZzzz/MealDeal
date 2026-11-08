-- Rough pantry amounts (issue #21): seasonings are "have it", ingredients get a rough amount.
-- qty_g stays the exact amount; 0 means "not measured".
alter table pantry_items
  add column if not exists kind text not null default 'ingredient',
  add column if not exists amount text not null default 'unknown';

alter table pantry_items drop constraint if exists pantry_items_kind_check;
alter table pantry_items add constraint pantry_items_kind_check check (kind in ('seasoning', 'ingredient'));
alter table pantry_items drop constraint if exists pantry_items_amount_check;
alter table pantry_items add constraint pantry_items_amount_check check (amount in ('unknown', 'little', 'some', 'plenty'));
