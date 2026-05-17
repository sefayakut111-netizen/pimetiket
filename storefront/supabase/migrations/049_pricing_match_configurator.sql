-- ============================================================
-- Pim Etiket — Migration 049: Fiyat config'i konfigüratör listeleriyle eşle
--
-- Sefa 17 May v3: "bizde olan malzemelere göre olacak".
--
-- Migration 048'de admin paneline yanlış malzeme listeleri konmuştu.
-- Bu migration gerçek /sticker ve /etiket konfigüratör sayfalarındaki
-- ID'lerle eşitler.
--
-- Sticker (src/app/sticker/page.tsx):
--   MATERIAL_IDS = ["vinil", "transparan", "holo", "simli"]
--   FINISH_IDS   = ["parlak", "mat", "yok"]
--
-- Etiket (src/app/etiket/page.tsx):
--   MATERIALS (rulo+tabaka): kuse, kraft, beyaz (name: "Opak PP Etiket")
--   MATERIALS (sadece rulo): ultra, metalik
--   COATINGS (rulo+tabaka): yok, mat, parlak
--   COATINGS (sadece rulo):  soft
--   CUSTOMS  (sadece rulo):  yok, emboss, yaldiz, spotuv
--
-- Bu seed'de ID'ler ve name'ler birebir kopyalanır.
-- ============================================================

-- ============================================================
-- 1. STICKER — 4 malzeme + 3 finiş
-- ============================================================

update public.pricing_config
set
  draft_config = '{
    "materials": [
      { "id": "vinil",     "name": "Vinil",     "m2_cost_try": 500,  "desc": "Standart parlak vinil, açıkhava dayanımlı" },
      { "id": "transparan","name": "Transparan","m2_cost_try": 700,  "desc": "Şeffaf, cam üstü görünmez efekt" },
      { "id": "holo",      "name": "Holografik","m2_cost_try": 1200, "desc": "Yansıtıcı, prizmatik efekt" },
      { "id": "simli",     "name": "Simli",     "m2_cost_try": 1500, "desc": "Metalik gümüş/altın parıltı" }
    ],
    "options": {
      "finish": {
        "label": "Finiş",
        "required": true,
        "single_select": true,
        "items": [
          { "id": "yok",    "name": "Yok",    "pct_add": 0,  "desc": "Kaplama yok, ham yüzey" },
          { "id": "parlak", "name": "Parlak", "pct_add": 0,  "desc": "Standart parlak yüzey" },
          { "id": "mat",    "name": "Mat",    "pct_add": 10, "desc": "Yansımasız, premium his" }
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

-- ============================================================
-- 2. ETİKET RULO — 5 malzeme + 4 kaplama + 4 özelleştirme (yok dahil)
-- ============================================================

update public.pricing_config
set
  draft_config = '{
    "materials": [
      { "id": "kuse",    "name": "Kuşe Etiket",    "m2_cost_try": 350, "desc": "Mat kaplamalı baskı kağıdı" },
      { "id": "kraft",   "name": "Kraft Etiket",   "m2_cost_try": 300, "desc": "Doğal, dokunsal" },
      { "id": "beyaz",   "name": "Opak PP Etiket", "m2_cost_try": 400, "desc": "Klasik, dayanıklı, parlak" },
      { "id": "ultra",   "name": "Ultra clear",    "m2_cost_try": 600, "desc": "Şeffaf cam etkisi" },
      { "id": "metalik", "name": "Metalik",        "m2_cost_try": 900, "desc": "Folyo gümüş" }
    ],
    "options": {
      "coating": {
        "label": "Kaplama",
        "required": true,
        "single_select": true,
        "items": [
          { "id": "yok",    "name": "Kaplamasız",     "pct_add": 0,  "desc": "Kâğıt dokusu kalsın" },
          { "id": "mat",    "name": "Mat selefon",    "pct_add": 15, "desc": "Yansımasız, premium" },
          { "id": "parlak", "name": "Parlak selefon", "pct_add": 15, "desc": "Canlı, temiz" },
          { "id": "soft",   "name": "Soft touch",     "pct_add": 30, "desc": "Velvet his" }
        ]
      },
      "customization": {
        "label": "Özelleştirme",
        "required": false,
        "single_select": false,
        "items": [
          { "id": "yok",    "name": "Özelleştirme yok",   "pct_add": 0,  "desc": "Sade baskı (emboss/yaldız/spot UV yok)" },
          { "id": "emboss", "name": "Kabartma (emboss)",  "pct_add": 30, "desc": "Logo / metin kabartması" },
          { "id": "yaldiz", "name": "Sıcak yaldız",       "pct_add": 50, "desc": "Folyo baskı, premium parıltı" },
          { "id": "spotuv", "name": "Spot UV",            "pct_add": 25, "desc": "Parlak nokta vurgu" }
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
  live_config = draft_config
where scope = 'etiket_rulo';

-- ============================================================
-- 3. ETİKET TABAKA — 3 malzeme + 3 kaplama (özelleştirme yok)
-- ============================================================

update public.pricing_config
set
  draft_config = '{
    "materials": [
      { "id": "kuse",  "name": "Kuşe Etiket",    "m2_cost_try": 320, "desc": "Mat kaplamalı baskı kağıdı" },
      { "id": "kraft", "name": "Kraft Etiket",   "m2_cost_try": 280, "desc": "Doğal, dokunsal" },
      { "id": "beyaz", "name": "Opak PP Etiket", "m2_cost_try": 380, "desc": "Klasik, dayanıklı, parlak" }
    ],
    "options": {
      "coating": {
        "label": "Kaplama",
        "required": true,
        "single_select": true,
        "items": [
          { "id": "yok",    "name": "Kaplamasız",     "pct_add": 0,  "desc": "Kâğıt dokusu kalsın" },
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
  live_config = draft_config
where scope = 'etiket_tabaka';

-- ============================================================
-- Comment update
-- ============================================================

comment on table public.pricing_config is
  'Fiyat yönetimi (Migration 048 + 049). Schema v2: materials.m2_cost_try '
  '+ options.{group}.items[].pct_add. Material/option ID''leri konfigüratör '
  'sayfalarındaki MATERIAL_IDS / FINISH_IDS / COATINGS / CUSTOMS ile '
  'BİREBİR uyumlu (Sefa kuralı 17 May v3).';
