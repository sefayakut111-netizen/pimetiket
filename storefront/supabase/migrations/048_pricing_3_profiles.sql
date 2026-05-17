-- ============================================================
-- Pim Etiket — Migration 048: Fiyat Yönetimi 3 Profil Revize
--
-- Sefa 17 May v2: "Sticker / Rulo Etiket / Tabaka Etiket — 3 farklı
-- profil, ayrı özelleştirme setleri".
--
-- Değişiklikler:
--   1. pricing_config.scope check 4'e çıkar:
--      'sticker', 'etiket_rulo', 'etiket_tabaka', 'global'
--   2. Eski 'etiket' satırı silinir (rulo+tabaka olarak split)
--   3. Schema revize: materials.m2_cost_try + options jenerik yapı
--   4. Toplamsal % mantığı (multiplier yerine pct_add)
-- ============================================================

-- 1. Eski check constraint'i kaldır (ÖNCE)
alter table public.pricing_config
  drop constraint if exists pricing_config_scope_check;
alter table public.pricing_config_history
  drop constraint if exists pricing_config_history_scope_check;

-- 2. Eski 'etiket' satırını sil (SONRA, constraint yok artık)
delete from public.pricing_config where scope = 'etiket';
delete from public.pricing_config_history where scope = 'etiket';

-- 3. Yeni check constraint (4 değer) — şimdi tüm satırlar uyumlu
alter table public.pricing_config
  add constraint pricing_config_scope_check
  check (scope in ('sticker', 'etiket_rulo', 'etiket_tabaka', 'global'));

alter table public.pricing_config_history
  add constraint pricing_config_history_scope_check
  check (scope in ('sticker', 'etiket_rulo', 'etiket_tabaka', 'global'));

-- 4. STICKER scope — yeni schema ile güncelle (m² + options)
update public.pricing_config
set
  draft_config = '{
    "materials": [
      { "id": "vinil",      "name": "Vinil",      "m2_cost_try": 500,  "desc": "Standart vinil, parlak yüzey, açıkhava dayanımlı" },
      { "id": "opak",       "name": "Opak",       "m2_cost_try": 600,  "desc": "Arkadan ışık geçirmez beyaz vinil" },
      { "id": "seffaf",     "name": "Şeffaf",     "m2_cost_try": 700,  "desc": "Cam üstü görünmez sticker" },
      { "id": "holografik", "name": "Holografik", "m2_cost_try": 1200, "desc": "Yansıtıcı, prizmatik efekt" },
      { "id": "metalik",    "name": "Metalik",    "m2_cost_try": 1500, "desc": "Krom efekti, premium görünüm" }
    ],
    "options": {
      "finish": {
        "label": "Finiş",
        "required": true,
        "single_select": true,
        "items": [
          { "id": "parlak", "name": "Parlak",   "pct_add": 0,  "desc": "Standart parlak yüzey" },
          { "id": "mat",    "name": "Mat",      "pct_add": 10, "desc": "Yansıma yapmaz, premium his" }
        ]
      }
    },
    "tiers": [
      { "qty": 25,   "multiplier": 1.30, "label": "+%30 zam" },
      { "qty": 50,   "multiplier": 1.20, "label": "+%20 zam" },
      { "qty": 100,  "multiplier": 1.10, "label": "+%10 zam" },
      { "qty": 250,  "multiplier": 1.00, "label": "referans" },
      { "qty": 500,  "multiplier": 0.90, "label": "-%10 indirim" },
      { "qty": 1000, "multiplier": 0.80, "label": "-%20 indirim" }
    ],
    "operation": {
      "setup": 50,
      "packaging_per_unit": 0.01,
      "cargo": 80,
      "fee_pct": 2.5
    },
    "margin": { "pct": 50 },
    "vat": { "pct": 20 }
  }'::jsonb,
  live_config = draft_config
where scope = 'sticker';

-- 5. ETİKET RULO insert (en zengin set: 5 malzeme + 4 kaplama + 3 özelleştirme)
insert into public.pricing_config (scope, draft_config, live_config)
values (
  'etiket_rulo',
  '{
    "materials": [
      { "id": "kraft",   "name": "Kraft",          "m2_cost_try": 300, "desc": "Doğal, dokunsal, eko" },
      { "id": "kuse",    "name": "Kuşe",           "m2_cost_try": 350, "desc": "Mat kaplamalı baskı kağıdı" },
      { "id": "beyaz",   "name": "Beyaz semi-glos","m2_cost_try": 400, "desc": "Klasik, parlak yüzey" },
      { "id": "ultra",   "name": "Ultra clear",    "m2_cost_try": 600, "desc": "Şeffaf cam etkisi" },
      { "id": "metalik", "name": "Metalik",        "m2_cost_try": 900, "desc": "Folyo gümüş" }
    ],
    "options": {
      "coating": {
        "label": "Kaplama",
        "required": true,
        "single_select": true,
        "items": [
          { "id": "yok",    "name": "Kaplamasız",     "pct_add": 0,  "desc": "Kağıt dokusu kalsın" },
          { "id": "mat",    "name": "Mat selefon",    "pct_add": 15, "desc": "Yansımasız, premium" },
          { "id": "parlak", "name": "Parlak selefon", "pct_add": 15, "desc": "Canlı, temiz" },
          { "id": "soft",   "name": "Soft touch",     "pct_add": 30, "desc": "Velvet his, lüks" }
        ]
      },
      "customization": {
        "label": "Özelleştirme",
        "required": false,
        "single_select": false,
        "items": [
          { "id": "emboss",  "name": "Emboss (Kabartma)", "pct_add": 30, "desc": "Logo/metin kabartması" },
          { "id": "yaldiz",  "name": "Sıcak yaldız",     "pct_add": 50, "desc": "Folyo baskı, premium parıltı" },
          { "id": "spot_uv", "name": "Spot UV",          "pct_add": 25, "desc": "Parlak nokta vurgu" }
        ]
      }
    },
    "tiers": [
      { "qty": 1000,  "multiplier": 1.10, "label": "+%10 zam" },
      { "qty": 2000,  "multiplier": 1.05, "label": "+%5 zam" },
      { "qty": 5000,  "multiplier": 1.00, "label": "referans" },
      { "qty": 10000, "multiplier": 0.95, "label": "-%5 indirim" },
      { "qty": 20000, "multiplier": 0.90, "label": "-%10 indirim" },
      { "qty": 50000, "multiplier": 0.82, "label": "-%18 indirim" }
    ],
    "operation": {
      "setup": 80,
      "packaging_per_unit": 0.015,
      "cargo": 80,
      "fee_pct": 2.5
    },
    "margin": { "pct": 50 },
    "vat": { "pct": 20 }
  }'::jsonb,
  '{
    "materials": [
      { "id": "kraft",   "name": "Kraft",          "m2_cost_try": 300, "desc": "Doğal, dokunsal, eko" },
      { "id": "kuse",    "name": "Kuşe",           "m2_cost_try": 350, "desc": "Mat kaplamalı baskı kağıdı" },
      { "id": "beyaz",   "name": "Beyaz semi-glos","m2_cost_try": 400, "desc": "Klasik, parlak yüzey" },
      { "id": "ultra",   "name": "Ultra clear",    "m2_cost_try": 600, "desc": "Şeffaf cam etkisi" },
      { "id": "metalik", "name": "Metalik",        "m2_cost_try": 900, "desc": "Folyo gümüş" }
    ],
    "options": {
      "coating": {
        "label": "Kaplama",
        "required": true,
        "single_select": true,
        "items": [
          { "id": "yok",    "name": "Kaplamasız",     "pct_add": 0,  "desc": "Kağıt dokusu kalsın" },
          { "id": "mat",    "name": "Mat selefon",    "pct_add": 15, "desc": "Yansımasız, premium" },
          { "id": "parlak", "name": "Parlak selefon", "pct_add": 15, "desc": "Canlı, temiz" },
          { "id": "soft",   "name": "Soft touch",     "pct_add": 30, "desc": "Velvet his, lüks" }
        ]
      },
      "customization": {
        "label": "Özelleştirme",
        "required": false,
        "single_select": false,
        "items": [
          { "id": "emboss",  "name": "Emboss (Kabartma)", "pct_add": 30, "desc": "Logo/metin kabartması" },
          { "id": "yaldiz",  "name": "Sıcak yaldız",     "pct_add": 50, "desc": "Folyo baskı, premium parıltı" },
          { "id": "spot_uv", "name": "Spot UV",          "pct_add": 25, "desc": "Parlak nokta vurgu" }
        ]
      }
    },
    "tiers": [
      { "qty": 1000,  "multiplier": 1.10, "label": "+%10 zam" },
      { "qty": 2000,  "multiplier": 1.05, "label": "+%5 zam" },
      { "qty": 5000,  "multiplier": 1.00, "label": "referans" },
      { "qty": 10000, "multiplier": 0.95, "label": "-%5 indirim" },
      { "qty": 20000, "multiplier": 0.90, "label": "-%10 indirim" },
      { "qty": 50000, "multiplier": 0.82, "label": "-%18 indirim" }
    ],
    "operation": {
      "setup": 80,
      "packaging_per_unit": 0.015,
      "cargo": 80,
      "fee_pct": 2.5
    },
    "margin": { "pct": 50 },
    "vat": { "pct": 20 }
  }'::jsonb
);

-- 6. ETİKET TABAKA insert (kısıtlı: 3 malzeme + 3 kaplama, customization YOK)
insert into public.pricing_config (scope, draft_config, live_config)
values (
  'etiket_tabaka',
  '{
    "materials": [
      { "id": "kraft", "name": "Kraft",          "m2_cost_try": 280, "desc": "Doğal, dokunsal, eko" },
      { "id": "kuse",  "name": "Kuşe",           "m2_cost_try": 320, "desc": "Mat kaplamalı baskı kağıdı" },
      { "id": "beyaz", "name": "Beyaz semi-glos","m2_cost_try": 380, "desc": "Klasik, parlak yüzey" }
    ],
    "options": {
      "coating": {
        "label": "Kaplama",
        "required": true,
        "single_select": true,
        "items": [
          { "id": "yok",    "name": "Kaplamasız",     "pct_add": 0,  "desc": "Kağıt dokusu kalsın" },
          { "id": "mat",    "name": "Mat selefon",    "pct_add": 15, "desc": "Yansımasız, premium" },
          { "id": "parlak", "name": "Parlak selefon", "pct_add": 15, "desc": "Canlı, temiz" }
        ]
      }
    },
    "tiers": [
      { "qty": 250,   "multiplier": 1.15, "label": "+%15 zam" },
      { "qty": 500,   "multiplier": 1.08, "label": "+%8 zam" },
      { "qty": 1000,  "multiplier": 1.00, "label": "referans" },
      { "qty": 2500,  "multiplier": 0.95, "label": "-%5 indirim" },
      { "qty": 5000,  "multiplier": 0.90, "label": "-%10 indirim" },
      { "qty": 10000, "multiplier": 0.85, "label": "-%15 indirim" }
    ],
    "operation": {
      "setup": 60,
      "packaging_per_unit": 0.02,
      "cargo": 80,
      "fee_pct": 2.5
    },
    "margin": { "pct": 50 },
    "vat": { "pct": 20 }
  }'::jsonb,
  '{
    "materials": [
      { "id": "kraft", "name": "Kraft",          "m2_cost_try": 280, "desc": "Doğal, dokunsal, eko" },
      { "id": "kuse",  "name": "Kuşe",           "m2_cost_try": 320, "desc": "Mat kaplamalı baskı kağıdı" },
      { "id": "beyaz", "name": "Beyaz semi-glos","m2_cost_try": 380, "desc": "Klasik, parlak yüzey" }
    ],
    "options": {
      "coating": {
        "label": "Kaplama",
        "required": true,
        "single_select": true,
        "items": [
          { "id": "yok",    "name": "Kaplamasız",     "pct_add": 0,  "desc": "Kağıt dokusu kalsın" },
          { "id": "mat",    "name": "Mat selefon",    "pct_add": 15, "desc": "Yansımasız, premium" },
          { "id": "parlak", "name": "Parlak selefon", "pct_add": 15, "desc": "Canlı, temiz" }
        ]
      }
    },
    "tiers": [
      { "qty": 250,   "multiplier": 1.15, "label": "+%15 zam" },
      { "qty": 500,   "multiplier": 1.08, "label": "+%8 zam" },
      { "qty": 1000,  "multiplier": 1.00, "label": "referans" },
      { "qty": 2500,  "multiplier": 0.95, "label": "-%5 indirim" },
      { "qty": 5000,  "multiplier": 0.90, "label": "-%10 indirim" },
      { "qty": 10000, "multiplier": 0.85, "label": "-%15 indirim" }
    ],
    "operation": {
      "setup": 60,
      "packaging_per_unit": 0.02,
      "cargo": 80,
      "fee_pct": 2.5
    },
    "margin": { "pct": 50 },
    "vat": { "pct": 20 }
  }'::jsonb
);

-- 7. Schema dokümantasyonu comment olarak
comment on table public.pricing_config is
  'Fiyat yönetimi — 4 scope (sticker/etiket_rulo/etiket_tabaka/global). '
  'Schema v2 (Migration 048): materials.m2_cost_try + options.{group}.items[].pct_add. '
  'Müşteri sayfası LIVE okur, admin DRAFT''ta çalışır, "Canlıya yayınla" ile aktarır.';
