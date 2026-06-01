-- Mig 134: v_pricing_live — draft_config anon sızıntısını kapat + impersonate audit enum

alter type public.audit_action add value if not exists 'admin.impersonate_partner';

create or replace view public.v_pricing_live
with (security_invoker = false)
as
  select scope, live_config
  from public.pricing_config;

grant select on public.v_pricing_live to anon;
grant select on public.v_pricing_live to authenticated;

drop policy if exists "pricing_config_live_read_anon" on public.pricing_config;

comment on view public.v_pricing_live is
  'Mig 134: Müşteri tarafı yalnızca live_config okur; draft_config tablo RLS ile gizli.';
