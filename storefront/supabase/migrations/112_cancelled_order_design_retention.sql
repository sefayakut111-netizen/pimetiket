-- ============================================================
-- Migration 112: Iptal / teslim siparis tasarim saklama (KVKK)
--
-- Iptal edilen siparisler: iptalden 30 gun sonra imha
-- Teslim edilen siparisler: teslimden 90 gun sonra imha (UI taahhudu)
-- ============================================================

-- Iptal aninda deletion_due_at planla
create or replace function public.fn_on_order_cancelled_design_retention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and (old.status is distinct from 'cancelled') then
    update public.design_files
      set deletion_due_at = new.updated_at + interval '30 days',
          updated_at = now()
    where order_id = new.id
      and status not in ('superseded');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_cancelled_design_retention on public.orders;
create trigger trg_order_cancelled_design_retention
  after update of status on public.orders
  for each row
  execute function public.fn_on_order_cancelled_design_retention();

-- Cron oncesi: suresi dolmus iptal/teslim siparislerinin dosyalarini isaretle
create or replace function public.fn_apply_kvkk_order_design_retention()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_extra integer;
begin
  update public.design_files df
    set deletion_due_at = now(),
        updated_at = now()
  from public.orders o
  where df.order_id = o.id
    and o.status = 'cancelled'
    and o.updated_at < now() - interval '30 days'
    and df.status not in ('superseded')
    and (df.deletion_due_at is null or df.deletion_due_at > now());

  get diagnostics v_count = row_count;

  update public.design_files df
    set deletion_due_at = now(),
        updated_at = now()
  from public.orders o
  where df.order_id = o.id
    and o.status = 'delivered'
    and o.updated_at < now() - interval '90 days'
    and df.status not in ('superseded')
    and (df.deletion_due_at is null or df.deletion_due_at > now());

  get diagnostics v_extra = row_count;
  return v_count + v_extra;
end;
$$;

revoke execute on function public.fn_apply_kvkk_order_design_retention()
  from public, authenticated;
grant execute on function public.fn_apply_kvkk_order_design_retention()
  to service_role;

-- Mevcut iptal siparisler icin plan (henuz silinmemis)
update public.design_files df
  set deletion_due_at = o.updated_at + interval '30 days',
      updated_at = now()
from public.orders o
where df.order_id = o.id
  and o.status = 'cancelled'
  and o.updated_at >= now() - interval '30 days'
  and df.status not in ('superseded')
  and df.deletion_due_at is null;

-- 30+ gun once iptal edilmis — hemen imha adayi
select public.fn_apply_kvkk_order_design_retention();
