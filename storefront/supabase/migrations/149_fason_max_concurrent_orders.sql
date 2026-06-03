-- Migration 149: fason_partners kapasite kolonu (canlida elle eklendi, repo senkronu)
alter table public.fason_partners
  add column if not exists max_concurrent_orders integer not null default 12;
