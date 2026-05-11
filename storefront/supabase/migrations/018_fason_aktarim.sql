-- ============================================================
-- Pim Etiket — Migration 018: Fason Aktarım Sistemi (Yaklaşım D — Hibrit)
--
-- 4-agent denetimi sonrası revize:
--   - order_id text (uuid değil — orders.id PE-2026-XXXX formatı)
--   - assignment_status ayrı enum (orders.status ile karışmıyor)
--   - Partial unique index: aynı anda 2 aktif fason olamaz
--   - cached_score + score_updated_at denormalize
--   - on delete restrict (fason silinemez, active=false)
-- ============================================================

-- ---------- assignment_status enum ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'assignment_status') then
    create type public.assignment_status as enum (
      'assigned',         -- Sefa atadı, mail gönderildi mi belirsiz
      'sent',             -- Mail gönderildi (mail outbox başarılı)
      'acknowledged',     -- Fason linke tıkladı (download_logged_at set)
      'in_production',    -- Fason "üretime aldım" dedi
      'ready',            -- Fason "hazır, kargoya veriyorum" dedi
      'shipped',          -- Kargoya verildi (tracking no var)
      'issue',            -- Fason "bir terslik var" dedi
      'cancelled'         -- İptal (Sefa veya 36h iade)
    );
  end if;
end$$;

-- ---------- fason_partners tablosu ----------
create table if not exists public.fason_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text not null,
  contact_whatsapp text,
  contact_person text,
  specialties text[] not null default '{}',   -- ['etiket','sticker','holografik']
  default_lead_days integer not null default 7,
  cached_score numeric(3, 2),                  -- 0.00-1.00, daily cron ile refresh
  score_updated_at timestamp with time zone,
  active boolean not null default true,
  contract_signed_at timestamp with time zone, -- veri işleyici sözleşme imzası
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists fason_partners_active_idx
  on public.fason_partners(active) where active = true;

create index if not exists fason_partners_specialties_idx
  on public.fason_partners using gin(specialties);

-- ---------- order_assignments tablosu ----------
-- order_id TEXT (orders.id PE-2026-XXXX formatı, uuid DEĞİL)
create table if not exists public.order_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  fason_partner_id uuid not null references public.fason_partners(id) on delete restrict,
  status public.assignment_status not null default 'assigned',
  assigned_at timestamp with time zone default now(),
  assigned_by uuid references auth.users(id) on delete set null, -- Sefa (admin)
  estimated_delivery date,
  actual_delivery date,
  notes text,
  -- Status timestamps (her geçiş ayrı timestamp)
  sent_at timestamp with time zone,
  acknowledged_at timestamp with time zone,
  in_production_at timestamp with time zone,
  ready_at timestamp with time zone,
  shipped_at timestamp with time zone,
  issue_reported_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  -- Sorun bildirimi alanları
  issue_category text, -- 'dosya'|'malzeme'|'sure'|'diger'
  issue_description text,
  issue_photo_path text, -- Storage 'fason-issues' bucket
  -- Kargo
  tracking_company text,
  tracking_number text,
  tracking_url text,
  -- Metadata
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Partial unique: aynı sipariş için 1 aktif assignment
create unique index if not exists order_assignments_one_active_idx
  on public.order_assignments(order_id)
  where status in ('assigned', 'sent', 'acknowledged', 'in_production', 'ready');

-- Sık kullanılan index'ler
create index if not exists order_assignments_fason_status_idx
  on public.order_assignments(fason_partner_id, status);

create index if not exists order_assignments_pending_delivery_idx
  on public.order_assignments(estimated_delivery)
  where status not in ('shipped', 'cancelled');

create index if not exists order_assignments_assigned_desc_idx
  on public.order_assignments(assigned_at desc);

-- ---------- updated_at trigger ----------
create or replace function public.fn_update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists fason_partners_updated_at on public.fason_partners;
create trigger fason_partners_updated_at
  before update on public.fason_partners
  for each row execute function public.fn_update_updated_at();

drop trigger if exists order_assignments_updated_at on public.order_assignments;
create trigger order_assignments_updated_at
  before update on public.order_assignments
  for each row execute function public.fn_update_updated_at();

-- ---------- RLS ----------
alter table public.fason_partners enable row level security;
alter table public.order_assignments enable row level security;

-- fason_partners: sadece admin/staff görür (service role bypass)
drop policy if exists "Only admin sees fason partners" on public.fason_partners;
create policy "Only admin sees fason partners"
  on public.fason_partners for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'staff')
    )
  );

-- order_assignments: müşteri kendi siparişine ait olanı GÖRMEZ (operasyon arka plan)
-- Admin/staff service role ile çağırır
drop policy if exists "Admin sees own assignments via service role" on public.order_assignments;
create policy "Admin sees own assignments via service role"
  on public.order_assignments for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'staff')
    )
  );

-- ============================================================
-- Migration 018 sonu
-- ============================================================
