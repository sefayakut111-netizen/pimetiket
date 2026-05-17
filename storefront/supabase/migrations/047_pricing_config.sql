-- ============================================================
-- Pim Etiket — Migration 047: Fiyat Yönetimi (Draft/Live + Audit)
--
-- Sefa 17 May: "fiyat girebileceiğim bir alan yok, hazırlayalım".
-- 5 saatlik feature, MVP başlıyor (Aşama A).
--
-- Yapı:
--   - pricing_config: 3 scope (sticker/etiket/global) × draft+live config
--   - pricing_config_history: her değişiklik snapshot'ı (audit)
--   - Default değerler: mevcut hardcoded constants.ts'ten kopyalandı
--
-- Akış:
--   1. Admin form → draft güncelle (live'e dokunmaz)
--   2. "Canlıya yayınla" → draft'ı live'e kopyala, history'e snapshot
--   3. Pricing engine sadece LIVE config okur (cache 5dk)
--   4. "Geri al" → live history'den önceki snapshot'ı yükle
-- ============================================================

-- ============================================================
-- 1. pricing_config — tek tablo, 3 satır (scope = PK)
-- ============================================================

create table if not exists public.pricing_config (
  scope               text primary key
    check (scope in ('sticker', 'etiket', 'global')),
  draft_config        jsonb not null default '{}'::jsonb,
  live_config         jsonb not null default '{}'::jsonb,
  draft_updated_at    timestamptz not null default now(),
  draft_updated_by    uuid references auth.users(id) on delete set null,
  draft_updated_by_email text,
  live_updated_at     timestamptz not null default now(),
  live_updated_by     uuid references auth.users(id) on delete set null,
  live_updated_by_email text,
  live_published_at   timestamptz default now()
);

alter table public.pricing_config enable row level security;

drop policy if exists "pricing_config_admin_all" on public.pricing_config;
create policy "pricing_config_admin_all"
  on public.pricing_config
  for all
  using (
    exists (
      select 1 from public.profiles
        where id = auth.uid()
          and role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
        where id = auth.uid()
          and role in ('admin', 'staff')
    )
  );

-- Anon ve authenticated kullanıcılar (müşteri sayfası) live_config'i okur
drop policy if exists "pricing_config_live_read_anon" on public.pricing_config;
create policy "pricing_config_live_read_anon"
  on public.pricing_config
  for select
  to anon, authenticated
  using (true);
-- NOT: RLS policy varlığını kontrol eder, draft kolonu da seçilir
-- ama uygulama tarafı sadece live_config kolonunu select eder.

-- ============================================================
-- 2. pricing_config_history — audit log
-- ============================================================

create table if not exists public.pricing_config_history (
  id              uuid primary key default gen_random_uuid(),
  scope           text not null
    check (scope in ('sticker', 'etiket', 'global')),
  action          text not null
    check (action in ('draft_save', 'publish', 'revert')),
  config_snapshot jsonb not null,
  changed_at      timestamptz not null default now(),
  changed_by      uuid references auth.users(id) on delete set null,
  changed_by_email text,
  note            text
);

create index if not exists idx_pricing_history_scope
  on public.pricing_config_history (scope, changed_at desc);

alter table public.pricing_config_history enable row level security;

drop policy if exists "pricing_history_admin_all"
  on public.pricing_config_history;
create policy "pricing_history_admin_all"
  on public.pricing_config_history
  for all
  using (
    exists (
      select 1 from public.profiles
        where id = auth.uid()
          and role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
        where id = auth.uid()
          and role in ('admin', 'staff')
    )
  );

-- ============================================================
-- 3. RPC: fn_publish_pricing_config — draft → live + history
-- ============================================================

create or replace function public.fn_publish_pricing_config(
  p_scope text,
  p_note  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_admin_email text;
  v_draft jsonb;
begin
  -- Yetki kontrolü
  select exists (
    select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'staff')
  ), (select email from auth.users where id = auth.uid())
    into v_is_admin, v_admin_email;

  if not v_is_admin then
    raise exception 'forbidden';
  end if;

  -- Draft'ı oku
  select draft_config into v_draft
    from public.pricing_config
    where scope = p_scope;

  if v_draft is null then
    raise exception 'scope_not_found: %', p_scope;
  end if;

  -- Live'e kopyala + audit
  update public.pricing_config
    set live_config = v_draft,
        live_updated_at = now(),
        live_updated_by = auth.uid(),
        live_updated_by_email = v_admin_email,
        live_published_at = now()
    where scope = p_scope;

  -- History'e snapshot
  insert into public.pricing_config_history
    (scope, action, config_snapshot, changed_by, changed_by_email, note)
  values
    (p_scope, 'publish', v_draft, auth.uid(), v_admin_email, p_note);
end;
$$;

grant execute on function public.fn_publish_pricing_config(text, text)
  to authenticated;

-- ============================================================
-- 4. RPC: fn_revert_pricing_config — history'den önceki snapshot'a dön
-- ============================================================

create or replace function public.fn_revert_pricing_config(
  p_scope     text,
  p_history_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_admin_email text;
  v_snapshot jsonb;
begin
  select exists (
    select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'staff')
  ), (select email from auth.users where id = auth.uid())
    into v_is_admin, v_admin_email;

  if not v_is_admin then
    raise exception 'forbidden';
  end if;

  -- History snapshot'ı oku
  select config_snapshot into v_snapshot
    from public.pricing_config_history
    where id = p_history_id
      and scope = p_scope;

  if v_snapshot is null then
    raise exception 'history_not_found';
  end if;

  -- Live'e yükle
  update public.pricing_config
    set live_config = v_snapshot,
        live_updated_at = now(),
        live_updated_by = auth.uid(),
        live_updated_by_email = v_admin_email,
        live_published_at = now()
    where scope = p_scope;

  -- Yeni history entry (revert action)
  insert into public.pricing_config_history
    (scope, action, config_snapshot, changed_by, changed_by_email, note)
  values
    (p_scope, 'revert', v_snapshot, auth.uid(), v_admin_email,
     'Revert to history ID ' || p_history_id::text);
end;
$$;

grant execute on function public.fn_revert_pricing_config(text, uuid)
  to authenticated;

-- ============================================================
-- 5. Default değerler — mevcut constants.ts'ten kopyala
-- ============================================================

-- STICKER scope
insert into public.pricing_config (scope, draft_config, live_config)
values (
  'sticker',
  '{
    "production": {
      "mode": "fason",
      "fasonRate": 0.40
    },
    "operation": {
      "setup": 50,
      "packaging": 0.01,
      "cargo": 80,
      "feePct": 2.5
    },
    "margin": {
      "marginPct": 50,
      "vatPct": 20,
      "minMarkupFraction": 0.10
    },
    "tiers": [
      { "qty": 25, "multiplier": 1.30, "label": "+%30 zam" },
      { "qty": 50, "multiplier": 1.20, "label": "+%20 zam" },
      { "qty": 100, "multiplier": 1.10, "label": "+%10 zam" },
      { "qty": 250, "multiplier": 1.00, "label": "referans" },
      { "qty": 500, "multiplier": 0.90, "label": "-%10 indirim" },
      { "qty": 1000, "multiplier": 0.80, "label": "-%20 indirim" }
    ]
  }'::jsonb,
  '{
    "production": {
      "mode": "fason",
      "fasonRate": 0.40
    },
    "operation": {
      "setup": 50,
      "packaging": 0.01,
      "cargo": 80,
      "feePct": 2.5
    },
    "margin": {
      "marginPct": 50,
      "vatPct": 20,
      "minMarkupFraction": 0.10
    },
    "tiers": [
      { "qty": 25, "multiplier": 1.30, "label": "+%30 zam" },
      { "qty": 50, "multiplier": 1.20, "label": "+%20 zam" },
      { "qty": 100, "multiplier": 1.10, "label": "+%10 zam" },
      { "qty": 250, "multiplier": 1.00, "label": "referans" },
      { "qty": 500, "multiplier": 0.90, "label": "-%10 indirim" },
      { "qty": 1000, "multiplier": 0.80, "label": "-%20 indirim" }
    ]
  }'::jsonb
) on conflict (scope) do nothing;

-- ETIKET scope (multiplier'lar dahil)
insert into public.pricing_config (scope, draft_config, live_config)
values (
  'etiket',
  '{
    "production": {
      "mode": "fason",
      "fasonRate": 0.35
    },
    "operation": {
      "setup": 80,
      "packaging": 0.015,
      "cargo": 80,
      "feePct": 2.5
    },
    "margin": {
      "marginPct": 50,
      "vatPct": 20,
      "minMarkupFraction": 0.10
    },
    "tiers": [
      { "qty": 1000, "multiplier": 1.10, "label": "+%10 zam" },
      { "qty": 2000, "multiplier": 1.05, "label": "+%5 zam" },
      { "qty": 5000, "multiplier": 1.00, "label": "referans" },
      { "qty": 10000, "multiplier": 0.95, "label": "-%5 indirim" },
      { "qty": 20000, "multiplier": 0.90, "label": "-%10 indirim" },
      { "qty": 50000, "multiplier": 0.82, "label": "-%18 indirim" }
    ],
    "materials": [
      { "id": "kraft", "name": "Kraft", "desc": "Doğal, dokunsal", "multiplier": 1.00 },
      { "id": "kuse", "name": "Kuşe", "desc": "Mat kaplamalı baskı kağıdı", "multiplier": 1.05 },
      { "id": "beyaz", "name": "Beyaz semi-glos", "desc": "Klasik, parlak", "multiplier": 1.10 },
      { "id": "ultra", "name": "Ultra clear", "desc": "Şeffaf cam etkisi", "multiplier": 1.35 },
      { "id": "metalik", "name": "Metalik", "desc": "Folyo gümüş", "multiplier": 1.60 }
    ],
    "coatings": [
      { "id": "yok", "name": "Kaplamasız", "desc": "Kâğıt dokusu kalsın", "multiplier": 1.00 },
      { "id": "mat", "name": "Mat selefon", "desc": "Yansımasız, premium", "multiplier": 1.15 },
      { "id": "parlak", "name": "Parlak selefon", "desc": "Canlı, temiz", "multiplier": 1.15 },
      { "id": "soft", "name": "Soft touch", "desc": "Velvet his", "multiplier": 1.30 }
    ],
    "customizations": [
      { "id": "yok", "name": "Özelleştirme yok", "desc": "Sade baskı", "multiplier": 1.00 },
      { "id": "emboss", "name": "Kabartma (emboss)", "desc": "Logo/metin kabartması", "multiplier": 1.30 },
      { "id": "yaldiz", "name": "Sıcak yaldız", "desc": "Folyo baskı, premium parıltı", "multiplier": 1.50 },
      { "id": "spotuv", "name": "Spot UV", "desc": "Parlak nokta vurgu", "multiplier": 1.25 }
    ]
  }'::jsonb,
  '{
    "production": {
      "mode": "fason",
      "fasonRate": 0.35
    },
    "operation": {
      "setup": 80,
      "packaging": 0.015,
      "cargo": 80,
      "feePct": 2.5
    },
    "margin": {
      "marginPct": 50,
      "vatPct": 20,
      "minMarkupFraction": 0.10
    },
    "tiers": [
      { "qty": 1000, "multiplier": 1.10, "label": "+%10 zam" },
      { "qty": 2000, "multiplier": 1.05, "label": "+%5 zam" },
      { "qty": 5000, "multiplier": 1.00, "label": "referans" },
      { "qty": 10000, "multiplier": 0.95, "label": "-%5 indirim" },
      { "qty": 20000, "multiplier": 0.90, "label": "-%10 indirim" },
      { "qty": 50000, "multiplier": 0.82, "label": "-%18 indirim" }
    ],
    "materials": [
      { "id": "kraft", "name": "Kraft", "desc": "Doğal, dokunsal", "multiplier": 1.00 },
      { "id": "kuse", "name": "Kuşe", "desc": "Mat kaplamalı baskı kağıdı", "multiplier": 1.05 },
      { "id": "beyaz", "name": "Beyaz semi-glos", "desc": "Klasik, parlak", "multiplier": 1.10 },
      { "id": "ultra", "name": "Ultra clear", "desc": "Şeffaf cam etkisi", "multiplier": 1.35 },
      { "id": "metalik", "name": "Metalik", "desc": "Folyo gümüş", "multiplier": 1.60 }
    ],
    "coatings": [
      { "id": "yok", "name": "Kaplamasız", "desc": "Kâğıt dokusu kalsın", "multiplier": 1.00 },
      { "id": "mat", "name": "Mat selefon", "desc": "Yansımasız, premium", "multiplier": 1.15 },
      { "id": "parlak", "name": "Parlak selefon", "desc": "Canlı, temiz", "multiplier": 1.15 },
      { "id": "soft", "name": "Soft touch", "desc": "Velvet his", "multiplier": 1.30 }
    ],
    "customizations": [
      { "id": "yok", "name": "Özelleştirme yok", "desc": "Sade baskı", "multiplier": 1.00 },
      { "id": "emboss", "name": "Kabartma (emboss)", "desc": "Logo/metin kabartması", "multiplier": 1.30 },
      { "id": "yaldiz", "name": "Sıcak yaldız", "desc": "Folyo baskı, premium parıltı", "multiplier": 1.50 },
      { "id": "spotuv", "name": "Spot UV", "desc": "Parlak nokta vurgu", "multiplier": 1.25 }
    ]
  }'::jsonb
) on conflict (scope) do nothing;

-- GLOBAL scope (gelecek kullanım için boş başlangıç)
insert into public.pricing_config (scope, draft_config, live_config)
values (
  'global',
  '{}'::jsonb,
  '{}'::jsonb
) on conflict (scope) do nothing;
