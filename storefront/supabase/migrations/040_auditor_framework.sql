-- ============================================================
-- Pim Etiket — Migration 040: Auditor Framework
--
-- Sefa kuralı (16 May 2026): "Sistem güvenliği, muhasebe, iş akışı
-- uzmanı gibi sistemi günlük kontrol edecek agent'lar — kritik
-- aksiyonlar için Sefa onayı zorunlu."
--
-- Bu migration **4 tablo** kurar:
--
--   1. auditor_runs            → her agent çalışmasının kaydı
--   2. auditor_findings        → her tespit (info/warning/critical)
--   3. auditor_pending_actions → Sefa onayı bekleyen aksiyonlar
--   4. auditor_action_log      → uygulanan aksiyonların audit trail
--
-- Tasarım kararları:
--   - Auditor kategorileri enum DEĞİL → ekleme/silme migration
--     gerektirmesin (text kontrol constraint yeterli)
--   - JSONB kullanımı: data + payload alanları schema-flexible
--   - RLS: yalnız admin/staff okur, service_role yazar
--   - Cascade: run silinince finding'ler de silinir
-- ============================================================

-- ============================================================
-- 1) auditor_runs — her agent çalışmasının kaydı
-- ============================================================
create table if not exists public.auditor_runs (
  id uuid primary key default gen_random_uuid(),

  -- Hangi auditor çalıştı
  auditor_name text not null,           -- "security" | "finance" | "workflow" | ...
  auditor_version text not null default 'v1',

  -- Tetikleyici
  trigger_type text not null check (
    trigger_type in ('cron', 'manual', 'webhook')
  ),
  triggered_by text,                    -- cron schedule veya admin user_id

  -- Zamanlama
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,

  -- Sonuç
  status text not null default 'running' check (
    status in ('running', 'success', 'failed', 'timeout')
  ),

  -- Özet
  findings_count integer not null default 0,
  critical_count integer not null default 0,
  warning_count integer not null default 0,
  info_count integer not null default 0,

  -- Markdown rapor + metrikler snapshot
  summary text,
  summary_md text,
  metrics_snapshot jsonb,

  -- Hata (status='failed' ise)
  error text,

  created_at timestamptz not null default now()
);

create index if not exists auditor_runs_auditor_idx
  on public.auditor_runs(auditor_name, started_at desc);
create index if not exists auditor_runs_status_idx
  on public.auditor_runs(status) where status != 'success';
create index if not exists auditor_runs_critical_idx
  on public.auditor_runs(critical_count) where critical_count > 0;

comment on table public.auditor_runs is
  'Domain denetçi agent çalışmalarının logu. Her agent run bir kayıt.';
comment on column public.auditor_runs.metrics_snapshot is
  'Run anındaki metric değerleri (trend grafikleri için). Şema agent''a göre değişir.';


-- ============================================================
-- 2) auditor_findings — her tespit
-- ============================================================
create table if not exists public.auditor_findings (
  id uuid primary key default gen_random_uuid(),

  -- Hangi run'dan
  run_id uuid not null references public.auditor_runs(id) on delete cascade,
  auditor_name text not null,           -- denormalize (filter için)

  -- Tespit
  severity text not null check (
    severity in ('info', 'warning', 'critical')
  ),
  category text not null,               -- "brute_force" | "stale_intent" | "kvkk_sla" | ...
  title text not null,
  description text not null,

  -- Veri snapshot (UI'da göstermek için)
  data jsonb,

  -- Önerilen aksiyon (varsa)
  suggested_action_type text,           -- "block_ip" | "expire_intent" | null (sadece rapor)
  suggested_action_payload jsonb,
  suggested_action_description text,    -- Sefa'ya gösterilecek metin

  created_at timestamptz not null default now()
);

create index if not exists auditor_findings_run_idx
  on public.auditor_findings(run_id);
create index if not exists auditor_findings_severity_idx
  on public.auditor_findings(severity, created_at desc);
create index if not exists auditor_findings_category_idx
  on public.auditor_findings(auditor_name, category);

comment on table public.auditor_findings is
  'Auditor çalışmalarında tespit edilen olaylar. severity=critical olanlar pending_actions''a düşer.';


-- ============================================================
-- 3) auditor_pending_actions — Sefa onayı bekleyen aksiyonlar
-- ============================================================
create table if not exists public.auditor_pending_actions (
  id uuid primary key default gen_random_uuid(),

  -- Kaynak
  finding_id uuid references public.auditor_findings(id) on delete cascade,
  run_id uuid not null references public.auditor_runs(id) on delete cascade,
  auditor_name text not null,

  -- Aksiyon tanımı
  action_type text not null,            -- "block_ip" | "expire_intent" | ...
  action_payload jsonb not null,
  title text not null,                  -- Sefa'ya gösterilecek kısa başlık
  description text not null,            -- detaylı açıklama
  severity text not null check (
    severity in ('info', 'warning', 'critical')
  ),

  -- Karar
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'snoozed', 'applied', 'failed')
  ),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,

  -- Snooze yönetimi
  snooze_until timestamptz,

  -- Uygulama sonrası (status='applied' veya 'failed')
  applied_at timestamptz,
  apply_error text,
  apply_result jsonb,

  created_at timestamptz not null default now()
);

create index if not exists auditor_pending_actions_status_idx
  on public.auditor_pending_actions(status, created_at desc);
create index if not exists auditor_pending_actions_pending_idx
  on public.auditor_pending_actions(severity, created_at desc)
  where status = 'pending';
create index if not exists auditor_pending_actions_snooze_idx
  on public.auditor_pending_actions(snooze_until)
  where status = 'snoozed';

comment on table public.auditor_pending_actions is
  'Auditor''ların önerdiği ve Sefa onayı bekleyen aksiyonlar. status=pending olan kayıtlar /admin/denetciler/bekleyen sayfasında listelenir.';


-- ============================================================
-- 4) auditor_action_log — uygulanan aksiyon audit trail
-- ============================================================
create table if not exists public.auditor_action_log (
  id uuid primary key default gen_random_uuid(),

  -- Kaynak
  pending_action_id uuid not null references public.auditor_pending_actions(id) on delete cascade,

  -- Uygulama detayı
  executed_at timestamptz not null default now(),
  executed_by uuid references auth.users(id),  -- onaylayan kullanıcı
  result text not null check (
    result in ('success', 'failed', 'partial')
  ),

  -- Etki
  affected_rows integer,
  affected_ids jsonb,                   -- etki edilen kayıtların ID'leri
  external_call jsonb,                  -- 3. parti API çağrısı varsa response
  error text,

  created_at timestamptz not null default now()
);

create index if not exists auditor_action_log_pending_idx
  on public.auditor_action_log(pending_action_id);
create index if not exists auditor_action_log_executed_idx
  on public.auditor_action_log(executed_at desc);

comment on table public.auditor_action_log is
  'Auditor aksiyonlarının uygulanma audit''i. Sefa "geçmişte ne yaptık?" diye bakar.';


-- ============================================================
-- 5) RLS — admin/staff okur, service_role yazar
-- ============================================================
alter table public.auditor_runs            enable row level security;
alter table public.auditor_findings        enable row level security;
alter table public.auditor_pending_actions enable row level security;
alter table public.auditor_action_log      enable row level security;

-- Admin/staff read policies
drop policy if exists "auditor_runs_admin_read" on public.auditor_runs;
create policy "auditor_runs_admin_read"
  on public.auditor_runs for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "auditor_findings_admin_read" on public.auditor_findings;
create policy "auditor_findings_admin_read"
  on public.auditor_findings for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "auditor_pending_actions_admin_read" on public.auditor_pending_actions;
create policy "auditor_pending_actions_admin_read"
  on public.auditor_pending_actions for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

-- Admin/staff onay verebilir (pending_actions update)
drop policy if exists "auditor_pending_actions_admin_decide" on public.auditor_pending_actions;
create policy "auditor_pending_actions_admin_decide"
  on public.auditor_pending_actions for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );

drop policy if exists "auditor_action_log_admin_read" on public.auditor_action_log;
create policy "auditor_action_log_admin_read"
  on public.auditor_action_log for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'staff')
    )
  );


-- ============================================================
-- 6) Yardımcı view'ler
-- ============================================================

-- Her auditor için son run özeti (dashboard kartlarında kullanılır)
create or replace view public.v_auditor_latest_runs as
select distinct on (auditor_name)
  auditor_name,
  id as latest_run_id,
  started_at,
  finished_at,
  duration_ms,
  status,
  findings_count,
  critical_count,
  warning_count,
  info_count,
  summary
from public.auditor_runs
order by auditor_name, started_at desc;

comment on view public.v_auditor_latest_runs is
  'Her auditor''ın son çalışması — dashboard kartları bu view''i kullanır.';


-- Pending action sayısı (badge için)
create or replace view public.v_auditor_pending_count as
select
  count(*) filter (where severity = 'critical') as critical_pending,
  count(*) filter (where severity = 'warning')  as warning_pending,
  count(*) filter (where severity = 'info')     as info_pending,
  count(*) as total_pending
from public.auditor_pending_actions
where status = 'pending'
  and (snooze_until is null or snooze_until < now());

comment on view public.v_auditor_pending_count is
  'Bekleyen aksiyon sayısı — sidebar badge için.';


-- ============================================================
-- Migration 040 sonu
-- ============================================================
