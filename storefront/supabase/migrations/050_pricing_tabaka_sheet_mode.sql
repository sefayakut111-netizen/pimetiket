-- ============================================================
-- Pim Etiket — Migration 050: Tabaka etiket sheet-based pricing
--
-- Sefa 17 May v7: "tabaka etikette m2 hesabı değil tabaka boyundan
-- hesaplama yapıyoruz, 1 adet tabaka fiyatından".
--
-- ÖNCEKİ (Migration 048 + 049):
--   etiket_tabaka.materials[*].m2_cost_try → ₺/m² fiyat
--   Hesap: m2_cost × area_m2 × qty (rulo ile aynı mantık — YANLIŞ)
--
-- YENİ (bu migration):
--   etiket_tabaka.pricing_mode = "sheet"
--   etiket_tabaka.materials[*].sheet_cost_try → ₺/tabaka (23×31 cm 1 tabaka)
--   Hesap: sheet_cost × sheets_needed (geometriden hesap)
--
-- Müşteri tarafında tabaka geometrisi (kaç adet 1 tabakaya sığar) zaten
-- /etiket sayfasında hesaplanıyor; pricing engine üzerine gelen sheets_needed
-- input'unu kullanır.
-- ============================================================

update public.pricing_config
set
  draft_config = '{
    "pricing_mode": "sheet",
    "materials": [
      { "id": "kuse",  "name": "Kuşe Etiket",    "sheet_cost_try": 22, "desc": "Mat kaplamalı baskı kağıdı (23×31 cm)" },
      { "id": "kraft", "name": "Kraft Etiket",   "sheet_cost_try": 20, "desc": "Doğal, dokunsal (23×31 cm)" },
      { "id": "beyaz", "name": "Opak PP Etiket", "sheet_cost_try": 27, "desc": "Klasik, dayanıklı, parlak (23×31 cm)" }
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
-- Audit log entry (history)
-- ============================================================

insert into public.pricing_config_history (scope, action, config_snapshot, changed_by_email, note)
select
  'etiket_tabaka'::text,
  'publish'::text,
  live_config,
  'system@migration'::text,
  'Migration 050: Tabaka m²→sheet mode (Sefa 17 May v7)'
from public.pricing_config
where scope = 'etiket_tabaka';

-- ============================================================
-- Comment update
-- ============================================================

comment on table public.pricing_config is
  'Fiyat yönetimi (Migration 048 + 049 + 050). Schema v3: '
  'pricing_mode ("area" | "sheet"), materials.m2_cost_try (area) ya da '
  'materials.sheet_cost_try (sheet — tabaka için). Options/tiers/operation '
  'aynı. Material/option ID''leri konfigüratör sayfalarındaki '
  'MATERIAL_IDS / FINISH_IDS / COATINGS / CUSTOMS ile birebir uyumlu.';
