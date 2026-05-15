-- ============================================================
-- Pim Etiket — Migration 039: Design Quality Check Agent
--
-- Sefa kuralı (16 May 2026): Baskı onay akışı (v3) için:
--   1. AI Quality Check Agent — Claude/GPT Vision ile 3 kategori
--      (kötü/normal/iyi) skor + bulgu listesi
--   2. Order status enum'a yeni state'ler
--   3. Audit tablosu: her AI çalışmasının logu
--
-- Sefa'nın özel notu (16 May 2026):
--   "DPI mantığı aldatıcı, ebata göre orantı. Vektörel için
--    farklı analiz lazım." → Agent input'ta print_width_mm +
--    print_height_mm alır, effective DPI hesaplar (px/inç).
-- ============================================================

-- ============================================================
-- 1) order_status enum'a yeni değerler
-- ============================================================
-- ADD VALUE PostgreSQL'de sadece DBA tarafından, transaction dışında çalışır.
-- IF NOT EXISTS koruması var.

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'proof_generating'
      and enumtypid = (select oid from pg_type where typname = 'order_status')
  ) then
    alter type public.order_status add value 'proof_generating';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'fason_assigned'
      and enumtypid = (select oid from pg_type where typname = 'order_status')
  ) then
    alter type public.order_status add value 'fason_assigned';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'human_review'
      and enumtypid = (select oid from pg_type where typname = 'order_status')
  ) then
    alter type public.order_status add value 'human_review';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'human_review_failed'
      and enumtypid = (select oid from pg_type where typname = 'order_status')
  ) then
    alter type public.order_status add value 'human_review_failed';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'ready_to_ship'
      and enumtypid = (select oid from pg_type where typname = 'order_status')
  ) then
    alter type public.order_status add value 'ready_to_ship';
  end if;
end $$;

-- ============================================================
-- 2) design_quality_checks audit tablosu
-- ============================================================
-- Her AI run'ın logu — input + output + cost + duration.
-- Sefa için: tartışmalı vakalarda AI ne karar verdi geriye bakılır.
create table if not exists public.design_quality_checks (
  id uuid primary key default gen_random_uuid(),

  -- Reference (cascade delete)
  order_id text references public.orders(id) on delete cascade,
  design_file_id uuid references public.design_files(id) on delete cascade,

  -- Agent metadata
  agent_name text not null default 'design-qc-v1',
  agent_version text not null default 'v1.0',

  -- Input parameters
  file_format text,                 -- "png" | "pdf" | "ai" | "jpeg" | ...
  print_width_mm integer,
  print_height_mm integer,
  product_type text,                -- "etiket" | "sticker"

  -- Analysis results
  verdict text not null check (verdict in ('iyi', 'normal', 'kotu', 'error')),
  score smallint check (score >= 0 and score <= 100),

  -- Detailed analysis (jsonb schema-flexible)
  -- Şema: { fileType, effectiveDpi, embeddedRasterCount, colorProfile,
  --         hasBleed, hasCutPath, isTextOutlined, ... }
  analysis jsonb,

  -- Findings array
  -- Şema: [{ severity: "info"|"warning"|"error", category, message, actionable }]
  findings jsonb,

  -- Run telemetry
  model text default 'gpt-4o',
  tokens_used integer,
  cost_usd numeric(10, 4),
  duration_ms integer,
  error text,

  created_at timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists design_quality_checks_order_id_idx
  on public.design_quality_checks(order_id);
create index if not exists design_quality_checks_design_file_id_idx
  on public.design_quality_checks(design_file_id);
create index if not exists design_quality_checks_verdict_idx
  on public.design_quality_checks(verdict);
create index if not exists design_quality_checks_created_at_idx
  on public.design_quality_checks(created_at desc);

-- RLS — admin/staff read, service_role write
alter table public.design_quality_checks enable row level security;

drop policy if exists "design_qc_admin_read"
  on public.design_quality_checks;
create policy "design_qc_admin_read"
  on public.design_quality_checks
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'staff')
    )
  );

-- Comments
comment on table public.design_quality_checks is
  'AI Quality Check Agent çalışma logu — her tasarım dosyası için bir kayıt. '
  'Audit + cost tracking + Sefa için tartışmalı vaka geri inceleme.';

comment on column public.design_quality_checks.verdict is
  '3 kategori karar: iyi (80-100), normal (50-79), kotu (0-49). '
  'error = agent çalıştırılamadı.';

comment on column public.design_quality_checks.analysis is
  'Detaylı analiz JSONB: fileType, effectiveDpi, colorProfile, hasBleed, '
  'hasCutPath, embeddedRasterCount, isTextOutlined, vb. AI tarafından üretilir.';

comment on column public.design_quality_checks.findings is
  'Bulgu listesi JSONB array: [{severity, category, message, actionable}]. '
  'severity: info/warning/error, actionable: çözüm önerisi.';

-- ============================================================
-- Migration 039 sonu
-- ============================================================
