# Cursor Notları — M17: Admin İçerik / CRUD Yüzeyleri (öksüz)

> Hata-tespit (P4). Boyut: D2 sözleşme, D4 yarış, D5 veri bütünlüğü, D6 güvenlik. RBAC guard M9'da süpürüldü (temiz).
> **Genel:** Çoğu yüzey makul. `site-images` upload örnek alınası (magic-byte + SVG sanitize + size + mime). Asıl risk: blog `javascript:` link XSS, reorder atomik değil, CSV injection, blog upload uçlarında size/magic-byte yok.

## 🟠 YÜKSEK

### 1. Blog gövdesinde `javascript:` link XSS (stored) · D6
- **Konum:** `app/blog/[slug]/page.tsx:132-142` (`href={link[2]}` protokol kontrolsüz); API `admin/blog/route.ts:147` (yalnız `.trim()`)
- **Sorun:** Inline image'da (`:88`) protokol allowlist VAR ama markdown link `[text](url)` render'ında YOK → `[tıkla](javascript:fetch('/api/...'))` aktif link basılıyor. `blog:create`'li düşük yetkili staff admin oturumunda çalışacak stored XSS yerleştirebilir.
- **Düzeltme:** Link'e de güvenli-protokol kontrolü (`/^(https?:\/\/|\/|mailto:)/i`); aksi halde plain text. API'de de `body_tr`'de `javascript:`/`data:` reddet.

### 2. Reorder işlemleri atomik değil — kısmi başarı = bozuk sıralama · D2/D5
- **Konum:** `admin/gallery/reorder/route.ts:44-56`, `product-cards/reorder/route.ts:56-72`
- **Sorun:** Her id için ayrı UPDATE `Promise.all`, transaction yok. Ortadaki UPDATE fail'de bir kısım yeni bir kısım eski `sort_order` → kalıcı sıra çakışması/duplike. Rollback yok. Kısmi array'de listeden çıkanlar eski değerde çakışır.
- **Düzeltme:** Tek RPC (`fn_reorder_gallery(ids uuid[])`) `update ... from unnest(ids) with ordinality` ile tek transaction.

### 3. Eşzamanlı reorder yarışı — son-yazan kazanır · D4
- **Konum:** `gallery/reorder/route.ts:44`, `product-cards/reorder/route.ts:56`
- **Sorun:** İki admin/çift-submit drag aynı anda reorder → iç içe UPDATE belirsiz `sort_order`; müşteri RPC'sinde duplike/atlanmış sıra.
- **Düzeltme:** #2'deki tek RPC yarışı da kapatır; client'ta reorder sırasında drag/buton disable. (Doğrulama: UI double-submit guard.)

### 4. CSV injection — abone export'unda formül enjeksiyonu · D6
- **Konum:** `admin/subscribers/route.ts:83-94`
- **Sorun:** `email`/`interests`/`source` CSV hücrelerine kaçışsız. `interests` lead/subscribe'tan public (`=`,`+`,`@`,`|` filtrelenmiyor) → `=HYPERLINK(...)`/`=cmd|...` admin Excel'de açınca formül çalışır. `email`/`source` tırnaksız, `"` kaçışı yok (RFC4180 ihlali).
- **Düzeltme:** Her hücreyi quote + `"`→`""`; lider `= + - @ \t \r` ise başına `'`. Ortak `csvCell()` helper.

### 5. Blog/gallery upload uçlarında size/magic-byte yok — site-images ile asimetri · D6
- **Konum:** `admin/blog/upload-cover/route.ts:20-78`, `upload-image/route.ts:21-79`, `gallery/upload-url/route.ts:25-85`
- **Sorun:** Yalnız `extension` string kontrolü + presigned URL. Gerçek boyut/magic-byte/içerik tipi YOK → client devasa dosya veya jpg uzantılı HTML payload PUT edebilir. `public-assets` public-read olduğundan `text/html` içerik tarayıcıda HTML servis edilirse XSS. `site-images/route.ts:135-184` tam set kontrolü uyguluyor — pattern evde var, buraya uygulanmamış.
- **Düzeltme:** site-images deseni gibi server-side multipart (magic-byte+size); presigned kalacaksa bucket'ta boyut limiti + Content-Type whitelist + serv'de `Content-Disposition: attachment`/non-executable bucket. (Doğrulama: bucket politikası + Content-Type davranışı — KRİTİK'e yükselebilir.)

## 🟡 ORTA
- **6.** Blog DELETE orphan görseller (cover + inline) storage'da kalıyor — gallery best-effort temizliyor, blog hiç (`admin/blog/route.ts:193-216`). → DELETE'te cover + `body_tr` inline path'leri `storage.remove`. · D5
- **7.** Blog PATCH slug unique ihlalinde 500 + yanıltıcı mesaj (POST'ta 23505 yakalı ama PATCH'te değil) (`:179-188`). → PATCH'te de `23505`→400 TR mesaj. · D5/D2
- **8.** site-images DELETE/PATCH kayıt yoksa sessiz 200 (`:349-357,311-323`) → istemci silindi/güncellendi sanır. → etkilenen satır kontrolü, 0→404. · D5/D2
- **9.** site-images upsert onConflict storage cleanup yarışı — eşzamanlı upload'ta kaybeden orphan kalır (`:188-254`). → slot lock veya atomic swap. · D4/D5
- **10.** product-cards PATCH boş string ile başlık silinebilir (`title_tr=""` geçer) (`:88-92`) → boş başlıklı kart. → `.trim()` sonrası boşsa patch'e ekleme/400. · D5
- **11.** lead/subscribe mevcut kullanıcıda `interests`/`source` güncellenmiyor (yorum "override edebiliriz" der ama etmiyor) (`:93-115`). → davranışı netleştir. · D5

## 🟢 DÜŞÜK / KOZMETİK
- **12.** Blog/gallery upload `crypto.randomUUID` fallback `Math.random` (tahmin edilebilir path) — ölü kod ama tetiklenirse zayıf (`upload-cover:45-48` vb.). → fallback kaldır. · D6
- **13.** gallery `body`/`features` sanitize yok ama dangerouslySetInnerHTML kullanılmıyor (grep temiz) — render JSX text ise sorun yok (doğrula). · D6
- **[KOZMETİK]** `gallery/reorder/route.ts:10`, `upload-url/route.ts:17` kullanılmayan `createServerClient` import.

## ✅ Pozitif notlar
- `site-images/route.ts` upload akışı **referans kalite**: magic-byte (`:172`), SVG sanitize (`:159`), size limiti (`:135`), DB-fail'de storage cleanup (`:248`) — diğer upload uçları bunu örnek almalı.
- lead/subscribe: rate-limit (`:49`), unique-violation race handling (`:135`), KVKK consent_at/ip/ua kaydı doğru.
- public/instagram salt-okunur, cache'li (`revalidate=3600`), enjeksiyon yüzeyi yok.

## ❓ Doğrulanacaklar
1. GaleriTab/UrunlerTab reorder fetch'lerinde drag/submit sırasında UI disable var mı (#3).
2. `public-assets` bucket boyut limiti + Content-Type whitelist tanımlı mı (#5 — yoksa YÜKSEK→KRİTİK).
3. `public-assets` serv‘te Content-Type upload-time'da mı (HTML servis edilebiliyorsa #5 kritik).
4. `/galeri` müşteri render `body`/`features`'ı JSX text mi HTML mi (#13).

**En kritik:** #1 (blog javascript: XSS) · #5 (blog upload magic-byte/size yok + public bucket) · #2+#3 (reorder atomik değil + yarış) · #4 (CSV injection).
