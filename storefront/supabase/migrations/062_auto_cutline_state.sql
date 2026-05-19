-- ============================================================
-- Migration 062 — proof_generating + auto cutline status
-- ============================================================
-- Sefa 19 May v68 (E2E akış — B öbeği server/background cutline):
-- Müşteri /onay sayfasına geldiğinde tasarım var ama cutline yok ise,
-- POC headless iframe (B1+B2) tetiklenir; cutline üretilir + save-edit
-- ile yazılır. Yeni cutline_designs.status değeri 'auto_generated'
-- (müşteri henüz manual oynatmadı, ama otomasyon hazırlamış).
--
-- Yeni order state: proof_generating
--   awaiting_upload → (tasarım yüklendi) → proof_generating
--   proof_generating → (auto-cutline yazıldı) → proof_pending
-- Bu state müşteriye "5 dakika içinde önizlemen hazır olacak" mesajı
-- gösterir. SLA timer + skeleton UI bu state'e bağlanır.

-- ============================================================
-- 1) cutline_designs.status — 'auto_generated' değerini ekle
-- ============================================================
-- Tablo CHECK constraint kullanıyor (text + check in (...)), enum değil.
-- Constraint'i revize et.
alter table public.cutline_designs
  drop constraint if exists cutline_designs_status_check;

alter table public.cutline_designs
  add constraint cutline_designs_status_check
  check (status in (
    'auto_generated',   -- Yeni: backend/headless üretti, müşteri henüz görmedi
    'draft',            -- Müşteri düzenledi (save-edit), henüz onaylamadı
    'approved',         -- Müşteri onayladı (fn_finalize_proof)
    'operator_override',-- Operatör değiştirdi
    'superseded'        -- Daha yeni bir kayıt var
  ));

comment on column public.cutline_designs.status is
  'Lifecycle: auto_generated → draft (müşteri düzenleyince) → approved (onay) '
  '→ operator_override (operatör değişimi) | superseded (yeni kayıt geldi).';

-- ============================================================
-- 2) order_status — proof_generating zaten var (Mig 039), trigger revize
-- ============================================================
-- Mig 061 fn_design_uploaded_advance_status awaiting_upload → proof_pending
-- yapıyordu. Şimdi: awaiting_upload → proof_generating (cutline bekliyor).
-- Auto cutline yazılınca proof_generating → proof_pending'e geçer
-- (yeni fn_advance_after_cutline trigger ile).

create or replace function public.fn_design_uploaded_advance_status()
returns trigger
language plpgsql
security definer
as $$
declare
  v_current_status public.order_status;
begin
  if TG_OP = 'INSERT' and NEW.status in ('uploaded', 'analyzing', 'qc_warned', 'qc_passed') then
    select status into v_current_status from public.orders where id = NEW.order_id;
    if v_current_status = 'awaiting_upload' then
      -- Mig 062: artık proof_generating'e geçer, otomatik cutline beklenir
      update public.orders
        set status = 'proof_generating', updated_at = now()
        where id = NEW.order_id and status = 'awaiting_upload';
    end if;
  end if;
  return NEW;
end;
$$;

-- ============================================================
-- 3) AUTO-ADVANCE: cutline_designs INSERT → proof_pending
-- ============================================================
-- Her cutline_designs INSERT'inde, eğer order proof_generating durumunda
-- ise proof_pending'e geçir. Müşteri artık /onay sayfasında önizleme görür.
--
-- NOT: draft / auto_generated / approved hepsi sayar — herhangi bir
-- cutline yazılması "üretim hazır" demektir.
create or replace function public.fn_advance_after_cutline()
returns trigger
language plpgsql
security definer
as $$
declare
  v_current_status public.order_status;
begin
  if TG_OP = 'INSERT' then
    select status into v_current_status from public.orders where id = NEW.order_id;
    if v_current_status = 'proof_generating' then
      update public.orders
        set status = 'proof_pending', updated_at = now()
        where id = NEW.order_id and status = 'proof_generating';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_advance_after_cutline on public.cutline_designs;
create trigger trg_advance_after_cutline
  after insert on public.cutline_designs
  for each row
  execute function public.fn_advance_after_cutline();

comment on function public.fn_advance_after_cutline is
  'cutline_designs INSERT''i proof_generating → proof_pending''e geçirir. '
  'Müşteri /onay sayfasında bıçak hazır görür.';

-- ============================================================
-- 4) ORDER_EVENTS — proof_generating timer için sla_deadline kolonu
-- ============================================================
-- SLA: 5 dakika içinde proof_pending'e geçmeli. Bu deadline'ı orders
-- tablosuna sla_proof_deadline olarak yaz. Cron job veya admin alarm
-- bu deadline'ı izler.
alter table public.orders
  add column if not exists sla_proof_deadline timestamptz;

comment on column public.orders.sla_proof_deadline is
  'proof_generating state için 5 dakikalık SLA deadline. Otomatik cutline '
  'bu süre içinde tamamlanmazsa fason operatör alarm alır.';

-- Helper: proof_generating'e geçince deadline set et
create or replace function public.fn_set_proof_generating_deadline()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'UPDATE' and OLD.status <> 'proof_generating' and NEW.status = 'proof_generating') then
    NEW.sla_proof_deadline := now() + interval '5 minutes';
  end if;
  -- proof_pending'e geçince temizle (artık SLA'da değil)
  if (TG_OP = 'UPDATE' and OLD.status = 'proof_generating' and NEW.status = 'proof_pending') then
    NEW.sla_proof_deadline := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_set_proof_generating_deadline on public.orders;
create trigger trg_set_proof_generating_deadline
  before update of status on public.orders
  for each row
  execute function public.fn_set_proof_generating_deadline();

-- ============================================================
-- ROLLBACK NOTU
-- ============================================================
-- 1. Trigger'ları drop et.
-- 2. cutline_designs.status check'i Mig 059 haline döndür
--    (auto_generated → draft'a manual update).
-- 3. orders.sla_proof_deadline kolonunu drop et.
