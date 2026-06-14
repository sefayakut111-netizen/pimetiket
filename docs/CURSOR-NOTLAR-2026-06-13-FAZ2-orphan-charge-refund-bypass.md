# Cursor Görevi — FAZ 2 / Para launch-blocker: Orphan Charge (M2) + İade Bypass (M8)

> 13 Haz 2026 · Claude mimari + 3 çok-ajanlı tarama (doğrula → tasarım → adversaryal kritik → revizyon → yeniden adversaryal). 2 tur kritik 7 edge-case yakaladı; tasarım yakınsadı.
> Branch: `claude/file-review-updates-vnd6og`. **YENİ MIGRATION YOK** — hepsi mevcut RPC/helper ile TS/route değişikliği (`casUpdate`, `fn_transition_order_status`, `fn_release_coupon_reservation`, `notifyAdminCriticalAlert` ZATEN VAR).

---

## 0) Bağlam

İki para-akışı launch-blocker'ı:
- **Orphan charge (M2):** PayTR tahsil etti ama bizde sipariş/iz yok/uyumsuz → para yetim.
- **İade bypass (M8):** `refunded` gerçek para iadesi olmadan set edilebiliyor + iade durum-makinesinde validasyon yok + admin UI `force:true` ile "baskı sonrası iade yok" kuralını bypass ediyor.

**Adversaryal düzeltme (önemli):** M2-#1'in "orphan" gerekçesi fazla abartılıydı — `createCheckoutToken` (paytr.ts) sadece get-token çağırır, **kart çekmez**; reserve-fail'de init 500/400 döner, müşteri iframe'i **görmez** → o yolda orphan **imkansız**. O yüzden reconciler'a kol EKLENMEZ; sadece kupon kilidini aç + intent'i görünür bırak.

---

## A) ORPHAN CHARGE (M2) — 3 dosya

### A1 · `src/app/api/payment/init/route.ts` (M2-#1, reserve-fail dalları ~L456-461 ve ~L469-474)
İki `await admin.from("payment_intents").delete().eq("id", merchantOid)` çağrısını **KALDIR**. Yerine (her iki dalda da — reserveErr/500 ve !reserve.ok/400):
```ts
// Token zaten canlı; intent'i SİLME. Kuponu serbest bırak + intent'i 'failed' işaretle (görünürlük + audit).
await admin.rpc("fn_release_coupon_reservation", { p_payment_intent_id: merchantOid }); // idempotent, no-op safe
await casUpdate(admin, "payment_intents", merchantOid,
  { status: "failed", failure_reason: "coupon_reserve_failed" },
  { expectFrom: "pending", col: "status" });
```
HTTP yanıtı (500/400) **korunur**. `import { casUpdate } from "@/lib/db/cas-update"`. Mig 175 trigger'ı `failed`'de `coupon_reservations`'ı zaten release eder; explicit RPC çift-emniyet + supersede deseniyle tutarlı (init L346 zaten çağırıyor).

### A2 · `src/app/api/payment/callback/route.ts` — iki ekleme
**(M2-#2) intent-missing dalı (~L197-218):** mevcut Sentry+audit+"OK"'i KORU, EK olarak yalnız `isSuccess===true` iken:
```ts
const { notifyAdminCriticalAlert } = await import("@/lib/mail/admin-critical-alert");
void notifyAdminCriticalAlert({
  alertKey: `intent_missing:${merchantOid}`,
  subject: `🚨 PayTR success ama intent yok — ${merchantOid}`,
  title: "Orphan charge riski — intent bulunamadı",
  body: `merchant_oid: ${merchantOid}\nPayTR success bildirdi ama payment_intents kaydı yok. PayTR panelinden tahsilatı doğrula.`,
  targetType: "cart", targetId: merchantOid,
  extra: { admin_link: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/finans?tab=odemeler` },
}).catch(() => {});
return new NextResponse("OK"); // retry durdur — doğru
```
Pattern: aynı dosyada amount_mismatch (L262-306) deseni birebir.

**(M2-#3 YENİ) failed-intent + success guard — `fn_finalize` çağrısından (~L355) ÖNCE**, mevcut `consumed`-skip (L223) / `needs_review`-skip (L228) guard'larının yanına:
```ts
// fn_finalize YALNIZ 'consumed' atlar; 'failed' intent'ten sipariş OLUŞTURUR (078). Success IPN failed intent'e çarparsa:
if (isSuccess && intent.status === "failed") {
  void notifyAdminCriticalAlert({ alertKey: `charge_on_failed_intent:${merchantOid}`,
    subject: `🚨 PayTR success ama intent 'failed' — ${merchantOid}`,
    title: "Failed intent'e tahsilat — manuel inceleme",
    body: `failure_reason: ${intent.failure_reason}. Gerçek tahsilat olduysa yetim.`,
    targetType: "cart", targetId: merchantOid,
    extra: { admin_link: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/finans?tab=odemeler` } }).catch(()=>{});
  // Sessiz sipariş AÇMA; gerçek charge kaybolmasın → needs_review kuyruğuna yükselt.
  await admin.from("payment_intents").update({ status: "needs_review", failure_reason: `charge_on_failed:${intent.failure_reason ?? ""}` })
    .eq("id", merchantOid).eq("status", "failed");
  return new NextResponse("OK");
}
```
**KONUM KRİTİK** (load-bearing): finalize RPC'sinden ÖNCE olmalı, yoksa failed intent'ten sessiz sipariş + çift kayıt.

### A3 · `src/lib/payment/recover-pending-intent.ts` — iki değişiklik (M2-#6 + mustFix#5)
**(M2-#6) `finalizeFromPaytrSuccess` amount-mismatch dalı (~L142-149):** `status:'failed'` YERİNE callback ile simetrik:
```ts
await admin.from("payment_intents").update({ status: "needs_review", failure_reason: `amount_mismatch:${expectedKurus}!=${opts.totalAmountKurus}` }).eq("id", intent.id);
Sentry.captureMessage("payment_amount_mismatch_orphan_risk", { level: "error", tags: { merchantOid: intent.id }, extra: { expectedKurus, incoming: opts.totalAmountKurus } });
const { notifyAdminCriticalAlert } = await import("@/lib/mail/admin-critical-alert");
void notifyAdminCriticalAlert({ alertKey: `amount_mismatch:${intent.id}`, subject: `🚨 PayTR tutar uyumsuzluğu (recover) — ${intent.id}`, title: "orphaned charge riski", body: `expected:${expectedKurus} incoming:${opts.totalAmountKurus}`, targetType: "cart", targetId: intent.id, extra: { admin_link: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/finans?tab=odemeler` } }).catch(()=>{});
return { status: "failed", reason: "needs_review" }; // polling fail-sayfasına gider
```
**(mustFix#5) non-pending erken-return (~L296-298):** `if (intent.status !== "pending") return { status: "pending" }`'den ÖNCE, `failed` guard'ından (L289) sonra ekle:
```ts
if (intent.status === "needs_review") return { status: "failed", reason: intent.failure_reason ?? "needs_review" };
```
Yoksa needs_review intent polling'de **sonsuz 'pending'** döner (kullanıcı odeme-sonuc'ta takılır).

> **Reconciler'a DOKUNMA.** Gerçek IPN-miss orphan'ı (pending intent + PayTR success) mevcut `paytr-reconciler` zaten yakalıyor.

---

## B) İADE BYPASS (M8) — returns FSM + tek refunded yolu

**returns FSM (DB enum sabit: pending|approved|rejected|refunded):**
```
pending  → {approved, rejected}          (status route)
approved → {rejected (status route), refunded (YALNIZ payment/refund)}
rejected → ∅ terminal      refunded → ∅ terminal
```

### B1+B2 · `src/app/api/admin/returns/[id]/status/route.ts`
- **B2:** `BodySchema.status` `z.enum(["approved","rejected","refunded"])` → **`z.enum(["approved","rejected"])`** ('refunded' kaldır — admin elle parasız refunded yapamasın).
- **B1:** koşulsuz `.update().eq("id",returnId)` (~L82-87) YERİNE `casUpdate` FSM:
```ts
import { casUpdate } from "@/lib/db/cas-update";
const expectFrom = body.status === "approved" ? ["pending"] : ["pending", "approved"]; // rejected
const cas = await casUpdate(admin, "returns", returnId, updatePayload, { expectFrom, col: "status", select: "*" });
if (!cas.ok) return NextResponse.json(
  cas.reason === "stale" ? { error: "return_status_conflict", hint: "İade durumu değişmiş, listeyi yenile" } : { error: "update_failed" },
  { status: cas.reason === "stale" ? 409 : 500 });
// mail + order_events cas.row ile devam
```
existing fetch (L50-58) mail için korunur; otorite artık casUpdate'in atomik `.eq(status)`'ü.

### B3 · `src/app/api/payment/refund/route.ts` (returnId precondition + cas)
charge lookup'tan **ÖNCE**, `body.returnId` varsa:
```ts
const { data: ret } = await admin.from("returns").select("id, order_id, status").eq("id", body.returnId).maybeSingle();
if (!ret) return NextResponse.json({ error: "return_not_found" }, { status: 404 });
if (ret.order_id !== body.orderId) return NextResponse.json({ error: "return_order_mismatch" }, { status: 409 });
if (ret.status !== "approved") return NextResponse.json({ error: "return_not_approved", hint: "Yalnız onaylanmış iade talebi para iadesine çevrilebilir" }, { status: 409 });
```
PayTR success SONRASI returns update'i (~L310-318) `casUpdate(admin,"returns",body.returnId,{refund_payment_id,refund_amount:refundAmount,status:"refunded"},{expectFrom:"approved"})`. cas stale → order_events'e uyarı logla ama **200 dön** (para zaten gitti). `returnId` YOKKEN (admin/payments/refund proxy) bu blok atlanır.

### B12 · `src/app/api/payment/refund/route.ts` (tam iade → orders cancelled)
PayTR success + order_events sonrası:
```ts
if (!isPartial && body.returnId) { // ← returnId-gate (proxy'yi koru — sadece-para-iadesi happy-path)
  const t = await transitionOrderStatus(admin, { orderId: body.orderId, to: "cancelled", mode: "admin_override",
    actorId: auth.user.id, actorRole: auth.role === "admin" ? "admin" : "staff",
    eventType: "status_changed", summary: `Tam iade sonrası iptal (returnId ${body.returnId})`,
    idempotencyKey: `refund_cancel:${body.orderId}` });
  if (!t.ok) console.warn("[refund] order transition non-fatal:", t.error); // ← SADECE LOG; HTTP'ye YANSITMA
}
```
**ÖNEMLİ (applier):** `transitionOrderStatus` sonucu ASLA HTTP status'a yansıtılmaz — `admin_override` delivered/cancelled'ı terminal sayar (mig 180), delivered siparişte 'terminal' döner ama para zaten iade edildi → 200 dön, sadece logla. `import { transitionOrderStatus } from "@/lib/db/transition-order-status"`. order_status enum'da 'refunded' YOK → hedef 'cancelled' (yeni enum eklenmez).

### B4 · `src/app/admin/iadeler/page.tsx` (force'suz-önce-dene)
`handleRefund`'daki hard-code `force: true` (~L153) KALDIR. İki adım: (1) önce force'suz POST; (2) `res.status===422 && error==="post_production_refund_blocked"` ise modal/confirm ("Sipariş {data.status} — baskı sonrası iade kuralı. Yine de devam?"; reason zaten alınmış) → onayda `force:true`+reason ile RE-POST. Diğer hatalar (409 return_not_approved / 400 return_order_mismatch) → `toast.error(data.hint)`.
> Not: onaylı iadeler genelde post-production olduğundan modal sık çıkar — bu **kasıtlı** (Sefa kuralı: baskı sonrası iade bilinçli onay ister).

---

## C) Paylaşılan desenler (hepsi MEVCUT — yeni icat yok)
- `casUpdate` (src/lib/db/cas-update.ts): `.update().eq(id).eq(col,expectFrom)` + PGRST116→stale. returns FSM + payment_intents için.
- `fn_transition_order_status` (mig 180, wrapper transition-order-status.ts): orders.status tek chokepoint, admin_override.
- `fn_release_coupon_reservation` (mig 175): idempotent kupon serbest bırakma.
- `notifyAdminCriticalAlert` (admin-critical-alert.ts): alertKey-idempotent mail.

## D) Kararlar / kapsam
- **YENİ MIGRATION YOK, yeni enum/RPC YOK** (altın kural).
- Tam iade → orders **'cancelled'** (yeni 'refunded' enum eklenmez; iade payments'tan izlenir).
- **Kısmi iade tek-seferlik** (Mig 069 order başına 1 aktif refund — kasıtlı çift-PayTR-call koruması). Route'a yorum düş. Çoklu-partial gerekirse ayrı iş.
- **Ertelenen (ayrı süpürme):** M2 #3 IP-allowlist (PayTR statik IP yayınlamıyor — YAPILAMAZ, plandan çıktı), #4/#5 abandon-yarışı, #7-13; M8 B5-B17. Bunlar launch-blocker değil.

## E) Sefa'ya açık (varsayılanla ilerlendi, override edebilir)
1. Tam iade = sipariş 'cancelled' (event_type status_changed) — yeterli mi yoksa ayrı 'refunded' order enum'u mu istenir?
2. Çoklu-partial iade gerçek senaryo mu (kargo farkı + ürün farkı ayrı)? Evetse Mig 069 predicate genişletme ayrı iş.

## F) DİKKAT (yapma listesi)
- ❌ Token üretildikten sonra intent'i DELETE etme (init) — 'failed' işaretle.
- ❌ callback failed-guard'ını finalize'dan SONRA koyma (sessiz sipariş açar).
- ❌ B12 transition sonucunu HTTP'ye yansıtma (delivered-terminal happy-path kırar).
- ❌ reconciler'a kol ekleme (orphan o yolda yok; gereksiz + kupon-tüketim bug riski).
- ❌ status route'tan 'refunded' yazma yolu bırakma.
- ❌ Push etme — Claude build + mantık doğrulayacak.

## G) Sıra
1. Cursor: A1-A3 + B1/B2/B3/B12/B4 uygula, `npm run build`, commit (**push yok**).
2. Claude: build + değişiklik mantığını doğrula (özellikle callback guard konumu + B12 returnId-gate + casUpdate FSM).
3. **Canlıya/merge öncesi:** staging'de ödeme + iade akışı manuel test (gerçek PayTR test kartı) önerilir — money path.
