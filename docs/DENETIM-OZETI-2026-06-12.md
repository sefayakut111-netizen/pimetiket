# 🔍 SİSTEM DENETİM RAPORU — Pim Etiket (12 Haziran 2026)

> **Bu oturum YALNIZCA DENETİM'dir.** Hiçbir kod değiştirilmedi — sadece hata tespiti yapıldı ve
> belgelendi. **Düzenlemeleri Cursor yapacak.** Bu dosya tüm denetimin özeti + yapılacaklar listesidir;
> detaylar `docs/CURSOR-NOTLAR-2026-06-12-*.md` dosyalarındadır.
>
> **Branch:** `claude/file-review-updates-vnd6og` · **Durum:** denetim tamamlandı, 24 not dosyası push'landı.

---

## 1) NE YAPILDI (özet)

Tüm sistem **17 analiz modülü × 7 analiz boyutuyla** baştan sona tarandı.

| | |
|---|---|
| **Kapsam** | 250 API ucu · 123 sayfa · 176 migration · 37 lib modülü |
| **Modül** | 17/17 ✅ tamamlandı |
| **Toplam bulgu** | ~280 (editör 40 + fason 36 + 17 modül ~204) |
| **Kök desen** | 6 sistemik kök, tüm kod tabanında census'landı |
| **Doğrulama** | en kritik 7 bulgu bizzat kaynaktan teyit edildi → 7/7 gerçek |
| **Kanıt** | 1 çalışan simülasyon (DB'siz, gerçek fonksiyonlarla) |

**7 analiz boyutu:** D1 akış/durum-makinesi · D2 sözleşme/bağlantı · D3 hata yönetimi · D4 yarış/idempotency · D5 veri bütünlüğü · D6 yetki/güvenlik · D7 para/sayısal.

---

## 2) EN KRİTİK BULGULAR (doğrulandı)

### 🔴 Yasal / Para
1. **KVKK silme DB'deki PII'yi HİÇ silmiyor** — "silindi" deniyor ama ad/telefon/adres/email/sipariş kaydı yerinde kalıyor (KVKK m.7 ihlali) · `M14`
2. **Orphan charge** — token üretildikten sonra intent silinince: para alınır, sipariş oluşmaz · `M2`
3. **Denetçi (auditor) aksiyonu çift çalışabiliyor** → çift iptal/iade/kupon-uzatma · `KOKLER`
4. **İade: gerçek para olmadan "refunded" + `force:true` ile baskı-sonrası-iade kuralı tamamen bypass** · `M8`
5. **reprint-kupon "idempotent" değil** → aynı sipariş için çift indirim kuponu · `KOKLER`

### 🔴 Akış / Veri bütünlüğü
6. **`orders.status` merkezi geçiş guard'ı yok** — 29 yazardan 27'si bypass; cancelled→shipped, üretim atlama mümkün · `M5`
7. **Çok-tasarımlı onay sözleşmesi kopuk** — `fn_proof_summary` `designs[]` döndürmüyor; eksik/onaysız tasarımla finalize riski · `M4`
8. **Hiçbir cron'da tek-instance kilidi yok** — `withCronRun` sadece log; advisory lock / SKIP LOCKED sıfır kullanım · `M13`

### 🔴 Güvenlik
9. **fason token RPC `authenticated`'a sessizce geri açılmış** (Mig 023 revoke → 089/132 grant) · `M10`
10. **`operations` rolü → partner impersonation** + legacy-admin'in kendini super_admin yapabilmesi · `M9`
11. **partner upload-revision** magic-byte yok + admin-loop atlayıp `status:'approved'` ile müşteriye servis · `M3`

---

## 3) 6 SİSTEMİK KÖK (kaynakta çözülürse onlarca bulguyu birden kapatır)

| Kök | Özet | Çözüm noktası |
|---|---|---|
| **KÖK-1** Koşulsuz read-then-write (TOCTOU) | ~48 doğrulanmış + 2 yıkıcı (son super_admin, KVKK çift-silme) | `casUpdate` helper + CI grep-guard |
| **KÖK-2** `orders.status` merkezi otorite yok | 29 yazar, sadece 2'si matris kullanıyor; `delivered`'a yazan yok | tek `fn_transition_order_status` RPC |
| **KÖK-3** DB yazıldı, fiziksel iş doğrulanmadı | superseded/silme/PII orphan, drift | doğrulamalı + idempotent silme |
| **KÖK-4** Idempotency / tek-instance eksik | `withCronRun` kilitsiz, in-memory state etkisiz | `withAdvisoryLock` + unique index'ler |
| **KÖK-5** Guard var ama yanından bypass | 6 guard'dan sadece `assertPermission` choke-point | her guard'ı tek yola topla |
| **KÖK-6** Yorum/docs/kod drift'i | docs "89 migration" der, gerçek 176; apply takibi 089'da kalmış | `MIGRATIONS-APPLIED.md`'yi 176'ya tamamla |

**Olumlu (census'la doğrulandı):** ödeme finalize, iade idempotency, mail-outbox claim, fason atama, kupon rezervasyonu — çekirdek para hattı zaten atomik/sağlam.

---

## 4) YAPILACAKLAR (Cursor uygulayacak — 5 faz)

> Detaylı sıra: `docs/CURSOR-NOTLAR-2026-06-12-01-CURSORA-TESLIM.md`

- **FAZ 0 — Ön-uçuş (kod yazmadan canlı teyit):** 13 madde DB/env'de doğrulanacak (migration apply durumu, RPC ACL'leri, 2 unique index, bucket politikası…). *Yanlış varsayımla yanlış düzeltmeyi önler.* + `MIGRATIONS-APPLIED.md` 176'ya tamamlanacak.
- **FAZ 1 — Paylaşılan altyapı:** `fn_transition_order_status` · `withAdvisoryLock` · `casUpdate` helper + CI grep-guard · eksik unique index'ler. *(Çok bulguyu birden kapatır.)*
- **FAZ 2 — Kritik tekil (yasal/para):** KVKK PII silme · denetçi execute claim · orphan charge · iade bypass · reprint-kupon · fason token revoke · proof-respond atlama · multi-design sözleşmesi.
- **FAZ 3 — Güvenlik choke-point'leri:** magic-byte · AI bütçe · mail suppression · partner meta redaksiyon · impersonation yetkisi · save-edit guard.
- **FAZ 4 — Kalan modül düzeltmeleri** (her not dosyasındaki öncelik sırasına göre).
- **FAZ 5 — Kozmetik** (en son; akış-bozan değil).

**Cursor için altın kural:** Yeni desen icat etme — kod tabanında doğru desen zaten var, kopyala: CAS → `admin/ai-qc/decide:99` · claim → `cron/auto-refund:88` · atomik RPC → `fn_finalize_paid_order` · optimistic lock → `redistribute-slot:208`.

---

## 5) ÖNEMLİ NOT — çözümden önceki tek engel
"Bu RPC/index canlıda var mı?" sorularının cevabı yok çünkü **`MIGRATIONS-APPLIED.md` 089'da kalmış (090-176 takip edilmiyor)**. FAZ 0 bu boşluğu kapatmadan FAZ 1-2'ye geçilirse var olanı tekrar oluşturma / eksik bırakma riski var.

---

## 6) DOSYA İNDEKSİ (`docs/` altında)

**Giriş sırası:** bu dosya → `01-CURSORA-TESLIM` (uygulama sırası) → `00-KAPANIS-OZET` (yönetici özeti) → `KOKLER-derin-arastirma` (altyapı tasarımı) → `DOGRULAMA` (teyit).

**Modül detayları:** `M1`-fiyat · `M2`-ödeme · `M3`-yükleme · `M4`-onay/prova · `M5`-sipariş-FSM · `M7`-kargo · `M8`-iade · `M9`-auth/RBAC · `M10`-veritabanı · `M11`-depolama · `M12`-mail · `M13`-cron · `M14`-kvkk · `M15`-ai/pim · `M16`-entegrasyon · `M17`-admin-crud · `editor-hafriyat` · `fason-hafriyat`

**Master plan:** `ANALIZ-PLANI` (17 modül × 7 boyut) · **Kanıt:** `storefront/scripts/fason-partner-simulation.ts`
