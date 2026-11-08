-- Where the student shops from (from "Use my location" or a postal code), rounded to about 100 m.
-- Planning keeps only stores within max_distance_km of this point.
alter table users
  add column if not exists home_lat double precision,
  add column if not exists home_lng double precision;

alter table users drop constraint if exists users_home_check;
alter table users add constraint users_home_check check (
  (home_lat is null and home_lng is null)
  or (home_lat between -90 and 90 and home_lng between -180 and 180)
);
