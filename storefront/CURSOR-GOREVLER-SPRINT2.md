# Cursor Sprint 2 — Blog CMS + Destek + Bulk + Mail Preview + Kupon Analitik

> Claude Code (mimari) tarafından hazırlanmıştır.
> 5 görev, sırayla uygulanacak.

---

## GÖREV 1/5 — Blog CMS (`/admin/blog`) 

### Sorun
Blog yazıları `src/lib/blog-posts.ts` dosyasında hardcoded array. Admin'den eklenemez, düzenlenemez, yayından kaldırılamaz.

### Çözüm

**Adım 1: Migration** `supabase/migrations/099_blog_posts.sql`

```sql
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug varchar(120) not null unique,
  title_tr text not null,
  title_en text,
  body_tr text not null,
  body_en text,
  excerpt_tr text,
  excerpt_en text,
  category varchar(40) not null default 'genel',
  cover_image_url text,
  author_name varchar(100) default 'Pim Etiket',
  status varchar(20) not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  read_minutes integer default 3,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index blog_posts_status_idx on public.blog_posts(status, published_at desc);
create index blog_posts_slug_idx on public.blog_posts(slug);

alter table public.blog_posts enable row level security;

-- Public: sadece published olan yazılar okunabilir
create policy "Anyone reads published posts"
  on public.blog_posts for select to anon, authenticated
  using (status = 'published');

-- Admin: full CRUD
create policy "Admin manages blog posts"
  on public.blog_posts for all to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  ));

-- Mevcut hardcoded yazıları seed olarak ekle
insert into public.blog_posts (slug, title_tr, body_tr, excerpt_tr, category, status, read_minutes, published_at)
values
  ('sticker-tasarim-rehberi', 'Sticker Tasarım Rehberi: Sıfırdan Profesyonel Sonuç', 'Sticker tasarımı yaparken dikkat etmeniz gereken temel kurallar...', 'Profesyonel sticker tasarımı için adım adım rehber.', 'rehber', 'published', 5, now()),
  ('etiket-malzeme-secimi', 'Etiket Malzeme Seçimi: Hangi Malzeme Hangi İş İçin?', 'Kuşe, kraft, şeffaf, metalik... Her malzemenin kendine has özellikleri var...', 'Doğru malzeme seçimi için kapsamlı karşılaştırma.', 'rehber', 'published', 4, now()),
  ('cmyk-rgb-farki', 'CMYK ve RGB Farkı: Baskıda Renk Yönetimi', 'Ekranınızda gördüğünüz renk ile baskıdaki renk neden farklı?...', 'Dijital ve baskı renk uzayları arasındaki farkı anlayın.', 'teknik', 'published', 3, now()),
  ('kucuk-isletme-etiket', 'Küçük İşletmeler İçin Etiket Stratejisi', 'Butik üreticiysen etiketin marka algını nasıl değiştirir?...', 'Küçük markalar için etiket ve ambalaj stratejileri.', 'pazarlama', 'published', 4, now()),
  ('2026-etiket-trendleri', '2026 Etiket Trendleri', 'Bu yıl etiket dünyasında neler öne çıkıyor?...', 'Sürdürülebilirlik, minimalizm ve dijital entegrasyon.', 'trend', 'published', 3, now())
on conflict (slug) do nothing;
```

**Adım 2: API** `src/app/api/admin/blog/route.ts`

```typescript
// GET — tüm yazıları listele (draft dahil)
// assertPermission("content", "view") veya yeni "blog" modülü
// supabase.from("blog_posts").select("*").order("created_at", { ascending: false })

// POST — yeni yazı oluştur
// assertPermission("content", "create")
// Body: { slug, title_tr, body_tr, category, status, cover_image_url, ... }
// Slug otomatik üretim: title_tr → kebab-case (Türkçe karakter normalize)
// read_minutes otomatik hesapla: Math.max(1, Math.round(wordCount / 200))

// PATCH — yazı güncelle
// assertPermission("content", "update")
// Body: { id, ...fields }
// status 'published' yapılırsa published_at = now() (ilk kez)

// DELETE — yazı sil (veya archive)
// assertPermission("content", "delete")
```

**Adım 3: Admin sayfa** `src/app/admin/blog/page.tsx`

```
Sayfa yapısı:
┌──────────────────────────────────────────────────┐
│ Blog Yönetimi                    [+ Yeni Yazı]   │
├──────────────────────────────────────────────────┤
│ [Filtre: Tümü | Yayında | Taslak | Arşiv]       │
├──────────────────────────────────────────────────┤
│ [Tablo]                                           │
│  Başlık        | Kategori | Durum  | Tarih | İşlem│
│  Sticker Reh.. | rehber   | 🟢 yayında | 25.05 | [✏️ Düzenle] │
│  CMYK ve RGB.. | teknik   | 📝 taslak  | 25.05 | [✏️ Düzenle] │
├──────────────────────────────────────────────────┤
│ [Düzenle modal / ayrı sayfa]                      │
│  Başlık (TR): [_______________________]           │
│  Slug: [sticker-tasarim-rehberi]                  │
│  Kategori: [rehber ▼]                             │
│  Kapak görseli: [Yükle]                           │
│  İçerik (TR): [Markdown/plain textarea]           │
│  SEO başlık: [_______]                            │
│  SEO açıklama: [_______]                          │
│  [Taslak kaydet] [Yayınla]                        │
└──────────────────────────────────────────────────┘
```

**Adım 4: Müşteri tarafı güncelle**

`src/lib/blog-posts.ts` → hardcoded array'i DB'den fetch'e çevir:

```typescript
// ESKİ: const POSTS: BlogPost[] = [...]
// YENİ:
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return data ?? [];
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return data;
}
```

`src/app/blog/page.tsx` ve `src/app/blog/[slug]/page.tsx` → bu fonksiyonları kullanacak şekilde güncelle.

**Adım 5: Sidebar ekle**

`AdminShell.tsx` → İçerik grubuna ekle:

```typescript
{
  href: "/admin/blog",
  label: "Blog",
  icon: <Icon.Doc size={16} />,
  module: "content",
},
```

---

## GÖREV 2/5 — Genel Destek Sistemi (`/admin/destek`)

### Sorun
Sadece prova help ticket var (`/admin/yardim-talepleri`). Müşteri genel soru soramıyor — sadece prova onay sayfasından ticket açabiliyor.

### Çözüm

Mevcut `proof_help_requests` tablosunu genişletmek yerine, **yeni basit tablo** oluştur.

**Adım 1: Migration** `supabase/migrations/100_support_tickets.sql`

```sql
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  guest_email varchar(255),
  guest_name varchar(100),
  subject varchar(200) not null,
  message text not null,
  category varchar(30) not null default 'genel'
    check (category in ('genel', 'siparis', 'tasarim', 'kargo', 'iade', 'teknik', 'fiyat')),
  status varchar(20) not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  order_id text,
  admin_response text,
  admin_responded_by uuid references auth.users(id),
  admin_responded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index support_tickets_status_idx on public.support_tickets(status, created_at desc);
create index support_tickets_user_idx on public.support_tickets(user_id);

alter table public.support_tickets enable row level security;

-- Müşteri kendi ticket'larını görebilir
create policy "Customer reads own tickets"
  on public.support_tickets for select to authenticated
  using (user_id = auth.uid());

-- Müşteri yeni ticket açabilir
create policy "Customer creates ticket"
  on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid());

-- Anonim da açabilir (guest_email ile)
create policy "Anon creates ticket"
  on public.support_tickets for insert to anon
  with check (user_id is null and guest_email is not null);

-- Admin full access
create policy "Admin manages tickets"
  on public.support_tickets for all to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  ));
```

**Adım 2: Müşteri tarafı form**

`src/app/destek/page.tsx` — yeni sayfa:

```
┌──────────────────────────────────────────────┐
│ 🐦 Pim Destek                                │
│                                               │
│ Konu: [_________________________]             │
│ Kategori: [Genel ▼]                          │
│ Sipariş no (varsa): [________]               │
│ Mesajınız: [________________________]        │
│            [________________________]        │
│                                               │
│ [Gönder]                                      │
│                                               │
│ Veya: info@pimetiket.com · WhatsApp (yakında)│
└──────────────────────────────────────────────┘
```

Auth'lu kullanıcı → `user_id` otomatik. Guest → `guest_email` + `guest_name` alanları göster.

**Adım 3: API**

- `POST /api/support/create` — ticket oluştur
- `GET /api/support/my-tickets` — müşteri kendi ticket'ları
- `GET /api/admin/support` — admin liste (assertPermission)
- `PATCH /api/admin/support/[id]` — admin yanıt + status değiştir

**Adım 4: Admin sayfa** `src/app/admin/destek/page.tsx`

```
┌──────────────────────────────────────────────────┐
│ Destek Talepleri                                  │
├──────────────────────────────────────────────────┤
│ [Filtre: Açık(3) | İşlemde | Bekliyor | Çözüldü | Tümü] │
├──────────────────────────────────────────────────┤
│ [Tablo]                                           │
│  # | Konu          | Kategori | Müşteri | Tarih | Durum │
│  1 | Kargo gecikti | kargo    | Ali V.  | 25.05 | 🟡 açık │
│  2 | Renk farkı    | tasarim  | Zeynep  | 24.05 | 🔵 işlemde │
├──────────────────────────────────────────────────┤
│ [Detay panel — tıklanan ticket]                   │
│  Müşteri mesajı: "..."                            │
│  Sipariş: #00001234 (link)                        │
│  ─── Admin yanıtı ───                             │
│  [Yanıt textarea]                                 │
│  [Yanıtla + Çözüldü] [Yanıtla + Beklet]         │
└──────────────────────────────────────────────────┘
```

Yanıt verilince müşteriye otomatik mail (`mail_outbox` INSERT, template: `support_response`).

**Adım 5: Sidebar ekle**

`AdminShell.tsx` → Müşteri grubuna ekle:

```typescript
{
  href: "/admin/destek",
  label: "Destek",
  icon: <Icon.ChatBubble size={16} />,
  badge: supportOpenCount,   // yeni badge fetch
  badgeAccent: supportOpenCount > 0,
  module: "help_requests",
},
```

**Adım 6: Footer + iletişim sayfasına link**

`/iletisim` sayfasına ve footer'a "Destek talebi oluştur" linki ekle → `/destek`

---

## GÖREV 3/5 — Sipariş Toplu İşlem (Bulk Status)

### Sorun
`/admin/siparisler` sayfasında checkbox + bulk action bar var ama sadece "iptal et" çalışıyor. Toplu status değiştirme yok.

### Çözüm

**Adım 1: API** `src/app/api/admin/orders/bulk-status/route.ts`

```typescript
// POST — toplu status değiştir
// assertPermission("orders", "update")
// Body: { orderIds: string[], newStatus: string, reason?: string }
// Her sipariş için:
//   1. Mevcut status kontrolü (geçerli transition mı?)
//   2. UPDATE orders SET status = newStatus
//   3. INSERT order_events (actor_id, event_type: 'bulk_status_change')
// Response: { ok, updated: number, skipped: number, errors: string[] }
```

**Adım 2: `/admin/siparisler/page.tsx` bulk action bar güncelle**

Mevcut bulk bar'a status dropdown ekle:

```
[Seçili: 5 sipariş]  [Status değiştir ▼]  [İptal et]
                      ├── proof_approved
                      ├── ready_to_ship
                      ├── in_production
                      ├── shipped
                      └── cancelled
```

Onay modal'ı göster: "5 siparişin status'unu 'in_production' olarak değiştirmek istediğinize emin misiniz?"

Sadece **mantıklı geçişlere** izin ver — dropdown'da mevcut seçili siparişlerin status'una göre filtrele. Örn: `proof_pending` siparişler `shipped` yapılamaz.

Geçerli geçiş haritası (`src/lib/order.ts`'deki status flow'a göre):
```typescript
const VALID_BULK_TRANSITIONS: Record<string, string[]> = {
  paid: ["qc_pending", "cancelled"],
  awaiting_upload: ["cancelled"],
  qc_pending: ["proof_generating", "human_review", "cancelled"],
  proof_pending: ["proof_approved", "cancelled"],
  proof_approved: ["ready_to_ship"],
  ready_to_ship: ["in_production"],
  in_production: ["shipped"],
  shipped: ["delivered"],
};
```

---

## GÖREV 4/5 — Mail Şablon Önizleme (`/admin/mail-health` genişlet)

### Sorun
13 mail template var ama admin'den preview/test gönderimi yok.

### Çözüm

Yeni sayfa YAPMAYA GEREK YOK — mevcut `/admin/mail-health` sayfasına yeni tab ekle.

**Adım 1: `/admin/mail-health/page.tsx`'e "Şablonlar" tab ekle**

```
[Durum] [Şablonlar]    ← YENİ TAB
```

"Şablonlar" tab içeriği:

```
┌──────────────────────────────────────────────────┐
│ Mail Şablonları                                   │
├──────────────────────────────────────────────────┤
│ [Şablon listesi]                                  │
│  📧 order-confirmation      [Önizle] [Test gönder]│
│  📧 order-delivered          [Önizle] [Test gönder]│
│  📧 proof-ready              [Önizle] [Test gönder]│
│  📧 proof-reminder           [Önizle] [Test gönder]│
│  📧 qc-flagged               [Önizle] [Test gönder]│
│  📧 qc-rejected              [Önizle] [Test gönder]│
│  📧 shipment-status          [Önizle] [Test gönder]│
│  📧 shipping-update          [Önizle] [Test gönder]│
│  📧 proof-help-resolved      [Önizle] [Test gönder]│
│  📧 order-upload-reminder    [Önizle] [Test gönder]│
│  📧 abandoned-cart           [Önizle] [Test gönder]│
│  📧 review-request           [Önizle] [Test gönder]│
│  📧 admin-daily-summary      [Önizle] [Test gönder]│
├──────────────────────────────────────────────────┤
│ [Önizleme panel — seçilen template]               │
│  ┌─ iframe/rendered HTML ───────────────────┐    │
│  │  (React Email render → HTML string)       │    │
│  └───────────────────────────────────────────┘    │
│  Subject: "Siparişiniz onaylandı — #00001234"     │
│  From: info@pimetiket.com                         │
│  [Test gönder: admin email'e]                     │
└──────────────────────────────────────────────────┘
```

**Adım 2: API** `src/app/api/admin/mail-templates/route.ts`

```typescript
// GET — şablon listesi
// Her template için: key, subject, description

// GET ?key=order-confirmation&preview=true
// React Email render → HTML string döndür
// Mock data ile (örnek sipariş, örnek müşteri)

// POST — test gönder
// Body: { templateKey: string, recipientEmail?: string }
// recipientEmail yoksa admin'in kendi email'ine gönder
// Resend API ile gerçek gönderim (test flag ile)
```

**Adım 3: Template registry**

`src/lib/mail/template-registry.ts`:

```typescript
export const MAIL_TEMPLATES = [
  { key: "order-confirmation", label: "Sipariş Onayı", subject: "Siparişiniz onaylandı" },
  { key: "order-delivered", label: "Teslim Bildirimi", subject: "Siparişiniz teslim edildi" },
  { key: "proof-ready", label: "Prova Hazır", subject: "Baskı provanız hazır" },
  { key: "proof-reminder", label: "Prova Hatırlatma", subject: "Provanız onay bekliyor" },
  { key: "qc-flagged", label: "QC Uyarı", subject: "Tasarımınızda düzeltme gerekli" },
  { key: "qc-rejected", label: "QC Red", subject: "Tasarımınız reddedildi" },
  { key: "shipment-status", label: "Kargo Durumu", subject: "Kargo güncelleme" },
  { key: "shipping-update", label: "Kargo Takip", subject: "Kargonuz yola çıktı" },
  { key: "proof-help-resolved", label: "Destek Yanıtı", subject: "Yardım talebiniz yanıtlandı" },
  { key: "order-upload-reminder", label: "Upload Hatırlatma", subject: "Tasarımınızı yükleyin" },
  { key: "abandoned-cart", label: "Terk Sepet", subject: "Sepetiniz sizi bekliyor" },
  { key: "review-request", label: "Yorum Daveti", subject: "Deneyiminizi paylaşın" },
  { key: "admin-daily-summary", label: "Günlük Özet", subject: "Pim Etiket günlük rapor" },
] as const;
```

Her template'in mock data'sı ile React Email render edilerek HTML string oluşturulur.

---

## GÖREV 5/5 — Kupon Analitik (`/admin/kuponlar` genişlet)

### Sorun
Kuponlar DB'ye taşındı (Görev 4/6 Admin) ama kullanım trendi/analitik yok.

### Çözüm

Yeni sayfa YAPMAYA GEREK YOK — mevcut `/admin/kuponlar` sayfasına analitik bölümü ekle.

**Adım 1: API genişlet** `src/app/api/admin/coupons/route.ts`

GET response'a analitik ekle:

```typescript
// Mevcut: { ok, coupons: [...] }
// Yeni:   { ok, coupons: [...], analytics: {...} }

// analytics:
// {
//   totalUsage: number,           // toplam kullanım sayısı
//   totalDiscount: number,         // toplam indirim tutarı ₺
//   topCoupons: [                  // en çok kullanılan 5
//     { code: "HOSGELDIN10", usedCount: 45, totalDiscount: 2340 }
//   ],
//   usageTrend: [                  // son 30 gün günlük kullanım
//     { date: "2026-05-25", count: 3, discount: 180 }
//   ]
// }
```

Veri kaynağı: `coupon_uses` tablosu (zaten var, Migration 005).

```sql
-- Kullanım sayısı
SELECT c.code, COUNT(cu.id) as used_count, SUM(cu.discount_amount) as total_discount
FROM coupons c
LEFT JOIN coupon_uses cu ON cu.coupon_id = c.id
GROUP BY c.id, c.code
ORDER BY used_count DESC
LIMIT 5;

-- 30 gün trend
SELECT DATE(cu.created_at) as date, COUNT(*) as count, SUM(cu.discount_amount) as discount
FROM coupon_uses cu
WHERE cu.created_at > now() - interval '30 days'
GROUP BY DATE(cu.created_at)
ORDER BY date;
```

**Adım 2: `/admin/kuponlar/page.tsx`'e analitik bölüm ekle**

Tablo üstüne 3 KPI kart:

```
[Toplam kullanım: 127]  [Toplam indirim: ₺6.840]  [En popüler: HOSGELDIN10]
```

Tablo altına veya yeni tab'a:
- 30 gün kullanım trend çizgi grafik (mevcut SVG chart pattern)
- Top 5 kupon bar chart

---

## Uygulama Sırası

1. **Görev 1** — Blog CMS (migration 099 + API + admin sayfa + müşteri güncelle)
2. **Görev 2** — Destek sistemi (migration 100 + müşteri form + admin sayfa)
3. **Görev 3** — Bulk status (API + siparisler UI güncelle)
4. **Görev 4** — Mail şablon önizleme (mail-health tab + API + registry)
5. **Görev 5** — Kupon analitik (API genişlet + kuponlar UI genişlet)

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
