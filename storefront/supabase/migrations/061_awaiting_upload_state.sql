-- ============================================================
-- Migration 061 — awaiting_upload state + revised paid trigger
-- ============================================================
-- Sefa 19 May v68 (E2E akış kapsama):
-- Önceki davranış: paid → her durumda proof_pending (Migration 059 trigger).
-- Sorun: müşteri sepete tasarımsız ürün koyup ödeme yapabiliyor; ödeme sonrası
--   proof_pending olarak /onay sayfasına yönlendiriliyor ama gösterecek tasarım
--   yok. Pim "kesim çizgisi hazırlanıyor" placeholder gösteriyor sonsuza dek.
--
-- Yeni davranış:
--   paid + tasarım YOK   → awaiting_upload  (müşteri /siparis/[id]/tasarim-yukle'ye)
--   paid + tasarım VAR   → proof_pending    (Migration 059 davranışı, /onay)
--   awaiting_upload + ilk design_files INSERT → proof_pending (otomatik geçiş)
--
-- Bu, "ödeme yaptım, sonra yüklerim" akışını destekler.

-- ============================================================
-- 1) ENUM: order_status'a 'awaiting_upload' ekle
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'awaiting_upload'
      and enumtypid = 'public.order_status'::regtype
  ) then
    alter type public.order_status add value 'awaiting_upload' before 'qc_pending';
  end if;
end $$;

-- ============================================================
-- 2) HELPER: order'ın en az 1 yüklü tasarım dosyası var mı?
-- ============================================================
-- design_files tablosu Migration 003'te kuruldu. Burada bir order için
-- "uploaded" veya daha ileri statüdeki en az 1 dosya var mı kontrol edilir.
-- ("superseded" sayılmaz — eski versiyon)
create or replace function public.fn_order_has_design(p_order_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.design_files
    where order_id = p_order_id
      and status in (
        'uploaded',
        'qc_running',
        'qc_warned',
        'qc_passed',
        'approved'
        -- qc_failed: müşterinin yeniden yüklemesi gerek; sayılmaz
        -- superseded: eski versiyon; sayılmaz
      )
  );
$$;

comment on function public.fn_order_has_design is
  'Bir order için kullanılabilir (uploaded/qc_*/approved) tasarım var mı? '
  'paid→awaiting_upload/proof_pending dallanmasında kullanılır.';

-- ============================================================
-- 3) TRIGGER REVIZE: paid → awaiting_upload veya proof_pending
-- ============================================================
-- Önceki: Migration 059 fn_auto_advance_to_proof_pending — koşulsuz proof_pending.
-- Yeni: tasarım yoksa awaiting_upload, varsa proof_pending.
create or replace function public.fn_auto_advance_to_proof_pending()
returns trigger
language plpgsql
security definer
as $$
declare
  v_has_design boolean;
begin
  -- Sadece status paid'e yeni geçtiyse tetikle (idempotent)
  if (TG_OP = 'UPDATE' and OLD.status <> 'paid' and NEW.status = 'paid')
     or (TG_OP = 'INSERT' and NEW.status = 'paid') then

    -- Order item'ı olmayan sipariş bu trigger'da kalmaz (geçersiz state)
    if not exists (select 1 from public.order_items where order_id = NEW.id) then
      return NEW;
    end if;

    -- Tasarım var mı?
    v_has_design := public.fn_order_has_design(NEW.id);

    if v_has_design then
      NEW.status := 'proof_pending';
    else
      NEW.status := 'awaiting_upload';
    end if;
  end if;
  return NEW;
end;
$$;

-- Trigger zaten orders üzerinde kurulu (Migration 059). Re-create gerekmez.

-- ============================================================
-- 4) DESIGN_FILES INSERT TRIGGER: awaiting_upload → proof_pending
-- ============================================================
-- Müşteri /tasarim-yukle sayfasında ilk dosyayı yüklediğinde otomatik
-- proof_pending'e geçer. Eğer order zaten proof_pending veya sonrasında
-- ise dokunmaz.
create or replace function public.fn_design_uploaded_advance_status()
returns trigger
language plpgsql
security definer
as $$
declare
  v_current_status public.order_status;
begin
  if TG_OP = 'INSERT' and NEW.status in ('uploaded', 'qc_running', 'qc_warned', 'qc_passed') then
    select status into v_current_status from public.orders where id = NEW.order_id;
    if v_current_status = 'awaiting_upload' then
      update public.orders
        set status = 'proof_pending', updated_at = now()
        where id = NEW.order_id and status = 'awaiting_upload';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_design_uploaded_advance_status on public.design_files;
create trigger trg_design_uploaded_advance_status
  after insert on public.design_files
  for each row
  execute function public.fn_design_uploaded_advance_status();

comment on function public.fn_design_uploaded_advance_status is
  'awaiting_upload durumundaki order için ilk design_files INSERT''i proof_pending''e geçirir.';

-- ============================================================
-- 5) ORDER_EVENTS — geçişleri logla
-- ============================================================
-- proof_pending → ... ve awaiting_upload → proof_pending arasındaki state
-- değişimleri için ayrı bir event çıkarmıyoruz; mevcut order audit
-- (Migration 052) status değişimlerini yakalar.

-- ============================================================
-- ROLLBACK NOTU
-- ============================================================
-- Postgres'te enum value REMOVE sadece v15+ destekli ve riskli.
-- Bu migration'ı rollback için: trigger fonksiyonlarını Mig 059 haline
-- döndür, awaiting_upload satırları manuel proof_pending'e çek.
