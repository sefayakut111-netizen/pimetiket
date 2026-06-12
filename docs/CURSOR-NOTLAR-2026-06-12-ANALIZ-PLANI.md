# SİSTEM HATA-TESPİT ANALİZ PLANI (master checklist)

> **Oturum amacı:** SADECE hata tespiti. Çözüm üretmiyoruz — bulguları Cursor sonradan düzeltecek
> şekilde not alıyoruz. Çözüm stratejisi ayrı oturumda.
> **Odak:** sistem akışını ve modüller arası bağları BOZAN hatalar. Kozmetik hatalar `[KOZMETİK]`
> etiketiyle ayrıca not edilir ama önceliklendirilmez.
> **Kaynak harita:** `docs/SISTEM-BAGIMLILIK-HARITASI.md` (250 API, 123 sayfa, 14 domain).
> **Çıktı:** her modül için ayrı `docs/CURSOR-NOTLAR-...-MXX.md` not dosyası (konum+sorun+öneri formatı).

---

## BÖLÜM 1 — ANALİZ BOYUTLARI (NE kontrol edeceğiz — her modülde bu 7 mercek)

| Kod | Boyut | Ne arıyoruz (hata odaklı) |
|---|---|---|
| **D1** | Akış & Durum Makinesi | Geçersiz/eksik durum geçişleri, ölü-kilit (dead-lock), erişilemez durum, terminal durumdan kaçış, yarım kalan akış |
| **D2** | Bağlantı / Sözleşme Kopması | Çağıran X bekler çağrılan Y döner; adımlar arası kopuk devir-teslim; alan adı/şekil uyuşmazlığı; async olan fonksiyonun senkron çağrılması |
| **D3** | Hata Yönetimi | Yutulan hata, eksik hata yolu, sonsuz bekleme/timeout yokluğu, sessiz başarısızlık, yakalanmayan reject, fallback eksik |
| **D4** | Yarış Durumu & Idempotency | TOCTOU, çift-submit, eşzamanlı mutasyon, retry güvenliği, cron çift çalışması, koşulsuz read-then-write |
| **D5** | Veri Bütünlüğü | Orphan/tutarsız kayıt, kısmi yazma (atomik değil), eksik doğrulama, tip/shape uyumsuzluğu, null guard yokluğu |
| **D6** | Yetki & Güvenlik | Authz boşluğu, IDOR, veri sızıntısı (KVKK), injection, eksik/atlanmış guard, RLS bypass |
| **D7** | Para & Sayısal Doğruluk | Fiyat/ödeme/iade/skor hesabı, yuvarlama, sıfıra bölme, çift tahsilat/iade, tutar tutarsızlığı |

> `[KOZMETİK]` = UI/metin/stil; akışı bozmaz. Not edilir, önceliklendirilmez.

---

## BÖLÜM 2 — SİSTEM MODÜLLERİ (NEREDE kontrol edeceğiz — 17 parça)

Sistem **17 analiz modülüne** bölündü. İlk 8 müşteri sipariş yolculuğu ekseninde (akış sırasıyla),
sonraki 8 katman/cross-cutting ekseninde, son 1 admin-only CRUD yüzeyi — böylece kopuk değil, bütünlüklü.

> **Admin stratejisi (verimlilik kararı):** Admin TEK dev modül YAPILMADI — çünkü akışa bağlı admin
> mutasyonları (manuel sipariş, bypass-checkout, refund, durum değişimi) ait oldukları akış
> modülünde incelenince durum makinesi tek geçişte bütün görülür; ayrı modül örtüşme+tekrar üretirdi.
> Bunun yerine: (a) akışa bağlı admin işlemleri ilgili modülde (M1/M2/M5/M6/M8), (b) tüm admin
> route'larında **RBAC enforcement süpürmesi** M9'da tek cross-cutting tarama, (c) hiçbir akışa ait
> olmayan öksüz admin-CRUD yüzeyleri **M17**'de.

### Akış ekseni (sipariş yolculuğu)

| M | Modül | Ana kapsam (dosya/route) | Baskın boyutlar | Risk | Durum | Öncelik |
|---|---|---|---|---|---|---|
| **M1** | Konfigüratör & Fiyat Motoru | `etiket/sticker/tabaka/yapilandir`, `lib/pricing-engine`, `lib/pricing-*`, `cart/reprice`, `pricing_config` | D7 D2 D5 | 🔴 para | ✅ **BİTTİ** (M1 notu, 16 bulgu) | **P2** |
| **M2** | Sepet & Ödeme (PayTR) | `sepet`, `odeme`, `api/payment/*`, `callback`, `lib/payment`, `payment_intents`, kupon apply | D7 D4 D3 D6 | 🔴 para | ✅ **BİTTİ** (M2 notu, 13 bulgu) | **P1** |
| **M3** | Tasarım Yükleme & Editör | `design/upload-*`, `editor/*`, `poc.html`, `EditorShell`, `temp-upload`, cutline | D2 D3 D4 | 🟠 | ✅ **BİTTİ** (editör çekirdeği + M3 yükleme notu, 15 bulgu) | **P2** |
| **M4** | Onay / Prova Akışı | `onay/[orderId]`, `orders/[id]/proof/*`, `lib/proof` (17), `approvals`, `finalize` | D1 D2 D5 D6 | 🔴 en yeni | ✅ **BİTTİ** (M4 notu, 12 bulgu) | **P1** |
| **M5** | Sipariş Yaşam Döngüsü & Durum Makinesi | `orders/[id]/advance-status/cancel`, `order-events-server`, `lib/order.ts`, `customer-order.ts`, `siparis/[id]` | D1 D4 D5 D2 | 🔴 çekirdek | ✅ **BİTTİ** (M5 notu, 19 bulgu) | **P1** |
| **M6** | Fason / Üretim Partneri | `api/partner/*`, `api/fason/*`, `admin/fason/*`, `lib/fason` (16) | D6 D1 D4 | 🔴 | ✅ **BİTTİ** (2 not + sim) | — |
| **M7** | Kargo & Sevkiyat | `admin/shipments/*`, `lib/shipping` (5), `poll-shipments`, `tracking`, `label` | D2 D3 D4 | 🟠 | ⏳ | **P3** |
| **M8** | İade & Geri Ödeme | `api/me/returns`, `admin/returns`, `payment/refund`, `auto-refund`, `iade-talep` | D7 D4 D1 D6 | 🔴 para | ✅ **BİTTİ** (M8 notu, 17 bulgu) | **P2** |

### Katman ekseni (cross-cutting)

| M | Modül | Ana kapsam | Baskın boyutlar | Risk | Durum | Öncelik |
|---|---|---|---|---|---|---|
| **M9** | Kimlik, Oturum & RBAC | `auth`, `mfa/2fa`, `partner otp`, `auth-bridge`, `middleware`, `role`, `assert-permission`, `admin-rbac`, `impersonate`, `staff` · **+ tüm ~120 admin route'unda `assertPermission` scope süpürmesi** | D6 D4 D3 | 🔴 | ✅ **BİTTİ** (M9 notu, 14 bulgu; RBAC süpürmesi temiz, "-" açık uç yok) | **P2** |
| **M10** | Veritabanı Katmanı (RLS + RPC + Migration) | `supabase/migrations` (**176**, docs bayat), RLS politikaları, kritik RPC gövdeleri (`fn_*`), `types.ts` ↔ kod drift | D6 D5 D4 D7 | 🔴 **en büyük kör nokta** | ✅ **BİTTİ** (M10 notu, ~15 bulgu) | **P1** |
| **M11** | Depolama & Dosya Zinciri (R2) | `lib/storage` (9), `r2-client`, `design-files`, `buckets`, signed URL, upload-init→complete zinciri | D2 D3 D5 D6 | 🟠 | ✅ **BİTTİ** (M11 notu, 14 bulgu) | **P2** |
| **M12** | Mail, Bildirim & Outbox | `lib/mail` (43), `notifications.ts`, `process-mail-outbox`, `suppression`, `webhooks/resend`, `enqueue` | D4 D3 D2 | 🟠 | ⏳ | **P3** |
| **M13** | Cron & Arka Plan İşleri | 22 cron ucu, `cron-auth`, `cron-logger`, idempotency, çift-çalışma | D4 D3 D1 | 🟠 | ⏳ | **P3** |
| **M14** | KVKK & Veri Yaşam Döngüsü | `kvkk-requests`, `archive-inactive`, `purge-expired-designs`, `cleanup-*` cron, `lib/kvkk`, silme zinciri | D5 D6 D1 | 🟠 yasal | ⏳ | **P3** |
| **M15** | AI / Pim Ajanları & Denetçiler | `lib/agents` (33), `pim/chat`, `design-qc`, `auditors`, `cutline-generate`, `lib/pim` (11) | D2 D3 D7 | 🟡 | ⏳ | **P4** |
| **M16** | Dış Entegrasyon Dayanıklılığı | `http/external-timeouts`, PayTR/OpenAI/Resend/Instagram/GSC/Netgsm çağrıları — timeout/retry/circuit | D3 D4 D2 | 🟠 | ⏳ | **P3** |
| **M17** | Admin İçerik / CRUD Yüzeyleri (öksüz) | `admin/blog`, `gallery`, `icerik`, `site-images`, `subscribers`, `traffic/gsc/realtime`, `product-cards` — hiçbir sipariş akışına ait olmayan admin-only CRUD | D5 D6 D2 | 🟡 (çoğu basit CRUD) | ⏳ | **P4** |

> **Admin operasyonları** (akışa bağlı) ayrı modül değil — ait oldukları akış modülünde denetlenir:
> manuel sipariş/bypass-checkout → M2/M5, fason admin → M6, fiyat admin → M1, refund → M8.
> Admin güvenliği (RBAC) → M9'daki cross-cutting süpürme. Öksüz admin-CRUD → M17.

---

## BÖLÜM 3 — ÖNCELİK SIRASI (sırayla bu işe gideceğiz)

| Tur | Modüller | Gerekçe |
|---|---|---|
| **P1** (önce) | **M10** Veritabanı · **M2** Ödeme · **M4** Onay/Prova · **M5** Sipariş yaşam döngüsü | Para akışı + en yeni feature + çekirdek bağlayıcı + tüm bulguların geçerliliğini belirleyen DB katmanı |
| **P2** | **M1** Fiyat · **M8** İade · **M9** Auth/RBAC · **M3** Yükleme/Editör · **M11** Depolama | Para + güvenlik omurgası + yarım kalan editör/upload zinciri |
| **P3** | **M7** Kargo · **M12** Mail · **M13** Cron · **M14** KVKK · **M16** Entegrasyon | Operasyonel + arka plan dayanıklılığı |
| **P4** | **M15** AI/Ajanlar · **M17** Admin CRUD yüzeyleri | En az akış-kritik (ajanlar tavsiye niteliğinde, admin-CRUD çoğu basit) |

**Tamamlanan:** M6 (Fason) ✅ — `CURSOR-NOTLAR-2026-06-12-fason-hafriyat.md` + simülasyon.
**Yarım:** M3 (editör çekirdeği), M9 (partner OTP) — ilgili turda tamamlanacak.

---

## BÖLÜM 4 — ÇALIŞMA RİTÜELİ (her modül için)

1. Modülün dosya/route setini haritadan çıkar.
2. Paralel inceleme ajan(lar)ı başlat — her ajana modülün **baskın boyutlarını** (D-kodları) hedef ver.
3. Bulguları topla: önem (KRİTİK/YÜKSEK/ORTA/DÜŞÜK), konum (`dosya:satır`), boyut (D-kodu), sorun, Cursor düzeltme önerisi.
4. `[KOZMETİK]` olanları ayrı bölümde, az satırla.
5. Doğrulanamayanları "Doğrulanacaklar" bölümüne.
6. `docs/CURSOR-NOTLAR-2026-06-12-MXX-<ad>.md` yaz, branch'e commit+push.
7. Bu master dosyada modülün **Durum**unu ✅ yap.

**Bu oturumda çözüm YOK** — sadece tespit + not. Çözüm stratejisi sonra.
