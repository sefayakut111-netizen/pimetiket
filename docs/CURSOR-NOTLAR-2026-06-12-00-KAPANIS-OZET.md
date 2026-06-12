# 🏁 SİSTEM HATA-TESPİT ANALİZİ — KAPANIŞ ÖZETİ (12 Haziran 2026)

> Tüm sistem **17 modül × 7 analiz boyutu** ile tarandı. SADECE hata tespiti — çözümler Cursor'a not edildi.
> Bu dosya yöneticidir; detay her modülün kendi `CURSOR-NOTLAR-2026-06-12-MXX-*.md` dosyasında.
> **Toplam: ~280 bulgu** (editör 40 + fason 36 + 17 modül ~204).

## Modül durum tablosu

| Modül | Not dosyası | Bulgu | En kritik tema |
|---|---|---|---|
| Editör çekirdeği | `editor-hafriyat` | 40 | worker köprüsü timeout yok, stale render |
| M6 Fason | `fason-hafriyat` (+sim) | 36 | KVKK PII sızıntısı, FSM ölü-kilit |
| M10 Veritabanı | `M10-veritabani` | 15 | fason token RPC authenticated'a geri açılmış |
| M2 Ödeme | `M2-odeme-paytr` | 13 | orphan charge (token sonrası intent silme) |
| M4 Onay/Prova | `M4-onay-prova` | 12 | multi-design sözleşmesi kopuk |
| M5 Sipariş FSM | `M5-siparis-durum-makinesi` | 19 | merkezi geçiş guard'ı yok (13+ yazar) |
| M1 Fiyat | `M1-fiyat-motoru` | 16 | reprice fiyat bypass, fee/KDV sızıntı |
| M8 İade | `M8-iade-geri-odeme` | 17 | parasız "refunded", force:true bypass |
| M9 Auth/RBAC | `M9-auth-rbac` | 14 | operations→partner impersonation |
| M3 Yükleme | `M3-yukleme-zinciri` | 15 | çift complete (gerçek QC parası), orphan |
| M11 Depolama | `M11-depolama-r2` | 14 | gerçek dosya yanlış silme, superseded orphan |
| M7 Kargo | `M7-kargo-sevkiyat` | 14 | poll 3 yere kopya, event dedup kaybı |
| M12 Mail | `M12-mail-outbox` | 14 | 2 template eksik (mail gitmiyor), bypass |
| M13 Cron | `M13-cron` | 15 | tek-instance kilidi YOK |
| M14 KVKK | `M14-kvkk` | 12 | DB PII hiç silinmiyor (yasal) |
| M16 Entegrasyon | `M16-entegrasyon` | 12 | Instagram/GSC timeout'suz |
| M15 AI/Pim | `M15-ai-pim-ajanlar` | 16 | bütçe guard delik, injection tek-mesaj |
| M17 Admin CRUD | `M17-admin-crud` | 14 | blog javascript: XSS, reorder atomik değil |

---

## 🔥 SİSTEM GENELİNDE TEKRARLAYAN KÖK DESENLER

Bağımsız modüllerde tekrar tekrar çıkan 6 sistemik kök neden — bunları kaynakta çözmek onlarca bulguyu birden kapatır:

### KÖK-1: Koşulsuz read-then-write (TOCTOU) — durum makinelerinde guard yokluğu
Aynı desen: durum okunur → JS'te kontrol → koşulsuz `.update()`. `.eq("status", expectedFrom)` CAS-lock yok.
**Nerede:** M5 (orders.status 13+ yazar), M6 (fason FSM), M7 (tracking_status), M8 (returns), M13 (archive), M17 (reorder), M2 (refund toplam).
**Tek çözüm deseni:** her mutasyona koşullu update (`.eq("status", expected)`) + 0 satır→409; kritik akışları RPC/transaction'a al.

### KÖK-2: `orders.status` için merkezi geçiş otoritesi yok
`order.ts`'te doğru geçiş matrisleri VAR ama yalnız admin UI kullanıyor; 13+ otomasyon yazarı bypass ediyor.
**Sonuç:** cancelled→shipped, üretim atlama, terminal durumdan dirilme. **Çözüm:** server-side zorunlu tek geçiş guard'ı (M5-B1/B3/B8).

### KÖK-3: DB yazıldı ama fiziksel/yan-etki doğrulanmadı
DB status değişir, R2/storage/event/mail senkronlanmaz veya doğrulanmaz.
**Nerede:** M11 (superseded orphan, yanlış silme), M3 (init orphan, cron storage silmiyor), M14 (DB PII silinmiyor), M5 (shipped/delivered drift), M9 (audit eksik).
**Çözüm:** silme/promote/arşiv adımlarını idempotent + doğrulamalı (HeadObject) + audit.

### KÖK-4: Idempotency / tek-instance koruması eksik
Cron'larda gerçek kilit yok; webhook/callback/promote çift işlenebiliyor; in-memory cooldown serverless'te etkisiz.
**Nerede:** M13 (kilit yok), M2 (callback), M3 (promote), M7 (bulk-poll), M12 (stale-recovery), M5/M15 (in-memory Map cooldown).
**Çözüm:** `pg_advisory_lock`/partial unique index/`Idempotency-Key`; in-memory state'i DB'ye taşı.

### KÖK-5: Koruma fonksiyonu var ama YANINDAKİ alanlar/yollar atlıyor
Redaksiyon/suppression/budget/injection guard'ı doğru yazılmış ama komşu alan/endpoint bypass ediyor.
**Nerede:** M6 (redaksiyon iyi, meta/notes ham), M12 (RPC iyi, admin route bypass), M15 (budget yalnız chat), M9 (RBAC iyi, RPC seed/legacy fallback), M14 (storage silinir, DB silinmez).
**Çözüm:** korumayı tek choke-point'e topla, tüm yolları oradan geçir.

### KÖK-6: Yorum-kod / docs-kod / kaynak drift'i
Yorumlar eski mantığı anlatıyor; iki paralel implementasyon ayrışıyor; tek-kaynak ilkesi ihlali.
**Nerede:** M13/M8 (cron yorumları), M12 (webhook "replay korumalı" ama değil), M1 (3 tier tablosu, fee yorumu), M15 (limitler hardcoded vs merkezi), M10 (176 migration, docs "89").

---

## 🎯 EN YÜKSEK ÖNCELİKLİ 12 BULGU (sistem genelinde, çözüm sırası önerisi)

| # | Bulgu | Modül | Tip |
|---|---|---|---|
| 1 | **KVKK silme DB'deki PII'yi hiç silmiyor** ("silindi" denip kalıyor) | M14-B1/B2 | 🔴 Yasal |
| 2 | **orphan charge** — token üretildikten sonra intent silinince para alınır sipariş yok | M2-#1/#2 | 🔴 Para |
| 3 | **orders.status merkezi guard yok** — cancelled→shipped, üretim atlama | M5-B1/B3/B8 | 🔴 Akış |
| 4 | **fason token RPC `authenticated`'a geri açılmış** + referral RPC caller guard yok | M10-K1/K2 | 🔴 Güvenlik |
| 5 | **multi-design sözleşmesi kopuk** — `fn_proof_summary` designs[] dönmüyor, finalize sayım doğrulamıyor | M4-B1/B2 | 🔴 Akış |
| 6 | **iade: parasız "refunded" + force:true ile baskı-sonrası-iade bypass** | M8-B2/B3/B4 | 🔴 Para |
| 7 | **hiçbir cron'da tek-instance kilidi yok** + manuel tetik tetikliyor | M13-#1/#5 | 🟠 Yarış |
| 8 | **operations rolü→partner impersonation + legacy-admin self-grant super_admin** | M9-B1/B3 | 🟠 Güvenlik |
| 9 | **AI bütçe guard yalnız chat + 3 endpoint cost loglamıyor** ($/gün delik) | M15-#1/#2 | 🟠 Para |
| 10 | **2 mail template registry'de yok** (password_reset/admin_custom hiç gitmiyor) | M12-B1 | 🟠 Akış |
| 11 | **R2-direct gerçek dosya 24h sonra yanlış siliniyor** + superseded orphan | M11-B2/B3 | 🟠 Veri |
| 12 | **blog gövdesinde javascript: link stored XSS** | M17-#1 | 🟠 Güvenlik |

---

## Sonraki adım (bu oturum DIŞI — çözüm stratejisi)
Bu oturum sadece **tespit**. Çözüm için öneri:
1. **Kök-desen bazlı saldır:** KÖK-1 (CAS-lock) + KÖK-2 (merkezi FSM guard) tek bir altyapı PR'ı ile onlarca bulguyu kapatır.
2. **Yasal/para önce:** #1 (KVKK), #2/#6 (para), #4 (güvenlik) acil.
3. **Doğrulanacaklar:** her not dosyasında "❓ Doğrulanacaklar" var — çoğu canlı DB/env teyidi gerektiriyor (Supabase ACL, Mig 076 apply, bucket politikaları, Vercel plan). Çözümden önce bunlar netleşmeli.

## Analiz altyapısı (yeniden kullanılabilir)
- Master plan: `CURSOR-NOTLAR-2026-06-12-ANALIZ-PLANI.md` (17 modül × 7 boyut, ritüel)
- Fason simülasyonu: `storefront/scripts/fason-partner-simulation.ts` (DB'siz, çalışan kanıt)
