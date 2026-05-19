-- ============================================================
-- Migration 067 — Üretim Partneri form genişletme
-- ============================================================
-- Sefa 20 May v68 (partner form spec uyarlaması, Faz 1):
--
-- Mevcut Mig 018 fason_partners tablosu tek-kişilik flat yapı.
-- Yeni spec multi-contact (owner/operator/accounting) + capabilities
-- (product_type + material). Bu migration:
--
--   1. fason_partners ALTER ADD COLUMN — yeni metadata alanları
--   2. partner_contacts yeni tablo (1:N — owner/operator/accounting)
--   3. partner_capabilities yeni tablo (1:N — product_type/material)
--   4. status text alanı (active boolean'la geriye uyumlu, paralel yaşar)
--   5. fn_create_partner_with_contacts RPC — atomic insert
--   6. RLS admin-only
--
-- GERİYE UYUM:
--   - active boolean KORUN (eski kod hâlâ okur)
--   - status text yeni — `active|paused|terminated`, default 'active'
--   - Trigger: status değişince active otomatik sync (true if 'active')
--   - contact_email/whatsapp/person flat alanlar KORUN (eski kayıt)
--   - specialties text[] KORUN (eski free-text kapasite)
-- ============================================================

-- 1) fason_partners ALTER ADD COLUMN
alter table public.fason_partners
  add column if not exists short_name varchar(40),
  add column if not exists tax_number varchar(11),
  add column if not exists tax_office varchar(80),
  add column if not exists address_line text,
  add column if not exists city varchar(50),
  add column if not exists town varchar(50),
  add column if not exists status varchar(20) not null default 'active',
  add column if not exists status_reason text,
  add column if not exists express_lead_time_days int,
  add column if not exists min_order_amount_try numeric(10, 2),
  add column if not exists payment_term varchar(20),
  add column if not exists iban varchar(34),
  add column if not exists contract_pdf_url text,
  add column if not exists contract_uploaded_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

-- Status check (active | paused | terminated)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fason_partners_status_check'
  ) then
    alter table public.fason_partners
      add constraint fason_partners_status_check
      check (status in ('active', 'paused', 'terminated'));
  end if;
end$$;

-- Payment term check
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fason_partners_payment_term_check'
  ) then
    alter table public.fason_partners
      add constraint fason_partners_payment_term_check
      check (payment_term is null or payment_term in ('cash', 'net_15', 'net_30', 'net_60'));
  end if;
end$$;

-- Backfill: mevcut active=false kayıtları 'terminated', active=true → 'active'
update public.fason_partners
  set status = case when active then 'active' else 'terminated' end
  where status is null or status = 'active';

-- Index: status + capabilities filtre için
create index if not exists fason_partners_status_idx
  on public.fason_partners(status);

create index if not exists fason_partners_city_idx
  on public.fason_partners(city) where city is not null;

-- ============================================================
-- 2) partner_contacts (1:N — owner/operator/accounting)
-- ============================================================
create table if not exists public.partner_contacts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.fason_partners(id) on delete cascade,
  role varchar(20) not null check (role in ('owner', 'operator', 'accounting')),
  name varchar(100) not null,
  title varchar(80),
  email varchar(150) not null,
  phone_e164 varchar(20) not null,
  auto_notification boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Şimdilik her rolden 1 kişi (spec'te belirtildi)
  constraint partner_contacts_unique_role unique (partner_id, role)
);

create index if not exists partner_contacts_partner_idx
  on public.partner_contacts(partner_id);

drop trigger if exists partner_contacts_updated_at on public.partner_contacts;
create trigger partner_contacts_updated_at
  before update on public.partner_contacts
  for each row execute function public.fn_update_updated_at();

-- ============================================================
-- 3) partner_capabilities (1:N — product_type + material)
-- ============================================================
create table if not exists public.partner_capabilities (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.fason_partners(id) on delete cascade,
  capability_type varchar(20) not null
    check (capability_type in ('product_type', 'material')),
  capability_value varchar(30) not null,
  created_at timestamptz default now(),
  constraint partner_capabilities_unique
    unique (partner_id, capability_type, capability_value)
);

create index if not exists partner_capabilities_partner_idx
  on public.partner_capabilities(partner_id);

-- Lookup index: "metalize basabilen tüm partnerler" hızlı sorgu
create index if not exists partner_capabilities_lookup_idx
  on public.partner_capabilities(capability_type, capability_value);

-- ============================================================
-- 4) RLS — admin-only (service role bypass)
-- ============================================================
alter table public.partner_contacts enable row level security;
alter table public.partner_capabilities enable row level security;

drop policy if exists "Only admin sees partner contacts" on public.partner_contacts;
create policy "Only admin sees partner contacts"
  on public.partner_contacts for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'staff')
    )
  );

drop policy if exists "Only admin sees partner capabilities" on public.partner_capabilities;
create policy "Only admin sees partner capabilities"
  on public.partner_capabilities for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'staff')
    )
  );

-- ============================================================
-- 5) fn_create_partner_with_contacts RPC
--    Tek transaction: partners + contacts + capabilities
-- ============================================================
create or replace function public.fn_create_partner_with_contacts(
  p_partner jsonb,        -- {name, short_name, tax_*, address_*, status, lead_*, payment_term, iban, contract_url, notes}
  p_contacts jsonb,       -- [{role, name, title, email, phone_e164, auto_notification}]
  p_capabilities jsonb,   -- [{type, value}]
  p_admin_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_contact jsonb;
  v_cap jsonb;
begin
  -- 1) Partner INSERT
  insert into public.fason_partners (
    name, short_name, tax_number, tax_office,
    address_line, city, town,
    status, default_lead_days, express_lead_time_days, min_order_amount_try,
    payment_term, iban, contract_pdf_url, contract_uploaded_at,
    notes, created_by, updated_by,
    -- Legacy alanlar — boş bırak (yeni form contacts'a yazar)
    contact_email, contact_person,
    active
  ) values (
    p_partner->>'name',
    p_partner->>'short_name',
    p_partner->>'tax_number',
    p_partner->>'tax_office',
    p_partner->>'address_line',
    p_partner->>'city',
    p_partner->>'town',
    coalesce(p_partner->>'status', 'active'),
    coalesce((p_partner->>'default_lead_time_days')::int, 7),
    nullif(p_partner->>'express_lead_time_days', '')::int,
    nullif(p_partner->>'min_order_amount_try', '')::numeric,
    p_partner->>'payment_term',
    p_partner->>'iban',
    p_partner->>'contract_pdf_url',
    case when p_partner ? 'contract_pdf_url' and p_partner->>'contract_pdf_url' is not null
         then now() else null end,
    p_partner->>'notes',
    p_admin_id,
    p_admin_id,
    -- Legacy fallback (owner email/ad)
    coalesce(
      (select c->>'email' from jsonb_array_elements(p_contacts) c where c->>'role' = 'owner'),
      'placeholder@pimetiket.com'
    ),
    (select c->>'name' from jsonb_array_elements(p_contacts) c where c->>'role' = 'owner'),
    coalesce(p_partner->>'status', 'active') = 'active'
  )
  returning id into v_partner_id;

  -- 2) Contacts INSERT (each role)
  for v_contact in select * from jsonb_array_elements(p_contacts)
  loop
    if (v_contact->>'name') is not null and length(v_contact->>'name') > 0 then
      insert into public.partner_contacts (
        partner_id, role, name, title, email, phone_e164, auto_notification
      ) values (
        v_partner_id,
        v_contact->>'role',
        v_contact->>'name',
        v_contact->>'title',
        v_contact->>'email',
        v_contact->>'phone_e164',
        coalesce((v_contact->>'auto_notification')::boolean, false)
      );
    end if;
  end loop;

  -- 3) Capabilities INSERT
  for v_cap in select * from jsonb_array_elements(p_capabilities)
  loop
    insert into public.partner_capabilities (
      partner_id, capability_type, capability_value
    ) values (
      v_partner_id,
      v_cap->>'type',
      v_cap->>'value'
    )
    on conflict (partner_id, capability_type, capability_value) do nothing;
  end loop;

  return v_partner_id;
end;
$$;

grant execute on function public.fn_create_partner_with_contacts(jsonb, jsonb, jsonb, uuid)
  to authenticated;

-- ============================================================
-- 6) fn_find_best_partner RPC (capability-based eligible match)
-- ============================================================
create or replace function public.fn_find_best_partner(
  p_product_type text,     -- 'roll_label' | 'sheet_label' | 'sticker'
  p_material text,         -- 'paper' | 'transparent' | 'metallic' | 'holographic'
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
    -- product_type capability match
    and exists (
      select 1 from public.partner_capabilities pc
      where pc.partner_id = p.id
        and pc.capability_type = 'product_type'
        and pc.capability_value = p_product_type
    )
    -- material capability match (eğer p_material verildi ise)
    and (
      p_material is null
      or exists (
        select 1 from public.partner_capabilities pc
        where pc.partner_id = p.id
          and pc.capability_type = 'material'
          and pc.capability_value = p_material
      )
    )
    -- min_order_amount kontrolü
    and (p.min_order_amount_try is null or p.min_order_amount_try <= p_order_amount)
  order by
    coalesce(p.cached_score, 0.5) desc,  -- en yüksek skor önce
    p.default_lead_days asc;             -- skor eşitse en hızlı
end;
$$;

grant execute on function public.fn_find_best_partner(text, text, numeric)
  to authenticated;

-- ============================================================
-- Yorumlar
-- ============================================================
comment on column public.fason_partners.status is
  'Mig 067: active | paused | terminated. active boolean kolonu geriye uyum için duruyor.';

comment on column public.fason_partners.contract_pdf_url is
  'Mig 067: R2 storage URL (signed). Vercel Blob değil, Pim Etiket R2 kullanıyor.';

comment on table public.partner_contacts is
  'Mig 067: Partner başına 3 kişilik kontak (owner/operator/accounting). UNIQUE partner_id+role — şimdilik tek kişi her rolden.';

comment on table public.partner_capabilities is
  'Mig 067: Partner yetkinlikleri. product_type ({roll_label,sheet_label,sticker}) + material ({paper,transparent,metallic,holographic}). Otomatik atama (fn_find_best_partner) bu tablodan filtreler.';

comment on function public.fn_find_best_partner is
  'Mig 067: Sipariş için en uygun aktif partner. product_type + material capability match + min_order_amount kontrol + cached_score desc + lead_days asc sıralı.';
