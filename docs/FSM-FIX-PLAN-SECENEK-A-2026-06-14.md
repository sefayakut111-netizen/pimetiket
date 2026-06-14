# FSM regresyon fix — Seçenek A; merkezileştirme öncesi davranışı geri verir; main merge ÖN KOŞULU

**Branch:** `claude/file-review-updates-vnd6og` · **Push YOK** (Claude doğrulayacak) · **Yeni migration:** `190_fsm_forward_matrix_route_alignment.sql`

---

## 0. Bağlam ve karar

Mig 180 (`fn_transition_order_status`) tüm `orders.status` geçişlerini **tek chokepoint**'e topladı ve forward matrisini (`fn_is_valid_order_forward_transition`) merkezileştirdi. Merkezileştirme sırasında matris, **route gerçeğinden dar** kaldı: bugün canlı route'ların `mode='forward'` ile ulaştığı birçok `(from→to)` çifti matriste YOK → RPC `{ok:false, error:'invalid_transition'}` → HTTP 400. Sonuç: müşteri prova onayı, operatör AI-QC kararı, stuck-resume kurtarması ve operatör prova reupload akışları **kırık**.

**Seçenek A** = matrisi route gerçeğine hizala (kod refactor değil, matris genişletme). Hizalama yapılırken **mali/kalite-kapısı riski taşıyan eklemeler matrise konmaz** — bunlar kod-fix'e veya ayrı ürün kararına dönüştürülür (aşağıda). Eksik ÇIKIŞ geçişleri (özellikle `operator_review` ölü-ucu) matrise eklenir ki takılma olmasın.

**Bu doğrulanmış zemin (kod okundu):**
- `proof-respond/route.ts`: `result.ok` KONTROL EDİLİYOR, `transitionHttpStatus(result.error)` ile 400 döner (satır 97-103). Onay → `in_production`, request_change → `operator_review` (satır 75-76).
- `ai-qc/decide/route.ts`: guard `AI_QC_ACTIVE_STATUSES` (satır 82-89), whitelist'te `operator_print_review` YOK → `isPrintReview` dalları ölü kod. `transitionResult.ok` kontrol ediliyor (satır 143-150).
- `order.ts` satır 238-243: `AI_QC_ACTIVE_STATUSES = [qc_pending, qc_flagged, human_review, human_review_failed]`.
- `tracking/route.ts` satır 218-233: `transitionOrderStatus` await ediliyor AMA **dönüş değeri kontrol EDİLMİYOR** → mail + assignment her durumda gider = sessiz desync.
- `orchestrator.ts` satır 327-336 (AI fail → `operator_review`), satır 357-365 (after-edit `from=['proof_pending','operator_review'] → proof_validating`).
- `resume-order-pipeline.ts` satır 68-80: `cutlineCount>0` koşuluyla `from=['qc_pending','paid','awaiting_upload'] → proof_pending`.

---

## 1. Matrise EKLENECEK forward geçişleri (route gerçeği — güvenli)

Aşağıdakiler doğrudan canlı route davranışıdır, mali/kalite riski taşımaz, eklenir:

| from | to | Neden (route) |
|---|---|---|
| `operator_review` | `proof_validating` | orchestrator `runProofValidationAfterEdit` (sat. 357-365). `operator_review` forward'da from-anahtarı DEĞİL = ölü-uç çıkışı. **Zorunlu.** |
| `operator_review` | `proof_pending` | `upload-proof/route.ts`: operatör prova reupload, `from` listesinde `operator_review`. `operator_review`'in 2. çıkışı. **Zorunlu.** |
| `proof_generating` | `operator_review` | orchestrator AI-fail dalı (sat. 327-336, `finalStatus='operator_review'`). |
| `proof_validating` | `proof_generating` | orchestrator after-edit sonrası `runProofPipeline` içindeki `proof_generating` adımı. (Bkz. §4 eksik-çıkış.) |
| `qc_pending` | `ready_to_ship` | `ai-qc/decide` `decision=approve`, fromStatus=`qc_pending`. (Prova adımı kasıtlı atlanır — operatör onayı.) |
| `qc_flagged` | `ready_to_ship` | `ai-qc/decide` approve, `qc_flagged`. |
| `human_review` | `ready_to_ship` | `ai-qc/decide` approve, `human_review`. |
| `human_review_failed` | `ready_to_ship` | `ai-qc/decide` approve, `human_review_failed`. |
| `qc_flagged` | `proof_generating` | `ai-qc/decide` `fix_and_proof`, `qc_flagged` (+ `run-order-qc` qcAllowedStatuses). |
| `human_review_failed` | `proof_generating` | `ai-qc/decide` `fix_and_proof`, `human_review_failed` (+ QC re-run). |
| `qc_pending` | `human_review_failed` | `ai-qc/decide` `reject` (isPrintReview=false), fromStatus=`qc_pending`. |
| `qc_flagged` | `human_review_failed` | `ai-qc/decide` `reject`, `qc_flagged`. |
| `qc_pending` | `proof_pending` | `resume-order-pipeline` (cutline mevcut) + `upload-proof` (operatör prova). |
| `qc_flagged` | `proof_pending` | `upload-proof`: operatör prova, `from` listesinde `qc_flagged`. |
| `awaiting_upload` | `proof_pending` | `resume-order-pipeline` stuck-resume (cutline mevcut). |

> **NOT — `qc_*|human_review* → ready_to_ship` (AI-QC approve) için uyarı:** Bu 4 kenar prova + baskı-öncesi inceleme adımını atlayıp doğrudan `ready_to_ship`'e götürür (kasıtlı operatör onayı). Mali bypass DEĞİL (hepsi `paid` sonrası), ama doğal `proof_pending` iade-checkpoint'i oluşmaz. Adversaryal analiz "Sefa onayı" işaretledi. **KARAR: matrise eklenir** çünkü bu route bugün canlı operatör akışı; kaldırmak operatör AI-QC onayını tümden kırar. Ancak operatörün bu yolu bilinçli kullanması gerektiği `ai-qc/decide` UI'inde net olmalı (ayrı iş, bloklamaz).

### `paid → proof_pending` — KOŞULLU (compensating'e çevir, matrise EKLEME)

`resume-order-pipeline` bunu **sadece `cutlineCount>0`** koşuluyla yapıyor (QC+cutline geçmiş, takılmış sipariş kurtarılıyor). Matris "cutline var ise" koşulunu ifade EDEMEZ; düz `paid → proof_pending` eklenirse ileride başka çağıran cutline yokken QC+AI doğrulamayı atlayan bir kapı açabilir.

**KARAR:** `paid → proof_pending` matrise EKLENMEZ. Bunun yerine `resume-order-pipeline.ts`'teki bu tek çağrı `mode='compensating'` kullanır (matris-dışı, audit'li, cutline-guard'lı). `awaiting_upload → proof_pending` route'ta cutline-guard'lı olduğundan matrise eklenir (yukarıda), ama `paid` daha riskli olduğu için compensating'e bırakılır. (Kod-fix §3.4.)

---

## 2. Matrise EKLENMEYECEK — tehlikeli/ölü eklemeler (kod-fix'e çevrildi)

### 2.1 `proof_pending → in_production` (proof-respond approve) — ÖLÜ/LEGACY + kalite-kapısı atlama

- Kanonik müşteri prova onayı **`/onay` → `finalize/route.ts` → `fn_finalize_proof`** ile yürüyor: `proof_pending → proof_approved → operator_print_review` (Mig 059/154, operatör baskı-öncesi kapısı TASARIMLA var).
- `proof-respond/route.ts` (action=approve) `proof_pending`'i **doğrudan `in_production`**'a atlatıyor → hem `proof_approved` hem `operator_print_review` pre-print QC kapısını atlıyor + sipariş `proof_pending` iade penceresinden (auto-refund SLA RPC Mig 070/111 sadece `status='proof_pending'` seçer) çıkıyor.
- `proof-respond`'un **TEK bir çağıranı yok** (grep: hiçbir `.tsx`/`.ts` çağırmıyor; `/onay` finalize kullanıyor) = ölü/legacy kod (CURSOR-NOTLAR-2026-06-12 B2 zaten "ölü/legacy operator_review" işaretlemiş).

**KARAR — matrise EKLEME, kod-fix §3.3:** `proof-respond/route.ts`'i `410 Gone` yap (veya `/onay` finalize'a yönlendir). `proof_pending → in_production` matrise konmaz. Eğer ileride gerçekten istenirse ayrı ürün kararı + `operator_print_review` yine zorunlu.

### 2.2 `proof_pending → operator_review` (proof-respond request_change) — AYNI ölü route

Aynı ölü route'un request_change dalı. `operator_review` ayrıca `AI_QC_ACTIVE_STATUSES` dışı = hiçbir kuyrukta görünmez → sipariş sessizce kaybolur. Kanonik değişiklik-talebi yolu `/onay` içindeki `proof/[itemId]/help` + `proof_validating`. **KARAR — matrise EKLEME, §3.3 ile route kaldırılır/yönlendirilir.**

> Önemli ayrım: `operator_review`'a GİRİŞ matriste açılır (orchestrator AI-fail `proof_generating → operator_review` ve mevcut `proof_validating → operator_review` üzerinden), ama bu giriş `proof-respond`'tan DEĞİL. `operator_review` ÇIKIŞları (§1: `→proof_validating`, `→proof_pending`) AYNI migration'da eklenir → giriş-çıkış simetrisi sağlanır, takılma olmaz.

### 2.3 `operator_print_review` tek-sipariş çıkışı — ÜRÜN BOŞLUĞU (matris çözmez)

`operator_print_review`'a giriş açık (`proof_approved → operator_print_review` mevcut). Ama tek single-order çıkış route'u `ai-qc/decide`, guard'ı `AI_QC_ACTIVE_STATUSES` whitelist'inde `operator_print_review` YOK → satır 82-89 `order_not_in_qc_queue` (400). `isPrintReview` dalları (print_review_approved/fix/cancelled) **ölü kod**. Operatörün baskı-öncesi tek-sipariş onay UI'i çalışmaz; sadece bulk veya admin_override ile çıkılır.

**Matris genişletme bunu ÇÖZMEZ.** Kod-fix §3.5 (ürün kararı gerektirir) + §5 UYARI.

---

## 3. Migration — `190_fsm_forward_matrix_route_alignment.sql`

`CREATE OR REPLACE FUNCTION fn_is_valid_order_forward_transition` — mevcut tüm satırlar korunur, sadece ilgili `from`-dallarına `to` eklenir. `IMMUTABLE` + `SET search_path=public` korunur. Yeni RPC değil → REVOKE/GRANT gerekmez (replace; mevcut grant'lar imza değişmediği için korunur). `fn_is_valid_order_bulk_transition` **değişmez** (adversaryal analiz: tüm bulk `(from→to)` çiftleri zaten karşılanıyor, eksik bulk geçişi yok).

```sql
-- ============================================================
-- Migration 190: FSM forward matris — route gerçeğine hizalama (Seçenek A)
--   Mig 180 merkezileştirmesi sonrası matris route'tan dar kaldı.
--   Bu migration SADECE fn_is_valid_order_forward_transition'ı genişletir.
--   Eklenenler: §1 doğrulanmış route geçişleri + operator_review ölü-uç çıkışları.
--   EKLENMEYENLER (kasıtlı): proof_pending->in_production / ->operator_review
--     (proof-respond ölü/legacy, kod-fix ile kaldırılır),
--     paid->proof_pending (compensating mode'a bırakıldı, cutline-guard route'ta).
--   fn_is_valid_order_bulk_transition DEĞİŞMEZ (tüm bulk çiftleri zaten karşılı).
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_is_valid_order_forward_transition(
  p_from public.order_status,
  p_to public.order_status
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_from = p_to THEN
    RETURN false;
  END IF;
  RETURN CASE p_from
    WHEN 'paid' THEN p_to IN (
      'qc_pending', 'awaiting_upload', 'cancelled'
    )
    -- awaiting_upload: + proof_pending (resume-order-pipeline, cutline mevcut stuck-resume)
    WHEN 'awaiting_upload' THEN p_to IN (
      'qc_pending', 'proof_pending', 'cancelled'
    )
    -- qc_pending: + ready_to_ship (ai-qc approve), human_review_failed (ai-qc reject),
    --             proof_pending (resume + upload-proof)
    WHEN 'qc_pending' THEN p_to IN (
      'proof_generating', 'human_review', 'qc_flagged',
      'ready_to_ship', 'human_review_failed', 'proof_pending', 'cancelled'
    )
    -- qc_flagged: + ready_to_ship (ai-qc approve), proof_generating (ai-qc fix_and_proof),
    --             human_review_failed (ai-qc reject), proof_pending (upload-proof)
    WHEN 'qc_flagged' THEN p_to IN (
      'human_review', 'ready_to_ship', 'proof_generating',
      'human_review_failed', 'proof_pending', 'cancelled'
    )
    -- human_review: + ready_to_ship (ai-qc approve)
    WHEN 'human_review' THEN p_to IN (
      'proof_generating', 'human_review_failed', 'ready_to_ship', 'cancelled'
    )
    -- human_review_failed: + ready_to_ship (ai-qc approve), proof_generating (ai-qc fix_and_proof + QC re-run)
    WHEN 'human_review_failed' THEN p_to IN (
      'qc_pending', 'ready_to_ship', 'proof_generating', 'cancelled'
    )
    -- proof_generating: + operator_review (orchestrator AI verdict=fail dalı)
    WHEN 'proof_generating' THEN p_to IN (
      'proof_pending', 'human_review', 'operator_review'
    )
    -- proof_pending: DEĞİŞMEZ. proof-respond ölü/legacy → kod-fix ile kaldırılıyor;
    --   in_production / operator_review BİLEREK EKLENMEDİ (kalite-kapısı + iade penceresi koruması).
    WHEN 'proof_pending' THEN p_to IN ('proof_approved', 'cancelled')
    -- proof_validating: + proof_generating (after-edit sonrası runProofPipeline adımı)
    WHEN 'proof_validating' THEN p_to IN (
      'proof_pending', 'operator_review', 'proof_generating', 'cancelled'
    )
    WHEN 'proof_approved' THEN p_to IN (
      'ready_to_ship', 'operator_print_review'
    )
    -- operator_review: ÖLÜ-UÇ ÇIKIŞLARI (giriş orchestrator AI-fail + proof_validating'ten gelir).
    --   proof_validating: after-edit doğrulama (orchestrator runProofValidationAfterEdit)
    --   proof_pending: operatör prova reupload (upload-proof)
    WHEN 'operator_review' THEN p_to IN (
      'proof_validating', 'proof_pending', 'cancelled'
    )
    WHEN 'operator_print_review' THEN p_to IN (
      'ready_to_ship', 'proof_generating', 'cancelled'
    )
    WHEN 'ready_to_ship' THEN p_to IN ('in_production', 'fason_assigned')
    WHEN 'fason_assigned' THEN p_to = 'in_production'
    WHEN 'in_production' THEN p_to = 'shipped'
    WHEN 'shipped' THEN p_to = 'delivered'
    WHEN 'delivered' THEN false
    WHEN 'cancelled' THEN false
    ELSE false
  END;
END;
$$;

COMMENT ON FUNCTION public.fn_is_valid_order_forward_transition IS
  'Mig 190 — forward matris route gerçeğine hizalandı. operator_review çıkışları eklendi (ölü-uç kapatma). proof_pending->in_production/operator_review BİLEREK YOK (proof-respond legacy, kod-fix).';
```

> `operator_review`'a `cancelled` eklendi (terminal iptal her durumdan mantıklı; route'ta admin iptali bu durumdan da gelebilir). Diğer terminal-iptal dalları zaten matriste mevcuttu.

---

## 4. Eksik-çıkış kontrol özeti (matrise eklendi → takılma önlendi)

| Durum | Önce (ölü-uç riski) | Sonra |
|---|---|---|
| `operator_review` | from-anahtarı DEĞİL → her giriş kalıcı takılırdı | `→proof_validating, →proof_pending, →cancelled` |
| `proof_generating` | AI verdict=fail operatöre düşürülemezdi | `+operator_review` |
| `proof_validating` | after-edit `proof_generating` adımı takılırdı | `+proof_generating` |
| `qc_*`/`human_review*` | ai-qc approve/reject/fix 400 dönerdi | approve→`ready_to_ship`, reject→`human_review_failed`, fix→`proof_generating` |
| `qc_pending`/`qc_flagged`/`awaiting_upload` | resume + upload-proof 400 | `+proof_pending` |

`operator_review` giriş-çıkış simetrisi **aynı migration'da** sağlanıyor (atomik paket) — kural: `operator_review`'a giriş açan hiçbir ekleme çıkış paketi olmadan canlıya alınmamalı; bu migration ikisini birlikte içerir.

---

## 5. Kod-fix bölümü (matris DEĞİL — ayrı dosya değişiklikleri)

### 3.1 `tracking/route.ts` — sessiz desync + yanıltıcı kargo maili (P0)

**Dosya:** `storefront/src/app/api/admin/orders/[id]/tracking/route.ts` (satır 217-249)

**Sorun:** `transitionOrderStatus` `from=orderRow.status` (DİNAMİK — `paid|qc_pending|proof_pending|…` herhangi non-shipped durum), `to='shipped'`, `mode='forward'`. Forward matriste **sadece `in_production→shipped`** geçerli. Diğer from'lardan `invalid_transition` döner AMA **dönüş kontrol edilmiyor** (satır 219 await edilip atılıyor) → `order_assignments.status='shipped'` + tracking + "kargolandı" maili gider ama `orders.status` DEĞİŞMEZ = desync + müşteriye yanıltıcı bildirim. Route ayrıca `success:true` döner.

**Fix (matrise rastgele `→shipped` EKLEME):**
1. Pre-üretim durumlarından doğrudan `→shipped` mantıken yanlış: **guard ekle** — sadece `in_production` (gerekirse `ready_to_ship`) durumundan kargolamaya izin ver; aksi halde `409` + açık hata mesajı.
2. `transitionOrderStatus` dönüşünü kontrol et: `!result.ok` ise (`unchanged`/`duplicate` hariç) tracking yazma + mail gönderimini **engelle**, hata dön.
3. Mail/assignment güncellemesini **geçiş başarılıysa koşulla** (önce status doğrula, sonra mail).

```ts
// ÖNCE (satır 217-233) yerine:
const orderRow = order as { id: string; status: string };
const ALLOWED_SHIP_FROM: OrderStatus[] = ["in_production", "ready_to_ship"];
if (orderRow.status === "shipped" || orderRow.status === "delivered") {
  // zaten kargoda/teslim — idempotent, status geçişi atla (mevcut davranış)
} else if (!ALLOWED_SHIP_FROM.includes(orderRow.status as OrderStatus)) {
  return NextResponse.json(
    { error: `Sipariş kargolanacak durumda değil (${orderRow.status})` },
    { status: 409 }
  );
} else {
  const shipResult = await transitionOrderStatus(supabase, {
    orderId, to: "shipped", from: orderRow.status as OrderStatus, mode: "forward",
    actorId: auth.user.id, actorRole: auth.role === "admin" ? "admin" : "staff",
    eventType: "status_changed",
    summary: `Kargo takip no eklendi — ${orderRow.status} → shipped`,
    detail: { carrier_code: carrier.code, tracking_number: trackingNumber },
  });
  if (!shipResult.ok && !shipResult.unchanged && !shipResult.duplicate) {
    return NextResponse.json(
      { error: "Sipariş kargo durumuna alınamadı", detail: shipResult.error },
      { status: transitionHttpStatus(shipResult.error) }
    );
  }
}
// → buradan SONRA assignment insert + persistShipmentPoll(sendMail:true) + logOrderEvent
```

> assignment insert + kargo maili bu geçiş bloğundan **sonraya** taşınmalı (şu an üstte; sırayı geçiş başarısıyla koşulla).

### 3.2 `apply-assignment-action.ts` — eksik from + ok-kontrol (P1)

**Dosya:** `storefront/src/lib/fason/apply-assignment-action.ts` (`opts.action==='shipped'` dalı, ~satır 280)

**Sorun:** `transitionOrderStatus to='shipped' mode='forward'` çağrılırken `from` VERİLMİYOR (RPC mevcut durumu çözer) + dönüş kontrol edilmiyor. Mutlu-yol (`in_production→shipped`) çalışır; ama order beklenmedik durumdaysa (ör. operatör `ready_to_ship`'e çekmiş, henüz `in_production` değil) geçiş sessizce başarısız → assignment `shipped`, order eski durumda = desync (tracking/route ile aynı sınıf).

**Fix (matrise ek gerekmez — `in_production→shipped` zaten var):**
```ts
const res = await transitionOrderStatus(admin, {
  orderId, to: "shipped",
  from: ["in_production", "ready_to_ship"],  // AÇIKÇA ver
  mode: "forward", /* … */
});
if (!res.ok && !res.unchanged && !res.duplicate) {
  // logla + hata dön; assignment 'shipped' güncellemesini fason mailinden ÖNCE doğrula
  return { ok: false, error: res.error };
}
```

### 3.3 `proof-respond/route.ts` — ölü/legacy route (P1, §2.1/2.2)

**Dosya:** `storefront/src/app/api/orders/[id]/proof-respond/route.ts`

**Sorun:** Çağıranı YOK (grep: hiçbir UI çağırmıyor; `/onay` finalize kullanıyor). Approve `proof_pending→in_production` (kalite-kapısı + iade penceresi atlama), request_change `proof_pending→operator_review` (görünmez duruma sokar). Matrise eklenirse canlı olmayan bypass mesrulaşır.

**Fix:** Route gövdesini `410 Gone`'a indir (kanonik yol `/onay` → `finalize/route.ts` → `fn_finalize_proof`):
```ts
export async function POST() {
  return NextResponse.json(
    { error: "Bu uç kullanımdan kaldırıldı. Prova onayı /onay sayfasından yapılır." },
    { status: 410 }
  );
}
```
(Mevcut `grant-credit` 410 Gone pattern'iyle tutarlı — bkz. CLAUDE.md.)

### 3.4 `resume-order-pipeline.ts` — `paid→proof_pending` compensating'e çevir (P2, §1)

**Dosya:** `storefront/src/lib/agents/resume-order-pipeline.ts` (satır 68-80)

**Sorun:** Matris "cutline var ise" koşulunu ifade edemez; `paid→proof_pending` matrise düz eklenirse QC+AI atlama kapısı sızar.

**Fix:** `from`'u `['qc_pending','awaiting_upload']` ile sınırla (ikisi matriste var). `paid` durumu için **ayrı `mode='compensating'`** çağrı yap (matris-dışı, audit'li, `cutline_exists` guard'ı zaten üstte koşuluyor):
```ts
if (cutlineCount && cutlineCount > 0) {
  if (status === "qc_pending" || status === "awaiting_upload") {
    await transitionOrderStatus(admin, { orderId, to: "proof_pending",
      from: ["qc_pending", "awaiting_upload"], mode: "forward", /* … */ });
    return { action: "proof_advanced", reason: "cutline_exists" };
  }
  if (status === "paid") {
    // paid->proof_pending matriste YOK (QC-atlama koruması). cutline-guard altında compensating.
    await transitionOrderStatus(admin, { orderId, to: "proof_pending",
      from: ["paid"], mode: "compensating",
      eventType: "status_changed",
      summary: "Pipeline resume (compensating) — cutline mevcut, paid'den proof_pending",
      detail: { reason: "cutline_exists_paid_recovery" }, /* … */ });
    return { action: "proof_advanced", reason: "cutline_exists_paid_recovery" };
  }
  return { action: "none", reason: "cutline_exists_wrong_status" };
}
```

### 3.5 `ai-qc/decide/route.ts` — `operator_print_review` ölü kod / ürün boşluğu (ÜRÜN KARARI)

**Dosya:** `storefront/src/app/api/admin/ai-qc/decide/route.ts` (satır 82-124) + `src/lib/order.ts` (satır 238-243)

**Sorun:** `isPrintReview` dalları yazılmış ama `AI_QC_ACTIVE_STATUSES` whitelist'i `operator_print_review` içermediğinden guard (satır 82-89) `order_not_in_qc_queue` ile reddeder → `isPrintReview` ASLA true → tüm `print_review_*` dalları ölü kod. Baskı-öncesi operatör onay/red/düzeltme tek-sipariş UI'inden YAPILAMAZ. **Matris çözmez.**

**Fix — Sefa ürün kararı gerektirir (iki seçenek, bloklamaz):**
- **(a)** `AI_QC_ACTIVE_STATUSES`'e `operator_print_review` ekle → mevcut `isPrintReview` kodu canlanır (forward matriste `operator_print_review→ready_to_ship/proof_generating/cancelled` ZATEN var). Ardından `ai-qc/queue` route'u da `operator_print_review`'i listelemeli + `reject→cancelled` için iade akışı bağlanmalı.
- **(b)** Ayrı `/api/admin/print-review/decide` route.

> Bu migration kapsamı DIŞINDA. §6 UYARI'da Sefa kararına bırakıldı. Mig 190 olmadan da bu boşluk vardı; 190 onu büyütmez/küçültmez.

---

## 6. UYARI — matris ile çözülmeyen ürün boşlukları (Sefa kararı / ayrı iş)

1. **`operator_print_review` tek-sipariş çıkışı yok** (§3.5). Bugün baskı-öncesi sipariş tek-sipariş ekranında takılır; sadece bulk (`operator_print_review→ready_to_ship`) veya admin_override ile çıkılır. **Üretim/iade dalı erişilemez.** Kod-fix (a) veya (b) gerekir.
2. **AI-QC approve doğrudan `ready_to_ship`** (`qc_*|human_review* → ready_to_ship`): prova + baskı-öncesi inceleme adımını atlar. Matrise eklendi (canlı operatör akışı) ama ürün olarak "operatör bilerek onaylıyor" varsayımına dayanır. Sefa isterse ileride approve→`proof_generating` (prova üret) → normal akışa çevrilebilir (ayrı iş).
3. **`proof-respond` 410'a indirildi** (§3.3): müşteri prova onayı tek otorite `/onay` finalize (`proof_pending→proof_approved→operator_print_review`). Bu davranış değişikliği değil — zaten canlı yol buydu; sadece ölü ikinci yol kapatıldı.

---

## 7. DOĞRULAMA (mig sonrası — staging)

**A. DB-check (fn gövde grep, `verify-cursor-diff`):**
```bash
# Migration 190 apply sonrası fonksiyon gövdesini çek ve yeni geçişleri doğrula:
#   operator_review → proof_validating / proof_pending var mı?
#   proof_generating → operator_review var mı?
#   proof_pending → in_production YOK mu? (olmamalı)
#   bulk fonksiyon DEĞİŞMEMİŞ mi?
SELECT pg_get_functiondef('public.fn_is_valid_order_forward_transition(public.order_status,public.order_status)'::regprocedure);
```
Kontrol listesi (grep çıktıda):
- ✅ `WHEN 'operator_review' THEN p_to IN ('proof_validating', 'proof_pending', 'cancelled')`
- ✅ `proof_generating` dalında `'operator_review'`
- ✅ `proof_validating` dalında `'proof_generating'`
- ✅ qc/human_review dallarında `'ready_to_ship'`, `'human_review_failed'`, `'proof_generating'`, `'proof_pending'` (ilgili)
- ✅ `awaiting_upload` dalında `'proof_pending'`
- ❌ `proof_pending` dalında `'in_production'` veya `'operator_review'` YOK (olmamalı)
- ✅ `fn_is_valid_order_bulk_transition` gövdesi Mig 180 ile birebir aynı (diff = boş)

**B. Staging E2E — her kırık akış artık 200:**
| Akış | Beklenen |
|---|---|
| `ai-qc/decide` approve (qc_pending) | 200, status→`ready_to_ship` |
| `ai-qc/decide` fix_and_proof (qc_flagged) | 200, status→`proof_generating` |
| `ai-qc/decide` reject (qc_pending) | 200, status→`human_review_failed` |
| `upload-proof` (qc_pending / qc_flagged / operator_review) | 200, status→`proof_pending` |
| orchestrator after-edit (operator_review→proof_validating→proof_generating) | takılma yok, pipeline ilerliyor |
| orchestrator AI verdict=fail (proof_generating→operator_review) | 200, sonra operatör çıkışı çalışıyor |
| `resume-order-pipeline` cutline+qc_pending/awaiting_upload | status→`proof_pending` (forward) |
| `resume-order-pipeline` cutline+paid | status→`proof_pending` (compensating, audit kaydı var) |
| `tracking` POST, order `paid`/`qc_pending` durumunda | **409** (artık desync YOK), mail gitmiyor |
| `tracking` POST, order `in_production` | 200, status→`shipped`, mail gidiyor |
| `proof-respond` POST (herhangi action) | **410 Gone** |

**C. Müşteri prova kanonik yolu (regresyon kontrolü):** `/onay` → finalize → `proof_pending→proof_approved→operator_print_review` hâlâ 200 (proof-respond 410'a indirilince kırılmamalı).

**D. `operator_review` simetri kontrolü:** request-change ile `operator_review`'a giren sipariş (orchestrator/bulk üzerinden) → operatör `upload-proof` ile `proof_pending`'e çıkabiliyor VE after-edit `proof_validating`'e gidebiliyor (artık kalıcı takılmıyor).

---

## 8. Notlar
- Kaynak regresyon dosyası: `core/docs/FSM-MATRIX-REGRESYON-2026-06-14.md` (P0-1a, P0-3a, P0-6 referansları bu dokümanla hizalı).
- Mig 180: `core/storefront/supabase/migrations/180_order_transition_infrastructure.sql` (mevcut matris kaynağı).
- En yüksek mevcut migration **189** → yeni dosya **190** (`190_fsm_forward_matrix_route_alignment.sql`).
- `fn_is_valid_order_bulk_transition` BU MIGRATION'DA DEĞİŞMEZ — gereksiz `CREATE OR REPLACE` ekleme.
- Push YOK; Claude doğrulayacak. Migration apply ve staging E2E sonrası rapor edilecek.