# Sipariş Akışı Yeniden Organizasyon Planı

> **Karar:** Sefa 5 Haz — AI detaylı kalır ama KARAR VERMEZ (operatöre rapor sunar); operatör onayı baskı öncesine (müşteri prova onayından SONRA, her siparişte) taşınır.
> **Mimari:** Architect planı. Canlı sipariş akışı → aşamalı + geri-uyumlu. Cursor faz faz uygular.

---

## Hedef akış (onaylandı)

```
1. AI kontrolü (DETAYLI: DPI/bleed/renk/font) → KARAR VERMEZ, RAPOR üretir
2. Prova (bıçaklı dosya) → müşteriye
3. Müşteri onayı (içerik sorumluluğu müşteride)
4. Operatör baskı-öncesi onayı (HER sipariş):
   - AI raporu yeşilse → hızlı onay (tek bakış)
   - AI raporu sarı/kırmızıysa → detaylı kontrol
5. Üretim → Kargo → Teslim
```

---

## Mevcut → Hedef farkları

| # | Konu | MEVCUT | HEDEF |
|---|---|---|---|
| 1 | AI rolü | Karar verir (iyi→prova, kötü→human_review) | **Rapor üretir, karar vermez** — her zaman prova'ya gider |
| 2 | Operatör konumu | Prova'dan ÖNCE (AI şüpheliyse, `human_review`) | **Prova'dan SONRA (baskı öncesi, her sipariş)** |
| 3 | proof_approved sonrası | → ready_to_ship (operatör YOK) | → **operator_print_review (YENİ)** → ready_to_ship |
| 4 | human_review aşaması | AI-şüpheli ön kontrol | Kaldırılır (yeni siparişlerde); operatör artık baskı öncesi |

---

## Mevcut transition (referans)

```
qc_pending → proof_generating | human_review
human_review → proof_generating | human_review_failed
proof_generating → proof_pending
proof_pending → proof_approved
proof_approved → ready_to_ship        ← operatör YOK
```

## Hedef transition

```
qc_pending → proof_generating          (HER ZAMAN — AI karar vermez)
proof_generating → proof_pending
proof_pending → proof_approved          (müşteri onay)
proof_approved → operator_print_review  (YENİ)
operator_print_review → ready_to_ship   (operatör onayladı)
                      | proof_generating (operatör "düzelt" → prova yeniden)
                      | cancelled        (operatör reddet → iade)
ready_to_ship → ...
```

> Eski `human_review`, `qc_flagged`, `human_review_failed`, `operator_review` transition'ları **KORUNUR** (geçiş döneminde bu state'lerde takılı eski siparişler için). Yeni siparişler bu state'lere girmez.

---

## FAZLAR (aşamalı, her biri ayrı Cursor görevi + test)

### FAZ 1 — Backend: yeni state + transition (geri-uyumlu)
**Risk:** Orta (canlı state machine). Geri-uyumlu — eski akış bozulmaz.

1. **Migration:** `order_status` enum'a `operator_print_review` ekle (DROP yok, sadece ADD)
2. `src/lib/order.ts` `VALID_SINGLE_TRANSITIONS`:
   - `proof_approved: ["operator_print_review"]` (eski `ready_to_ship` yerine)
   - `operator_print_review: ["ready_to_ship", "proof_generating", "cancelled"]`
3. `src/app/api/orders/[id]/proof/finalize/route.ts`: müşteri onayı sonrası `proof_approved` → **`operator_print_review`** (eski: ready_to_ship). print-ready PDF üretimi burada tetiklenebilir (operatör hazır dosyayı görür).
4. `order.ts` status label + admin/customer/görsel katmanlarına `operator_print_review` ekle (geçici label "Baskı onayı bekliyor").

**Çıktı:** Yeni siparişler müşteri onayından sonra `operator_print_review`'de bekler (henüz operatör ekranı yok → FAZ 3'te). FAZ 1 tek başına deploy edilirse siparişler burada birikir — **FAZ 1+3 birlikte canlıya alınmalı** veya geçici admin manuel ready_to_ship.

### FAZ 2 — AI rapor modeli (karar vermez)
**Risk:** Orta (AI pipeline). 

1. `src/lib/agents/run-order-qc.ts`: AI verdict artık state belirlemez. `qc_pending` → **`proof_generating` HER ZAMAN** (iyi/normal/kötü farketmez; error dahil → yine proof'a, operatör baskı öncesi bakar).
2. AI sonucu `design_quality_checks` tablosuna **rapor** olarak kaydedilmeye devam (zaten var) — verdict + skor + bulgular (DPI/bleed/renk/font).
3. `qc_pending → human_review` escalation **kaldırılır** (yeni siparişler). human_review kodu eski siparişler için kalır ama yeni tetiklenmez.
4. AI raporu `operator_print_review` ekranında gösterilmek üzere yapılandır (yeşil/sarı/kırmızı özet + bulgu listesi).

**Çıktı:** AI her dosyayı detaylı analiz eder, rapor üretir, ama akışı durdurmaz — sipariş prova'ya akar.

### FAZ 3 — Operatör baskı-öncesi ekranı
**Risk:** Düşük-orta (yeni admin UI).

1. **Admin kuyruğu:** `operator_print_review` durumundaki siparişler. Mevcut `/admin/ai-qc` yeniden konumlandırılabilir VEYA yeni `/admin/baski-onay`.
2. Her siparişte:
   - **AI raporu özeti** (yeşil ✅ / sarı ⚠️ / kırmızı 🔴) + bulgular (DPI, bleed, renk, font)
   - Müşterinin onayladığı prova/bıçak görünümü
   - Operatör aksiyonu:
     - **Onayla** → `ready_to_ship` (AI yeşilse tek tık hızlı)
     - **Düzelt** → `proof_generating` (prova yeniden, müşteriye geri)
     - **Reddet** → `cancelled` (iade)
3. AI yeşil → "Hızlı onay" UI (büyük buton); sarı/kırmızı → bulgu detayı açık.

**Çıktı:** Operatör baskı öncesi son kontrol; AI raporu yükü azaltır.

### FAZ 4 — Görsel sipariş yolculuğu
**Risk:** Düşük (sadece UI/label).

`src/app/siparis/[id]/page.tsx` `statusToPhaseIndex` + phases:

```
0. Konfigüre
1. Ödeme           → paid
2. Tasarım         → awaiting_upload
3. Kalite kontrolü → qc_pending (+ eski qc_flagged)
4. Prova onayı     → proof_generating, proof_validating, proof_pending
5. Operatör onayı  → operator_print_review (+ eski human_review uyumu)
6. Üretim          → proof_approved*, ready_to_ship, fason_assigned, in_production
7. Kargo           → shipped
8. Teslim          → delivered
```

> *proof_approved artık kısa-ömürlü (hemen operator_print_review'e geçer) — "Prova onayı" done, "Operatör onayı" curr.

İsimler tutarlı nötr form (önceki denetim). Önceki 2 mapping hatası bu fazda da çözülür.

---

## Geçiş stratejisi (canlı sistem güvenliği)

- **Geri-uyumlu:** Yeni state ADD edilir, eski state'ler silinmez. Eski siparişler (human_review vb.) akışını tamamlar.
- **FAZ 1+3 birlikte:** operator_print_review eklenince ekranı da olmalı (yoksa siparişler kuyrukta görünmez birikir).
- **FAZ 2 dikkatli:** AI escalation kaldırma → eski human_review siparişleri etkilenmemeli (sadece yeni qc_pending'ler proof'a akar).
- **Test:** Her faz sonrası 1 test siparişi uçtan uca (sticker, ödeme→teslim) izlenmeli.

---

## Önerilen sıra + timing

| Faz | İçerik | Risk | Timing önerisi |
|---|---|---|---|
| 1+3 | Yeni state + operatör ekranı (birlikte) | Orta | **Post-launch** (state machine + UI) |
| 2 | AI rapor modeli | Orta | Post-launch (1+3 sonrası) |
| 4 | Görsel sipariş yolculuğu | Düşük | Launch öncesi yapılabilir (sadece görsel) VEYA 1+3 ile |

**Architect önerisi:** Bu refactor **post-launch'a uygun** — canlı sipariş akışı, gerçek müşteriler, state machine + AI + UI üç katman. Launch mevcut akışla çıkabilir (çalışıyor). Refactor launch sonrası ilk büyük iş olarak, faz faz + test ile.

**Minimum launch-öncesi seçenek:** Sadece FAZ 4 (görsel adım isimleri/mapping düzeltme — önceki denetim) → küçük, risksiz. Tam akış değişikliği (1-2-3) post-launch.

---

## İlgili dosyalar

- State machine: `src/lib/order.ts` (OrderStatus enum, VALID_SINGLE_TRANSITIONS)
- AI QC: `src/lib/agents/run-order-qc.ts`
- Operatör karar: `src/app/api/admin/ai-qc/decide/route.ts`
- Prova finalize: `src/app/api/orders/[id]/proof/finalize/route.ts`
- Görsel adım: `src/app/siparis/[id]/page.tsx` (statusToPhaseIndex, phases)
- Status katmanları: `src/lib/customer-status.ts`, `src/lib/admin-status.ts`
- AI rapor tablosu: `design_quality_checks` (Mig 039)
- Akış diyagramı: `docs/SISTEM-AKISLARI.md`

---

*Plan: 5 Haz 2026 · Architect · Onay: Sefa (akış mantığı) · Uygulama: faz faz Cursor + test*
