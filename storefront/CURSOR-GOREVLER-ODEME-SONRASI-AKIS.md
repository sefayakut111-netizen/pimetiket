# Cursor Ödeme Sonrası Akış Düzeltmeleri — KRİTİK

> Claude Code (mimari) tarafından hazırlanmıştır.
> **ÖNCELİK: TÜM DİĞER GÖREVLERDEN ÖNCE YAPILMALI**
> Bu akış kırık olduğu sürece hiçbir sipariş ilerleyemez.
> 7 görev, kesin sırayla uygulanacak.

---

## SORUN ÖZETİ

Ödeme sonrası 3 kritik kırıklık:

1. **runOrderDesignQC() zamanlama yarışı** — payment callback'te dosyalar henüz promote edilmeden QC tetikleniyor → 0 dosya buluyor → erken dönüyor → AI hiç çalışmıyor
2. **Sonradan yüklenen tasarım QC tetiklemiyor** — upload-complete sadece mock stub çağırıyor, gerçek GPT-4o QC hiç tetiklenmiyor
3. **Sipariş detay sayfası adımları kırık** — status transition düzgün olmadığı için timeline ilerlemez

---

## GÖREV 1/7 — Payment Callback'ten QC Çağrısını Kaldır

### Sorun
`src/app/api/payment/callback/route.ts` satır ~400'de `void runOrderDesignQC(admin, orderId)` fire-and-forget çağrılıyor. Bu çağrı dosyalar promote edilmeden çalışabilir → 0 dosya → erken dönüş.

### Dosya: `src/app/api/payment/callback/route.ts`

Satır ~400 civarında şu satırı bul:

```typescript
void runOrderDesignQC(admin, orderId);
```

**Kaldır** veya yorum yap:

```typescript
// QC artık payment callback'ten değil, upload-complete'ten tetikleniyor.
// Tasarım varsa upload-complete zaten çağırır.
// Tasarım yoksa awaiting_upload'da bekler, müşteri yükleyince tetiklenir.
// void runOrderDesignQC(admin, orderId);  // KALDIRILDI — Görev 2'ye bak
```

Eğer sipariş tasarımla birlikte ödendiyse (designTempId var), `promoteOrderDesigns()` bittikten SONRA QC tetiklemek lazım. Bunu Görev 2'de yapıyoruz.

### Doğrulama
- Payment callback'te `runOrderDesignQC` çağrılmıyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 2/7 — Design Promote Sonrası QC Tetikle

### Sorun
`promoteOrderDesigns()` dosyaları temp'ten kalıcıya taşıyor ama sonra kimse QC tetiklemiyor.

### Dosya: `src/app/api/payment/callback/route.ts`

`promoteOrderDesigns()` çağrısını bul (satır ~331-342 civarı). Hemen SONRASINA:

```typescript
// Mevcut:
await promoteOrderDesigns(admin, orderId, cartSnapshot);

// YENİ — promote bittikten sonra QC tetikle (dosyalar artık yerinde):
const { data: designFiles } = await admin
  .from("design_files")
  .select("id")
  .eq("order_id", orderId)
  .in("status", ["uploaded", "analyzing", "qc_passed", "qc_warned"]);

if (designFiles && designFiles.length > 0) {
  // Dosyalar promote edildi, artık QC güvenle çalışabilir
  // 2sn gecikme — DB transaction commit'i garantile
  setTimeout(() => {
    void runOrderDesignQC(admin, orderId).catch((err) => {
      console.error("[payment/callback] QC trigger failed:", err);
      // QC başarısız olursa sipariş human_review'a düşer (run-order-qc.ts circuit breaker)
    });
  }, 2000);
}
// Dosya yoksa: awaiting_upload'da kalır, müşteri yükleyince Görev 3 tetikler
```

### Doğrulama
- Tasarımlı sipariş → ödeme → 2sn sonra QC çalışıyor
- Tasarımsız sipariş → awaiting_upload'da kalıyor (QC tetiklenmiyor — doğru)
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 3/7 — Upload-Complete'ten Gerçek QC Tetikle

### Sorun
`src/app/api/design/upload-complete/route.ts` satır ~209'da `runDesignAiCheck(fileId)` çağrılıyor — bu MOCK STUB. Gerçek `runOrderDesignQC()` hiç çağrılmıyor.

### Dosya: `src/app/api/design/upload-complete/route.ts`

Mevcut mock çağrısını bul (satır ~209 civarı):

```typescript
// ESKİ:
void runDesignAiCheck(fileId);
```

Değiştir:

```typescript
// Mock stub kaldırıldı — gerçek QC tetikleniyor
// 1. Sipariş ID'yi bul (design_files → order_item → order)
const { data: fileRow } = await admin
  .from("design_files")
  .select("order_item_id")
  .eq("id", fileId)
  .single();

if (fileRow?.order_item_id) {
  const { data: itemRow } = await admin
    .from("order_items")
    .select("order_id")
    .eq("id", fileRow.order_item_id)
    .single();

  if (itemRow?.order_id) {
    const orderId = itemRow.order_id;

    // 2. Sipariş hâlâ QC bekliyor mu?
    const { data: orderRow } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();

    const qcTriggerStatuses = [
      "awaiting_upload", "paid", "qc_pending",
      "proof_pending", "proof_generating",
    ];

    if (orderRow && qcTriggerStatuses.includes(orderRow.status)) {
      // 3. Gerçek QC tetikle (GPT-4o Vision)
      const { runOrderDesignQC } = await import("@/lib/agents/run-order-qc");
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const adminClient = createAdminClient();

      void runOrderDesignQC(adminClient, orderId).catch((err) => {
        console.error("[upload-complete] QC trigger failed:", err);
      });
    }
  }
}
```

### Mock stub fonksiyonu

Dosyanın altındaki `runDesignAiCheck()` fonksiyonunu tamamen kaldır veya `@deprecated` işaretle:

```typescript
/**
 * @deprecated — Gerçek QC artık runOrderDesignQC() ile yapılıyor.
 * Bu fonksiyon sadece geriye uyumluluk için duruyor.
 * Yeni upload'larda çağrılmıyor.
 */
async function runDesignAiCheck(fileId: string): Promise<void> {
  // STUB — artık kullanılmıyor
  return;
}
```

### Doğrulama
- Müşteri dosya yükle → upload-complete → runOrderDesignQC tetikleniyor
- design_quality_checks tablosunda yeni kayıt oluşuyor
- Sipariş status'u ilerliyor (proof_generating veya human_review)
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 4/7 — Migration 061 Trigger Düzeltmesi

### Sorun
Migration 061'deki `fn_design_uploaded_advance_status()` trigger'ı design_files INSERT'te ateşleniyor ama race condition var — dosya status'u henüz 'analyzing' iken trigger proof_pending'e geçiriyor, ama QC henüz başlamamış.

### Yeni migration: `supabase/migrations/105_fix_design_upload_trigger.sql`

```sql
-- ============================================================
-- Migration 105 — Design upload trigger düzeltmesi
--
-- Sorun: Mig 061 trigger'ı design_files INSERT'te ateşleniyor
-- ve order status'unu proof_pending'e çekiyor. Ama QC henüz
-- çalışmamış — status direkt qc_pending olmalı (QC'yi bekle).
--
-- Düzeltme: awaiting_upload → qc_pending (proof_pending DEĞİL)
-- QC tamamlanınca run-order-qc.ts status'u proof_generating
-- veya human_review'a çeker.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_design_uploaded_advance_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id text;
  v_current_status text;
BEGIN
  -- Sadece yeni INSERT edilen design_files için
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- design_files → order_items → orders
  SELECT oi.order_id INTO v_order_id
  FROM public.order_items oi
  WHERE oi.id = NEW.order_item_id;

  IF v_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_current_status
  FROM public.orders
  WHERE id = v_order_id;

  -- Sadece awaiting_upload'dan ilerlet
  IF v_current_status = 'awaiting_upload' THEN
    UPDATE public.orders
    SET status = 'qc_pending'   -- proof_pending DEĞİL, QC'yi bekle
    WHERE id = v_order_id;

    INSERT INTO public.order_events (
      order_id, event_type, status_after, actor_role, summary
    ) VALUES (
      v_order_id,
      'design_uploaded_status_advance',
      'qc_pending',
      'system',
      'Tasarım yüklendi — AI kalite kontrolü başlatılıyor'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger zaten var (Mig 061), fonksiyon güncellendi — trigger yeniden oluşturmaya gerek yok
```

### Doğrulama
- Müşteri dosya yükle → sipariş awaiting_upload'dan qc_pending'e geçiyor (proof_pending DEĞİL)
- order_events'te 'design_uploaded_status_advance' kaydı var
- QC tamamlanınca status proof_generating veya human_review oluyor

---

## GÖREV 5/7 — run-order-qc.ts Güvenlik İyileştirmesi

### Sorun
`runOrderDesignQC()` dosya bulamazsa sessizce erken dönüyor. Hiçbir log, event veya status değişikliği yok.

### Dosya: `src/lib/agents/run-order-qc.ts`

Satır ~234 civarında "no design files" early return'ü bul:

```typescript
// ESKİ (satır ~234):
if (!designFiles || designFiles.length === 0) {
  return; // sessiz
}
```

Değiştir:

```typescript
if (!designFiles || designFiles.length === 0) {
  console.warn(`[run-order-qc] Order ${orderId}: no design files found — skipping QC`);

  // Sipariş hâlâ awaiting_upload ise dokunma (müşteri henüz yüklememiş)
  const { data: order } = await admin
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  if (order?.status === "awaiting_upload") {
    // Beklenen durum — sessiz dön
    return;
  }

  // Başka status'taysa ama dosya yok → anormal durum, log yaz
  console.error(`[run-order-qc] Order ${orderId} status=${order?.status} but 0 design files — possible data issue`);

  // order_events'e kaydet — admin dashboard'da görünsün
  await admin.from("order_events").insert({
    order_id: orderId,
    event_type: "qc_skipped_no_files",
    status_after: order?.status ?? "unknown",
    actor_role: "system",
    summary: "QC atlandı — tasarım dosyası bulunamadı",
    detail: { trigger: "runOrderDesignQC", designFileCount: 0 },
  });

  return;
}
```

### QC başarılı tamamlandığında status güncelleme kontrolü

Satır ~341-363 civarında aggregate verdict sonrası status güncelleme var. Kontrol et ki proof_generating'e geçmeden önce sipariş hâlâ uygun status'ta olsun:

```typescript
// Status güncelleme öncesi guard:
const { data: currentOrder } = await admin
  .from("orders")
  .select("status")
  .eq("id", orderId)
  .single();

const qcAllowedStatuses = [
  "paid", "awaiting_upload", "qc_pending",
  "qc_flagged", "human_review", "human_review_failed",
];

if (!currentOrder || !qcAllowedStatuses.includes(currentOrder.status)) {
  console.warn(`[run-order-qc] Order ${orderId} status=${currentOrder?.status} — not in QC-allowed range, skipping status update`);
  return;
}

// Mevcut status güncelleme kodu...
```

### Doğrulama
- Dosya yoksa → log yazılıyor + event kaydı
- awaiting_upload'daysa → sessiz dön (beklenen)
- Başka status'taysa → uyarı log + event
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 6/7 — Sipariş Detay Sayfası Timeline Düzeltmesi

### Sorun
`/siparis/[id]` sayfasındaki adım timeline'ı status transition'lara bağlı. Status'lar düzgün ilerlemiyor olunca adımlar kırık görünüyor.

### Dosya: `src/app/siparis/[id]/page.tsx`

Timeline/phases bölümünü bul (satır ~135-148 civarı). Her adımın "aktif" ve "tamamlandı" durumunu status'a göre belirle:

```typescript
const STATUS_PHASE_MAP: Record<string, number> = {
  paid: 1,
  awaiting_upload: 2,
  qc_pending: 3,
  qc_flagged: 3,
  human_review: 3,
  human_review_failed: 3,
  operator_review: 3,
  proof_generating: 4,
  proof_validating: 4,
  proof_pending: 5,
  proof_approved: 6,
  ready_to_ship: 7,
  fason_assigned: 7,
  in_production: 8,
  shipped: 9,
  delivered: 10,
  cancelled: -1,
};

const PHASES = [
  { n: 1, label: locale === 'en' ? 'Order placed' : 'Sipariş verildi' },
  { n: 2, label: locale === 'en' ? 'Design upload' : 'Tasarım yükleme' },
  { n: 3, label: locale === 'en' ? 'AI quality check' : 'AI kalite kontrol' },
  { n: 4, label: locale === 'en' ? 'Proof preparation' : 'Prova hazırlık' },
  { n: 5, label: locale === 'en' ? 'Your approval' : 'Senin onayın' },
  { n: 6, label: locale === 'en' ? 'Approved' : 'Onaylandı' },
  { n: 7, label: locale === 'en' ? 'Production' : 'Üretime hazır' },
  { n: 8, label: locale === 'en' ? 'Manufacturing' : 'Üretimde' },
  { n: 9, label: locale === 'en' ? 'Shipped' : 'Kargoda' },
  { n: 10, label: locale === 'en' ? 'Delivered' : 'Teslim edildi' },
];

const currentPhase = STATUS_PHASE_MAP[order.status] ?? 0;
```

Her adım render'ında:

```typescript
{PHASES.map((phase) => {
  const isComplete = currentPhase > phase.n;
  const isCurrent = currentPhase === phase.n;
  const isCancelled = order.status === 'cancelled';

  return (
    <div key={phase.n} className="flex items-center gap-3">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0",
        isCancelled ? "bg-kirmizi-soft text-kirmizi" :
        isComplete ? "bg-yesil text-white" :
        isCurrent ? "bg-pim-mercan text-white animate-pulse" :
        "bg-gri-100 text-gri-500"
      )}>
        {isCancelled ? '✕' : isComplete ? '✓' : phase.n}
      </div>
      <span className={cn(
        "text-[13px]",
        isComplete ? "text-yesil font-semibold" :
        isCurrent ? "text-lacivert font-semibold" :
        "text-gri-500"
      )}>
        {phase.label}
        {isCurrent && !isCancelled && (
          <span className="text-[11px] text-pim-mercan ml-2">← şu an burada</span>
        )}
      </span>
    </div>
  );
})}
```

### Ek: awaiting_upload'dayken CTA göster

```typescript
{order.status === 'awaiting_upload' && (
  <div className="mt-4 rounded-xl bg-sari-soft/30 ring-1 ring-sari/30 p-4">
    <div className="font-semibold text-[14px] text-sari-koyu mb-1">
      📁 Tasarım dosyanı yükle
    </div>
    <p className="text-[13px] text-gri-700 mb-3">
      Siparişin ilerlemesi için tasarım dosyanı yüklemen gerekiyor.
    </p>
    <Button variant="primary" size="sm" href={`/siparis/${order.id}/tasarim-yukle`}>
      Tasarım yükle →
    </Button>
  </div>
)}

{order.status === 'qc_pending' && (
  <div className="mt-4 rounded-xl bg-mavi-soft/20 ring-1 ring-mavi/30 p-4">
    <div className="font-semibold text-[14px] text-mavi-koyu mb-1">
      🤖 AI kalite kontrolü yapılıyor
    </div>
    <p className="text-[13px] text-gri-700">
      Tasarımın AI tarafından kontrol ediliyor. Genellikle birkaç dakika sürer.
    </p>
  </div>
)}

{order.status === 'proof_pending' && (
  <div className="mt-4 rounded-xl bg-pim-mercan-tint/30 ring-1 ring-pim-mercan/30 p-4">
    <div className="font-semibold text-[14px] text-pim-mercan mb-1">
      ✋ Prova onayın bekleniyor
    </div>
    <p className="text-[13px] text-gri-700 mb-3">
      Bıçak çizimi ve baskı provası hazır. Kontrol edip onayla.
    </p>
    <Button variant="primary" size="sm" href={`/onay/${order.id}`}>
      Provayı incele →
    </Button>
  </div>
)}
```

### Doğrulama
- awaiting_upload → "Tasarım yükle" CTA görünüyor, 2. adım aktif
- qc_pending → "AI kontrol" mesajı, 3. adım pulse animasyonlu
- proof_pending → "Prova onayla" CTA, 5. adım aktif
- delivered → tüm adımlar yeşil ✓
- cancelled → tüm adımlar gri, ✕ ikonu
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 7/7 — Ödeme Sonuç Sayfası Akıllı CTA

### Sorun
`/odeme-sonuc` müşteriyi `/siparis/[id]`'ye yönlendiriyor ama arada ne yapması gerektiğini söylemiyor.

### Dosya: `src/app/odeme-sonuc/page.tsx`

Başarılı ödeme sonrasında, sipariş status'una göre farklı CTA göster:

```typescript
// Ödeme başarılı section'da:
{paymentSuccess && orderId && (
  <div className="mt-6 space-y-3">
    {/* Ana CTA — siparişin durumuna göre */}
    {orderHasDesigns ? (
      <>
        <p className="text-[14px] text-gri-700">
          Tasarımın yüklendi — AI kalite kontrolü başlıyor. Birkaç dakika sonra provayı inceleyebilirsin.
        </p>
        <Button variant="primary" href={`/siparis/${orderId}`}>
          Sipariş detayını gör →
        </Button>
      </>
    ) : (
      <>
        <p className="text-[14px] text-gri-700">
          Siparişin oluştu! Şimdi tasarım dosyanı yükle — AI kontrol edecek ve baskı provası hazırlanacak.
        </p>
        <Button variant="primary" href={`/siparis/${orderId}/tasarim-yukle`}>
          📁 Tasarım yükle →
        </Button>
        <Button variant="ghost" href={`/siparis/${orderId}`}>
          Sonra yükleyeceğim — sipariş detayı
        </Button>
      </>
    )}
  </div>
)}
```

`orderHasDesigns` nasıl belirlenir:

```typescript
// URL'den veya API'den:
// Seçenek A: odeme-sonuc?orderId=X&hasDesigns=true (payment callback redirect'te set et)
// Seçenek B: /siparis/[id] API'den order.status kontrol (awaiting_upload = tasarım yok)
const orderHasDesigns = searchParams.get('hasDesigns') === 'true';
```

Payment callback'te redirect URL'e `hasDesigns` parametresi ekle:

```typescript
// payment/callback/route.ts — redirect URL oluştururken:
const hasDesigns = designFiles && designFiles.length > 0;
const redirectUrl = `/odeme-sonuc?status=success&order=${orderId}&hasDesigns=${hasDesigns}`;
```

### Doğrulama
- Tasarımlı sipariş → "Sipariş detayını gör" CTA
- Tasarımsız sipariş → "Tasarım yükle" CTA (büyük, belirgin)
- `npx tsc --noEmit` → 0 hata

---

## AKIş DİYAGRAMI (düzeltme sonrası)

```
Müşteri ödeme yaptı
  │
  ├── PayTR IPN → /api/payment/callback
  │     ├── fn_finalize_paid_order → order INSERT (status: paid)
  │     ├── Migration 061 trigger:
  │     │     ├── Tasarım VAR → status: qc_pending (ESKİ: proof_pending)
  │     │     └── Tasarım YOK → status: awaiting_upload
  │     ├── promoteOrderDesigns (temp → kalıcı)
  │     ├── (Tasarım varsa) 2sn sonra runOrderDesignQC() ← Görev 2
  │     └── Redirect: /odeme-sonuc?hasDesigns=true|false ← Görev 7
  │
  ├── Tasarım VARSA:
  │     runOrderDesignQC → GPT-4o Vision
  │       ├── Tüm iyi → status: proof_generating → cutline + beyaz
  │       └── Sorun var → status: human_review → /admin/ai-qc
  │
  ├── Tasarım YOKSA:
  │     awaiting_upload → müşteri /siparis/[id]/tasarim-yukle
  │       → upload-complete → runOrderDesignQC() ← Görev 3
  │       → Migration 105 trigger: awaiting_upload → qc_pending ← Görev 4
  │       → GPT-4o Vision → proof_generating veya human_review
  │
  └── proof_generating → cutline + beyaz → proof_pending
        → /onay/[orderId] → müşteri onayla → proof_approved
        → ready_to_ship → partner → production → shipped → delivered
```

---

## Uygulama Sırası (KESİN — değiştirme)

| # | Görev | Süre | Neden bu sıra |
|---|---|---|---|
| 1 | Payment callback'ten QC kaldır | 5 dk | Race condition'ı durdur |
| 2 | Promote sonrası QC tetikle | 20 dk | Tasarımlı siparişler düzgün çalışsın |
| 3 | Upload-complete'ten gerçek QC tetikle | 30 dk | Sonradan yükleme düzgün çalışsın |
| 4 | Migration 105 trigger düzeltmesi | 15 dk | Status geçişleri doğru olsun |
| 5 | run-order-qc güvenlik iyileştirmesi | 20 dk | Edge case'ler loglansin |
| 6 | Sipariş detay timeline düzeltmesi | 30 dk | Müşteri durumu görsün |
| 7 | Ödeme sonuç sayfası akıllı CTA | 15 dk | Müşteri ne yapacağını bilsin |

Her görev sonrası: `npx tsc --noEmit` + commit.

**TEST SENARYOLARı (hepsi çalışmalı):**

1. Tasarımlı sipariş → ödeme → 5sn bekle → status qc_pending veya proof_generating ✅
2. Tasarımsız sipariş → ödeme → awaiting_upload → dosya yükle → status qc_pending → AI çalışır ✅
3. /siparis/[id] timeline → her status'ta doğru adım aktif ✅
4. /odeme-sonuc → tasarımsız ise "Tasarım yükle" CTA ✅
5. AI QC tamamlandı → proof_generating → /onay sayfasında prova görünür ✅

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
*ÖNCELİK: P0 — tüm diğer görevlerden ÖNCE yapılmalı*
