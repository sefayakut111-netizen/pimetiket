-- ============================================================
-- Pim Etiket — Migration 032: Galeri Yönetim Sistemi
--
-- Sefa kararı 11 May (Madde 14):
--   "Galeri kısmındaki resimleri admin panelinden yükleyip yazıları
--    yazabileceğimiz ve sıralarını belirleyebileceğimiz sistem.
--    Resme tıklanınca büyür ve altındaki ayrıntılı yazıya ulaşılır.
--    Hangi ürün ve hangi özellikler olduğu yazılabilir ama ADETLER
--    yazmayacak."
--
-- Şu an /galeri sayfasında hardcoded 9 öğe var (src/app/galeri/page.tsx).
-- Bu migration ile DB'den okumaya geçilir; hardcoded fallback kalır.
--
-- Adet bilgisi YAZILMAZ — TKHK m.61 yanıltıcı reklam riski (fake
-- "1000 sipariş" tarzı sayılar olmasın). Sefa kuralı.
-- ============================================================

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  -- public-assets bucket içindeki path (örn "gallery/abc.jpg")
  image_path text not null,
  -- Başlık ve detay (Markdown YOK, düz metin)
  title text not null,
  body text,
  -- Hangi ürün kategorisi — etiket veya sticker
  product_type text not null
    check (product_type in ('etiket', 'sticker', 'mixed')),
  -- Hangi özellikler (vinyl/holografik/kraft + parlak/mat etc)
  -- Virgülle ayrılmış kısa liste
  features text,
  -- Sıralama (küçük = önce göster)
  sort_order integer not null default 0,
  -- Yayında mı (admin draft'ları tutabilsin)
  is_published boolean not null default true,
  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists gallery_items_published_order_idx
  on public.gallery_items(is_published, sort_order)
  where is_published = true;

create index if not exists gallery_items_product_idx
  on public.gallery_items(product_type, sort_order);

alter table public.gallery_items enable row level security;

-- Herkes yayındaki öğeleri görebilir (anasayfa + /galeri)
drop policy if exists "Anyone can view published gallery" on public.gallery_items;
create policy "Anyone can view published gallery"
  on public.gallery_items for select
  using (is_published = true);

-- INSERT/UPDATE/DELETE: sadece service_role (admin endpoint üzerinden)
-- Müşteri client'tan dokunamaz.

drop trigger if exists gallery_items_updated_at on public.gallery_items;
create trigger gallery_items_updated_at
  before update on public.gallery_items
  for each row execute function public.set_updated_at();

-- ============================================================
-- Migration 032 sonu
-- ============================================================
