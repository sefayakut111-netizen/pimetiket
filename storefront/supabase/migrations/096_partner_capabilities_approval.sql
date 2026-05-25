-- ============================================================
-- Migration 096 — partner_capabilities admin onay mekanizması
-- ============================================================

alter table public.partner_capabilities
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id);

-- Mevcut kayıtlar backfill (aktif atamalar bozulmasın)
update public.partner_capabilities
  set is_verified = true,
      verified_at = coalesce(verified_at, now())
  where is_verified = false;

alter type public.audit_action add value if not exists 'partner.capability_verify';
alter type public.audit_action add value if not exists 'partner.capability_unverify';

create or replace function public.fn_find_best_partner(
  p_product_type text,
  p_material text,
  p_order_amount numeric default 0
)
returns table (
  partner_id uuid,
  partner_name text,
  default_lead_days int,
  cached_score numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    p.id,
    p.name,
    p.default_lead_days,
    p.cached_score
  from public.fason_partners p
  where p.status = 'active'
    and (
      p.contract_signed_at is not null
      or (p.contract_pdf_url is not null and length(trim(p.contract_pdf_url)) > 0)
    )
    and exists (
      select 1 from public.partner_capabilities pc
      where pc.partner_id = p.id
        and pc.capability_type = 'product_type'
        and pc.capability_value = p_product_type
        and pc.is_verified = true
    )
    and (
      p_material is null
      or exists (
        select 1 from public.partner_capabilities pc
        where pc.partner_id = p.id
          and pc.capability_type = 'material'
          and pc.capability_value = p_material
          and pc.is_verified = true
      )
    )
    and (p.min_order_amount_try is null or p.min_order_amount_try <= p_order_amount)
  order by
    coalesce(p.cached_score, 0.5) desc,
    p.default_lead_days asc;
end;
$$;

comment on function public.fn_find_best_partner(text, text, numeric) is
  'Mig 096: Sadece admin-onaylı (is_verified) capability eşleşmeleri.';

drop index if exists partner_capabilities_lookup_idx;
create index if not exists partner_capabilities_verified_lookup_idx
  on public.partner_capabilities (capability_type, capability_value)
  where is_verified = true;
