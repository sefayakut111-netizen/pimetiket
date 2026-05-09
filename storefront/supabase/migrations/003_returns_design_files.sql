-- ============================================================
-- Pim Etiket — Migration 003
--
-- (1) returns        → İade talepleri (status: pending/approved/rejected/refunded)
-- (2) design_files   → Tasarım dosyası uploadları (versioning + AI flag'leri)
-- ============================================================

-- ---------- 1) returns ----------
create type public.return_status as enum (
  'pending',
  'approved',
  'rejected',
  'refunded'
);

create type public.return_reason as enum (
  'yanlis_urun',
  'uretim_hatasi',
  'kargo_hasari',
  'kalite_problemi',
  'diger'
);

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Müşteri snapshot (auth gelene kadar customer_email vardı, şimdi user_id var
  -- ama denormalize edip tutuyoruz — auth değişse bile referans kalır)
  customer_name text not null,
  customer_email text not null,
  reason public.return_reason not null,
  description text not null check (length(description) >= 20),
  -- Müşterinin yüklediği görseller — design_files veya storage path array
  -- Şimdilik path string array (Supabase Storage'da iade-photos/ bucket'ında)
  attachments text[] not null default array[]::text[],
  status public.return_status not null default 'pending',
  -- Admin notu (red mesajı, onay açıklaması)
  admin_note text,
  -- İade tutarı (TL, KDV dahil)
  refund_amount numeric(10, 2) check (refund_amount is null or refund_amount >= 0),
  -- Refund payment kaydı (varsa)
  refund_payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists returns_user_id_idx on public.returns(user_id);
create index if not exists returns_order_id_idx on public.returns(order_id);
create index if not exists returns_status_idx on public.returns(status, created_at desc);

alter table public.returns enable row level security;

create policy "Users can view own returns"
  on public.returns for select
  using (auth.uid() = user_id);

create policy "Users can create own returns"
  on public.returns for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.orders o
      where o.id = returns.order_id
        and o.user_id = auth.uid()
    )
  );

-- UPDATE sadece service_role (admin onayı/reddi)

drop trigger if exists returns_updated_at on public.returns;
create trigger returns_updated_at
  before update on public.returns
  for each row
  execute function public.set_updated_at();

-- ---------- 2) design_files ----------
-- Tasarım dosyası upload tracking + versioning + AI ön-kontrol sonuçları.
-- Asıl dosya Supabase Storage'da `designs/<order_id>/<file_id>.<ext>`.
-- Bu tablo metadata + AI flag'leri tutar.
create type public.design_file_status as enum (
  'uploaded',          -- Yüklendi, AI kontrolü bekliyor
  'analyzing',         -- AI işliyor
  'qc_passed',         -- AI ön-kontrol geçti
  'qc_warned',         -- Uyarı var ama kullanılabilir
  'qc_failed',         -- Hata var, müşterinin yeniden göndermesi lazım
  'approved',          -- Operatör + müşteri prova onayladı, kilitli
  'superseded'         -- Yeni versiyon yüklendi, bu eski
);

create table if not exists public.design_files (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Order_item bağlantısı opsiyonel — bir sipariş içinde her item ayrı
  -- dosya gerekebilir; tek dosya tüm sipariş için de kullanılabilir.
  order_item_id uuid references public.order_items(id) on delete set null,
  -- Storage'daki path (designs/PE-2026-1234/<uuid>.pdf)
  storage_path text not null,
  -- Original dosya adı (müşterinin yüklediği "etiket-v3.pdf")
  original_name text not null,
  -- Boyut (byte) — limit kontrolü
  size_bytes bigint not null check (size_bytes > 0),
  -- MIME type — application/pdf, image/png, vs
  mime_type text not null,
  -- SHA-256 hash → duplicate detection + integrity
  sha256 text,
  -- Versiyon numarası (1, 2, 3 — aynı order_item_id için)
  version integer not null default 1,
  -- Status (yukarıdaki enum)
  status public.design_file_status not null default 'uploaded',
  -- AI ön-kontrol sonuçları (DPI, CMYK, bleed, safe zone)
  -- Format: { dpi: 320, cmyk: true, bleed_mm: 2, safe_zone_ok: true,
  --          flags: [{kind: 'ok'|'warning'|'error', message: '...'}] }
  ai_check jsonb default '{}'::jsonb,
  -- Operatör notu (manuel inceleme sonucu)
  operator_note text,
  -- Onaylandığı tarih (kilit zamanı)
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists design_files_order_id_idx
  on public.design_files(order_id);
create index if not exists design_files_user_id_idx
  on public.design_files(user_id);
create index if not exists design_files_status_idx
  on public.design_files(status, uploaded_at desc);
-- Aynı order_item için aktif (superseded olmayan) tek versiyon var
create unique index if not exists design_files_active_version
  on public.design_files(order_id, order_item_id, version)
  where order_item_id is not null;

alter table public.design_files enable row level security;

create policy "Users can view own design files"
  on public.design_files for select
  using (auth.uid() = user_id);

create policy "Users can upload own design files"
  on public.design_files for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.orders o
      where o.id = design_files.order_id
        and o.user_id = auth.uid()
    )
  );

-- Müşteri SADECE 'uploaded' status'undeki dosyayı silebilir (yeniden yükleme)
-- 'qc_*' veya sonrası → admin müdahale lazım
create policy "Users can delete own pending uploads"
  on public.design_files for delete
  using (
    auth.uid() = user_id
    and status in ('uploaded', 'qc_failed')
  );

drop trigger if exists design_files_updated_at on public.design_files;
create trigger design_files_updated_at
  before update on public.design_files
  for each row
  execute function public.set_updated_at();

-- Helper: yeni versiyon yüklendiğinde eskiyi 'superseded' yap
create or replace function public.fn_supersede_old_versions()
returns trigger
language plpgsql
as $$
begin
  if new.order_item_id is not null then
    update public.design_files
      set status = 'superseded'
      where order_id = new.order_id
        and order_item_id = new.order_item_id
        and id <> new.id
        and version < new.version
        and status not in ('approved', 'superseded');
  end if;
  return new;
end;
$$;

drop trigger if exists design_files_supersede on public.design_files;
create trigger design_files_supersede
  after insert on public.design_files
  for each row
  execute function public.fn_supersede_old_versions();
