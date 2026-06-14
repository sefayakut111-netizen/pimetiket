-- Migration 183 — Reprint kupon idempotency (FAZ 2)
-- coupons.description üzerinde kısmi unique index (is_active=true DAHİL → deaktive slot serbest).
-- SIRA: referans-güvenli dedupe → CREATE UNIQUE INDEX. coupon_uses.coupon_id ON DELETE CASCADE
-- olduğu için referanslı kupon ASLA silinmez (deactivate edilir).

-- 1) Referans-güvenli dedupe (index'ten ÖNCE)
do $$
declare r record;
begin
  for r in
    select description from public.coupons
    where description like 'Tekrar baskı — %' and is_active = true
    group by description having count(*) > 1
  loop
    with keep as (
      select c.id from public.coupons c
      where c.description = r.description and c.is_active = true
      order by (exists (select 1 from public.coupon_uses cu where cu.coupon_id = c.id)) desc,
               c.created_at asc, c.id asc
      limit 1
    )
    update public.coupons c set is_active = false, updated_at = now()
    where c.description = r.description and c.is_active = true
      and c.id not in (select id from keep);
  end loop;
end$$;

-- 2) Kısmi unique index (dedupe'tan SONRA)
create unique index if not exists coupons_reprint_source_unique
  on public.coupons (description)
  where description like 'Tekrar baskı — %' and is_active = true;

comment on index public.coupons_reprint_source_unique is
  'Mig 183: kaynak sipariş başına max 1 AKTİF reprint kuponu. is_active=true predicate → deaktive slot serbest (wedge yok).';
