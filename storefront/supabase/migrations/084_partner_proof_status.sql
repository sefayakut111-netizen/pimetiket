-- ============================================================
-- Migration 084 — Partner Proof States
-- Sefa 23 May v68
-- ============================================================
-- Amaç: order_items.proof_status'a partner karar durumları ekle.
--
-- Mevcut state (Mig 059):
--   pending, viewed, approved, editing, edited, help_requested
--   (müşteri perspektifi)
--
-- Yeni state'ler (partner perspektifi):
--   partner_review  — admin partner'a atadı, partner tasarımı henüz görmedi
--   partner_approved — partner onayladı, üretim başlayabilir
--   partner_rejected — partner reddetti, admin loop'una geri
--   partner_revised  — partner editör/dosya ile revize etti, müşteri loop'una
--
-- Akış (mevcut + yeni):
--   customer_approved (proof_status='approved')
--     → admin partner ata → partner_review
--     → partner aksiyonu:
--        ├─ approve → partner_approved → orders.status='in_production'
--        ├─ reject  → partner_rejected → assignment.cancelled, admin loop
--        └─ revise  → partner_revised  → tekrar customer_approved akışına
--                     (yeni design_files version, müşteri tekrar görsün)
--
-- Geriye uyumluluk: mevcut müşteri akışı bozulmaz (yeni state'ler
-- eklendi, eskiler silinmedi).
-- ============================================================

-- 1) Mevcut CHECK constraint'i drop et
alter table public.order_items
  drop constraint if exists order_items_proof_status_check;

-- 2) Genişletilmiş CHECK constraint
alter table public.order_items
  add constraint order_items_proof_status_check
  check (proof_status in (
    -- Müşteri perspektifi (Mig 059)
    'pending',
    'viewed',
    'approved',
    'editing',
    'edited',
    'help_requested',
    -- Partner perspektifi (Mig 084)
    'partner_review',
    'partner_approved',
    'partner_rejected',
    'partner_revised'
  ));

-- 3) Partner kararı kim verdi, ne zaman, hangi sebeple — audit alanları
alter table public.order_items
  add column if not exists partner_decided_by uuid references auth.users(id) on delete set null,
  add column if not exists partner_decided_at timestamptz,
  add column if not exists partner_decision_note text;

create index if not exists order_items_partner_decided_idx
  on public.order_items(partner_decided_by, partner_decided_at desc)
  where partner_decided_by is not null;

-- 4) design_files.revised_by_partner_id — partner Mod B yüklediği dosyalar
-- (P5'te kullanılacak ama schema burada hazırlansın)
alter table public.design_files
  add column if not exists revised_by_partner_id uuid references public.fason_partners(id) on delete set null,
  add column if not exists revised_at timestamptz;

create index if not exists design_files_partner_revised_idx
  on public.design_files(revised_by_partner_id, revised_at desc)
  where revised_by_partner_id is not null;

-- ============================================================
-- Migration sonu
-- ============================================================
-- Rollback:
--   alter table public.order_items
--     drop column if exists partner_decided_by,
--     drop column if exists partner_decided_at,
--     drop column if exists partner_decision_note;
--   alter table public.design_files
--     drop column if exists revised_by_partner_id,
--     drop column if exists revised_at;
--   alter table public.order_items
--     drop constraint if exists order_items_proof_status_check;
--   alter table public.order_items
--     add constraint order_items_proof_status_check
--     check (proof_status in (
--       'pending','viewed','approved','editing','edited','help_requested'
--     ));
