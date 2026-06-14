-- Migration 184: RBAC self-escalation guard (M9-B3) + legacy backfill
-- admin_role=NULL eski admin/staff hesapları super_admin gibi sayılıyordu →
-- staff:update ile kendine super_admin atayabilirlerdi. DB-seviyesi 2. savunma.
-- FAZ0: prod'da 1 super_admin + 3 admin_role=NULL (3'ü customer → backfill dokunmaz).
-- SIRA: backfill → trigger.

-- 1) BACKFILL (ÖNCE) — idempotent (Mig 091 yaptı, NULL kalmışı süpürür)
update public.profiles set admin_role = 'super_admin'::public.admin_role_v2
  where role = 'admin' and admin_role is null;
update public.profiles set admin_role = 'production'::public.admin_role_v2
  where role = 'staff' and admin_role is null;

-- 2) TRIGGER FONKSİYONU — auth.uid() NULL (service_role) bypass; authenticated path'te
--    super_admin'e yükseltmeyi yalnız mevcut super_admin yapabilir.
create or replace function public.fn_guard_admin_role_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor_admin_role public.admin_role_v2;
begin
  if auth.uid() is null then return new; end if;
  if new.admin_role is distinct from 'super_admin'::public.admin_role_v2 then return new; end if;
  if old.admin_role is not distinct from new.admin_role then return new; end if;
  select admin_role into v_actor_admin_role from public.profiles where id = auth.uid();
  if v_actor_admin_role is distinct from 'super_admin'::public.admin_role_v2 then
    raise exception 'super_admin atamasını yalnız mevcut super_admin yapabilir (RBAC self-escalation guard)'
      using errcode = '42501';
  end if;
  return new;
end; $$;

-- 3) TRIGGER (SONRA)
drop trigger if exists trg_guard_admin_role_escalation on public.profiles;
create trigger trg_guard_admin_role_escalation
  before update of admin_role on public.profiles
  for each row execute function public.fn_guard_admin_role_escalation();
