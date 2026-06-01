# P1 Fix — Tema 2: Ödeme & Sipariş & Cron (7 görev)

Denetim (1 Haz) doğrulanmış P1'leri. Para akışı + state machine — **dikkatli, idempotency koru**.
Migration'lar: dosya yaz + push, **apply Sefa Supabase'de manuel**. Sıradaki mig no = `supabase/migrations/` en yüksek + 1.

---

## GÖREV 1/7 — PAYTR_TEST_MODE varsayılanı 1 (sandbox) → 0 [bug, conf 0.97] 🔴 EN KRİTİK

#### Dosya: `src/lib/payment/paytr.ts` (~satır 57)

`const testMode = testRaw === "0" ? 0 : 1;` — env tanımsız/yanlışsa **sandbox**'a düşer. Prod'da env
silinirse gerçek ödemeler sandbox'a gider, settlement olmaz ama PayTR başarılı görünür → para alınmaz.

**Fix:** Varsayılanı güvenli yap: `const testMode = testRaw === "1" ? 1 : 0;` (test modunu açmak EXPLICIT olsun).
Ek: `instrumentation.ts`'te prod'da `PAYTR_TEST_MODE !== "0"` ise Sentry uyarısı.

> ⚠️ Sefa'ya not: PayTR canlı moduna geçerken Vercel'de `PAYTR_TEST_MODE=0` olduğunu doğrula.

**Doğrulama:** `npx tsc` temiz; env yokken testMode=0 (canlı) döner.

---

## GÖREV 2/7 — Recovery path promoteEditorCutlines çağırmıyor [bug, conf 0.95]

#### Dosya: `src/lib/payment/recover-pending-intent.ts` → `runPostFinalizeSideEffects` (~satır 142-180)

IPN callback yolu (callback/route.ts:411-424) hem `promoteOrderDesigns` hem `promoteEditorCutlines`
çağırıyor. Recover path (IPN miss → PayTR durum sorgusu) sadece `promoteOrderDesigns` yapıyor →
editörde kesim çizen + IPN gelmeden kapatan kullanıcının cutline'ı kayıt dışı kalır.

**Fix:** `import { promoteEditorCutlines } from "@/lib/editor/promote-editor-cutline";` + callback/route.ts:411-423 ile AYNI pattern'de çağır (aynı try/catch sarmalı).

**Doğrulama:** `npx tsc` temiz; recover path callback ile aynı side-effect setini çalıştırır.

---

## GÖREV 3/7 — Durum sorgusu paymentAmount=0 ise tutar doğrulaması atlanıyor [bug, conf 0.85]

#### Dosya: `src/lib/payment/recover-pending-intent.ts` (~satır 399-403)

`totalKurus = paymentTotalKurus ?? paymentAmountKurus ?? 0` → ikisi de yoksa `intent.card_amount`'a
fallback yapıyor → amount mismatch kontrolü (satır 235) etkisiz. PayTR gerçek tutar dönmediğinde
sipariş intent tutarıyla finalize ediliyor (manipülasyon tespit edilemez).

**Fix:** `totalKurus === 0` ise finalize YAPMA, `status: 'pending'` döndür ("PayTR tutar dönmedi, IPN bekleniyor"). Sentry uyarısı ekle. Gerçek sıfır-tutarlı ödeme olamaz.

**Doğrulama:** Durum sorgusu tutar dönmezse sipariş finalize olmaz, pending kalır + Sentry log.

---

## GÖREV 4/7 — Refund 'processing' stuck: crash sonrası kalıcı blok [bug, conf 0.92]

#### Dosya: `src/app/api/payment/refund/route.ts` (~satır 185-222)

Mig 069 idempotency: INSERT placeholder (`status='processing'`) → PayTR çağrısı. Crash/timeout olursa
placeholder 'processing' kalır; unique index yeni denemeleri 409 ile sonsuza dek bloklar.

**Fix:** Placeholder'a `created_at` (zaten var mı kontrol et). 409 dönerse existing processing kaydının
`created_at`'i 5dk'dan eskiyse → 'stale' say, `status='failed'` yap + yeniden dene. (Veya cron ile 10dk+ processing → failed.)

**Doğrulama:** Stale processing kaydı (5dk+) yeni refund denemesini bloklamamalı; taze olan (içinde) hâlâ 409 verir.

---

## GÖREV 5/7 — Kupon TOCTOU race [security, conf 0.90]

#### Dosya: `src/lib/payment/coupon-server.ts` (~satır 138-180) + yeni migration

`applyCouponAfterOrder`, `fn_apply_coupon` DB fonksiyonunu KULLANMIYOR — SELECT COUNT → INSERT (row
lock/transaction yok). Eşzamanlı IPN+recovery veya 2 sekme → `per_user_limit`/`total_uses_limit` her
ikisi tarafından geçilebilir (limit atlatma).

**Fix (2 parça):**
1. **Migration:** `fn_apply_coupon_admin(p_code text, p_subtotal numeric, p_user_id uuid, p_order_id text)` — `security definer`, `set search_path=public`. İçinde `SELECT ... FOR UPDATE` ile coupon satırını kilitle, limit kontrolü + `coupon_uses` INSERT'i AYNI transaction'da. (Mevcut `fn_apply_coupon`'u baz al, `auth.uid()` yerine `p_user_id` parametresi.)
2. **Kod:** `applyCouponAfterOrder`'ı bu RPC'ye delege et (manuel SELECT/INSERT'i kaldır).

**Doğrulama:** Aynı kupon 2 eşzamanlı order'da limit aşamaz; tek order normal uygular.

---

## GÖREV 6/7 — process-mail-outbox: 'sending' stuck mail kurtarılmıyor [bug, conf 0.88]

#### Dosya: `src/app/api/cron/process-mail-outbox/route.ts` (~satır 79-88)

SELECT sadece `status IN ('pending','failed')` alır. Claim (`status='sending'`) sonrası Lambda timeout/SIGTERM
olursa satır 'sending' kalır → sonraki cron görmez → mail sonsuza dek gönderilmez.

**Fix:** Cron başına recovery step: `UPDATE ... SET status='failed' WHERE status='sending' AND updated_at < now() - interval '30 minutes'`. (Veya SELECT'e stuck-sending OR koşulu ekle.)

**Doğrulama:** 30dk+ 'sending' satır bir sonraki cron'da 'failed'a alınıp yeniden denenir.

---

## GÖREV 7/7 — Mig 111 SLA updated_at yerine proof_uploaded_at [bug, conf 0.92]

#### Yeni migration (CREATE OR REPLACE `fn_process_proof_pending_sla`)

Mig 111 (satır 28,32,38,43) zaman karşılaştırmalarında `o.updated_at` kullanıyor. Admin not/adres/atama
güncellemesi `updated_at`'i yeniler → 36sa otomatik-iade sayacı SIFIRLANIR → müşteri onay penceresini
aşsa bile iade tetiklenmez, sipariş proof_pending'de takılır.

**Fix:** Mig 111'deki fonksiyonu `CREATE OR REPLACE` ile yeniden yaz, tüm `o.updated_at` → `o.proof_uploaded_at`.
Koruyucu NULL check: `proof_uploaded_at IS NOT NULL AND proof_uploaded_at < now() - interval '36 hours'`.
(Kolon Mig 059/084'te mevcut — DOĞRULA.)

**Doğrulama:** Admin dokunuşu (updated_at değişir) iade saatini etkilemez; proof_uploaded_at'ten 36sa geçince iade tetiklenir.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

1. `npx tsc --noEmit` TEMİZ (kırıksa push etme).
2. `git add -A`
3. `git commit -m "fix(odeme-p1): test-mode default + recover cutline + amount guard + refund stale + kupon TOCTOU + mail stuck + SLA proof_uploaded_at"`
4. `git push origin main` → Vercel deploy.
5. **Migration'lar (Görev 5,7):** push edildi, **Supabase'de apply edilmedi** → Sefa'ya bildir: "Mig <N..> Studio'da apply et (küçük no → büyük)".
6. Deploy READY → commit hash + canlı URL + apply bekleyen migration listesi bildir.

> Git kökü `pim-etiket/core/`. Görev 1 (test mode) canlıya çıkmadan önce Sefa'ya PayTR env durumunu sor.
