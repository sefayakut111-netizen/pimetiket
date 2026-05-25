# Cursor — Ödeme Sonrası Akış Komple Düzeltme (KRİTİK P0)

> Claude Code (mimari) tarafından hazırlanmıştır · 25 May 2026
> **TÜM DİĞER GÖREVLERDEN ÖNCE YAPILMALI** — bu akış kırık olduğu sürece hiçbir sipariş ilerleyemez.
> Bu dosya önceki `CURSOR-GOREVLER-ODEME-SONRASI-AKIS.md` ve `CURSOR-GOREVLER-TASARIM-YUKLE-FIX.md` dosyalarını birleştirir + genişletir.

---

## ANA SORUN

Ödeme yaptıktan sonra:
1. Tasarım ödeme öncesi yüklü olsa bile sistem "tekrar yükle" diyor
2. Yüklenen tasarım ayarlanmış halde görünmüyor
3. Onay/prova sayfası çalışmıyor

**Kök sebep:** 4 race condition + 2 eksik entegrasyon + 1 status geçiş hatası.

---

## AKIŞ HARİTASI (mevcut kırık durum)

```
Ödeme → fn_finalize_paid_order RPC
         ├─ INSERT orders (status='paid')
         ├─ DB trigger: fn_auto_advance_to_proof_pending()
         │   └─ fn_order_has_design() → design_files boş (promote henüz çalışmadı!)
         │   └─ status = 'awaiting_upload'  ← YANLIŞ! Tasarım var, henüz taşınmadı
         │
         ├─ promoteOrderDesigns() → design_files INSERT (status='analyzing')
         │   └─ DB trigger: trg_design_uploaded_advance_status
         │       └─ status = 'proof_pending'  ← GEÇ KALIYOR, kullanıcı zaten yanlış sayfada
         │
         └─ scheduleOrderDesignQC() → run-order-qc.ts
             └─ design_files sorgusu (promote ile yarışıyor!)
             └─ 0 dosya bulur → 'qc_skipped_no_files' → GERİ DÖNÜYOR

Kullanıcı → /odeme-sonuc?hasDesigns=false  ← YANLIŞ
         → "Tasarım yükle" butonu gösteriyor
         → /tasarim-yukle açılıyor
         → status='awaiting_upload' → "Dosyalarını yükle" diyor
         → AMA tasarım zaten var, promote edilmiş, sadece QC çalışmadı
```

---

## GÖREV 1/10 — Payment Callback: Promote ÖNCE, Trigger SONRA

### Dosya
`src/app/api/payment/callback/route.ts`

### Sorun (satır 219-375)
`fn_finalize_paid_order` RPC siparişi INSERT eder → DB trigger hemen design_files kontrol eder → boş bulur → `awaiting_upload` yazar. Sonra promote çalışır ama status zaten yanlış set edilmiş.

### Fix
Promote'u RPC'den ÖNCE veya RPC İÇİNDE çağıramayız (DB trigger zamanlaması). Ama callback'te promote bittikten sonra status'u MANUEL güncelleyebiliriz.

```typescript
// Satır 354-375 arasını şu şekilde değiştir:

// 7) Pre-purchase tasarım promote
if (orderItemsForPromote.length > 0) {
  try {
    const promotedCount = await promoteOrderDesigns({
      admin,
      orderId,
      userId: intent.user_id,
      orderItems: orderItemsForPromote,
    });

    // Promote başarılı ve dosya var → status'u düzelt
    // (DB trigger 'awaiting_upload' yazmış olabilir, biz üzerine yazıyoruz)
    if (promotedCount > 0) {
      await admin
        .from("orders")
        .update({ status: "qc_pending" })
        .eq("id", orderId);

      // QC'yi HEMEN tetikle — artık design_files dolu
      scheduleOrderDesignQC(admin, orderId);
    }
  } catch (err) {
    console.error("[payment/callback] promote failed:", err);
  }
} else {
  // Tasarım yok — awaiting_upload doğru, QC tetikleme
  // (kullanıcı /tasarim-yukle'den yükleyecek)
}

// ESKİ scheduleOrderDesignQC bloğunu (satır 367-375) KALDIR —
// yukarıda promote sonrası zaten tetikleniyor
```

### Doğrulama
- Tasarımlı sipariş: promote → status='qc_pending' → QC tetiklenir
- Tasarımsız sipariş: status='awaiting_upload' kalır → müşteri yükler
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 2/10 — odeme-sonuc Sayfası: hasDesigns Race Condition Fix

### Dosya
`src/app/api/payment/callback/route.ts` (GET handler, satır 509-599)

### Sorun (satır 543-555)
GET handler'da `orderHasDesignFiles()` çağrılıyor. Eğer promote henüz tamamlanmadıysa (IPN POST ve GET eş zamanlı gelebilir) → `hasDesigns=false` → kullanıcı "yükle" butonu görüyor.

### Fix
GET handler'ı güncelle — status'a göre karar ver, sadece design_files count'a güvenme:

```typescript
// Satır 543-555 (intent.status === "consumed" bloğu):
if (intent.status === "consumed") {
  const orderId = await resolveOrderIdFromIntent(admin, oid, intent.order_id);
  if (orderId) {
    // Status kontrol et — promote tamamlandıysa status != awaiting_upload
    const { data: orderRow } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();

    const orderStatus = (orderRow as { status: string } | null)?.status;
    const hasDesigns =
      orderStatus !== "awaiting_upload" ||
      (await orderHasDesignFiles(admin, orderId));

    return NextResponse.redirect(
      successRedirectUrl(siteUrl, orderId, hasDesigns),
      303
    );
  }
}
```

---

## GÖREV 3/10 — odeme-sonuc Sayfası: Canlı Status Polling

### Dosya
`src/app/odeme-sonuc/page.tsx`

### Sorun (satır 183-185)
`orderHasDesigns` statik hesaplanıyor — URL param + tek fetch. Status değişirse (promote tamamlandı, QC başladı) sayfa güncellenmez.

### Fix
Order fetch'i polling ile güncelle:

```typescript
// Satır 176-185 arasını değiştir:

const [order, setOrder] = useState<CustomerOrder | null>(null);

useEffect(() => {
  if (isPendingVerification) return;
  ensureAuthBindings();

  let cancelled = false;
  const poll = async () => {
    const o = await fetchCustomerOrder(orderId);
    if (!cancelled && o) {
      setOrder(o);
      // Status ilerledi → polling durdur
      if (o.status !== "paid" && o.status !== "awaiting_upload") {
        return; // tek fetch yeterli
      }
    }
  };

  void poll();
  // İlk 30 saniye 3sn aralıkla poll (promote + QC bekleme)
  const interval = setInterval(() => {
    if (cancelled) return;
    void poll();
  }, 3000);

  const timeout = setTimeout(() => clearInterval(interval), 30000);

  return () => {
    cancelled = true;
    clearInterval(interval);
    clearTimeout(timeout);
  };
}, [orderId, isPendingVerification]);

const orderHasDesigns =
  hasDesignsParam ||
  (order != null && order.status !== "awaiting_upload" && order.status !== "paid");
```

---

## GÖREV 4/10 — upload-complete: Gerçek QC Tetikle (Mock Kaldır)

### Dosya
`src/app/api/design/upload-complete/route.ts`

### Sorun
Upload-complete dosya tamamlandığında `scheduleOrderDesignQC()` çağırıyor (satır ~223). Bu doğru ANCAK kontrol et:
1. `scheduleOrderDesignQC` gerçekten `run-order-qc.ts`'yi mi tetikliyor yoksa mock mu?
2. `runDesignAiCheck()` mock stub mı? (önceki analiz mock olduğunu gösterdi)

### Fix — Doğrula ve düzelt

```
1. src/app/api/design/upload-complete/route.ts satır ~223:
   scheduleOrderDesignQC(admin, orderId) çağrısını doğrula
   — import doğru mu?
   — function gerçekten /api/agents/design-qc'ye HTTP çağrı yapıyor mu?

2. src/lib/schedule-order-design-qc.ts dosyasını oku:
   — after() ile /api/agents/design-qc'ye POST yapıyor mu?
   — yoksa mock sleep mi var?

3. src/app/api/agents/design-qc/route.ts dosyasını oku:
   — runOrderDesignQC() çağırıyor mu?
   — yoksa runDesignAiCheck() (mock) mı çağırıyor?

4. Eğer herhangi bir yerde mock/stub varsa:
   — Gerçek çağrı ile değiştir
   — Import'ları düzelt
```

---

## GÖREV 5/10 — run-order-qc: Design Files Bulamama Sorunu

### Dosya
`src/lib/agents/run-order-qc.ts`

### Sorun (satır 209-262)
design_files sorgusunda 0 dosya bulursa sessizce geri dönüyor. Loglama yetersiz.

### Fix

```typescript
// Satır 231 civarı (0 dosya durumu):

// ESKİ:
if (files.length === 0) {
  // log + return
}

// YENİ — 0 dosya ise 5sn bekle, tekrar dene (promote race condition recovery):
if (files.length === 0) {
  // Promote henüz tamamlanmamış olabilir — 5sn bekle, tekrar dene
  await new Promise((r) => setTimeout(r, 5000));

  const { data: retryFiles } = await admin
    .from("design_files")
    .select("*")
    .eq("order_id", orderId);

  if (!retryFiles || retryFiles.length === 0) {
    // Gerçekten yok — event log ve dön
    await admin.from("order_events").insert([{
      order_id: orderId,
      event_type: "qc_skipped_no_files",
      status_after: null,
      actor_id: "system",
      actor_role: "system",
      summary: "QC çalıştı ama design_files boş — müşteri henüz yüklememiş olabilir",
      detail: { attempts: currentAttempts + 1 },
    }]);
    return;
  }

  // Dosyalar gelmiş — devam et
  files = retryFiles;
}
```

---

## GÖREV 6/10 — tasarim-yukle: Zaten Yüklü Tasarımı Tanı

### Dosya
`src/app/siparis/[id]/tasarim-yukle/page.tsx`

### Sorun
Status `awaiting_upload` iken sayfa "dosya yükle" diyor. Ama promote sonrası design_files'da dosya var. Sayfa upload-status API'den `designsComplete` alıyor ama buna göre UI'da "zaten yüklü" göstermiyor.

### Fix

Load sonrası her item'ın `designsComplete` durumunu kontrol et. Hepsi complete ise:
- "Tüm tasarımlar yüklü" mesajı göster
- "AI kontrole gönder" veya "Sipariş detayına git" butonu göster
- Tekrar upload CTA gösterme

```typescript
// load() callback'inde (satır ~260):
// uploadStatus alındıktan sonra:

const allItemsComplete = items.every((i) => i.designsComplete);

if (allItemsComplete && order.status === "awaiting_upload") {
  // Tasarımlar var ama status henüz güncellenmemiş
  // Status geçişini tetikle
  await fetch(`/api/orders/${orderId}/advance-status`, { method: "POST" });
  // Sayfayı yenile — status değişecek
  await new Promise((r) => setTimeout(r, 1500));
  await load({ silent: true });
  return;
}

if (allItemsComplete) {
  // Tüm dosyalar yüklü — redirect
  router.replace(`/siparis/${orderId}`);
  return;
}
```

NOT: `/api/orders/[id]/advance-status` endpoint'i yoksa oluşturulmalı (Görev 7).

---

## GÖREV 7/10 — Yeni Endpoint: advance-status (Status Kurtarma)

### Yeni Dosya
`src/app/api/orders/[id]/advance-status/route.ts`

### Amaç
Sipariş awaiting_upload'da takılı kalmışsa ve design_files'da dosya varsa status'u ilerlet. Müşteri tarafından çağrılabilir (kendi siparişi).

### Kod

```typescript
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleOrderDesignQC } from "@/lib/schedule-order-design-qc";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;
  const supabase = createClient();

  // Auth: kullanıcı kendi siparişini ilerletebilir
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Sipariş kontrolü
  const { data: order } = await admin
    .from("orders")
    .select("id, status, user_id")
    .eq("id", orderId)
    .single();

  if (!order || (order as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const status = (order as { status: string }).status;

  // Sadece awaiting_upload veya paid'den ilerlet
  if (status !== "awaiting_upload" && status !== "paid") {
    return NextResponse.json({ ok: true, status, message: "Already advanced" });
  }

  // Design files var mı?
  const { count } = await admin
    .from("design_files")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .in("status", ["uploaded", "analyzing", "qc_passed", "qc_warned"]);

  if (!count || count === 0) {
    return NextResponse.json({ ok: false, error: "No design files found" });
  }

  // Status ilerlet + QC tetikle
  await admin
    .from("orders")
    .update({ status: "qc_pending" })
    .eq("id", orderId);

  scheduleOrderDesignQC(admin, orderId);

  return NextResponse.json({ ok: true, status: "qc_pending" });
}
```

---

## GÖREV 8/10 — Tasarım Yükleme Sayfası Donma Fix (3 sorun)

### Dosya
`src/app/siparis/[id]/tasarim-yukle/page.tsx`

### Sorun 1: While Polling Döngüsü (satır ~237-247)
Upload sonrası while döngüsü 5×2sn = 10sn bloklama → sonsuz render.

```typescript
// Satır 233-247 — while bloğunu KALDIR, tek load bırak:
await load({ silent: true });
```

### Sorun 2: load() İçindeki Agresif Redirect (satır ~106-118)
QC statuslarında sayfa redirect yapıyor → upload kesilir.

```typescript
// Status kontrolünü genişlet:
const STAY_ON_PAGE_STATUSES = [
  "paid",
  "awaiting_upload",
  "qc_pending",
  "qc_flagged",
  "human_review",
  "proof_generating",
];

// proof_pending ve proof_validating → /onay'a yönlendir
if (data.status === "proof_pending" || data.status === "proof_validating") {
  router.replace(`/onay/${orderId}`);
  return data;
}
if (data.status === "proof_approved") {
  router.replace(`/onay/${orderId}/tamamlandi`);
  return data;
}
if (!STAY_ON_PAGE_STATUSES.includes(data.status)) {
  router.replace(`/siparis/${orderId}`);
  return data;
}
```

### Sorun 3: MIME Type (satır ~157-159)
AI/PSD dosyaları tarayıcıda boş MIME verir → reddedilir.

```typescript
// Extension-based fallback:
const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf', '.svg', '.ai', '.psd'];
const mimeOk = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);
const extOk = ALLOWED_EXTENSIONS.includes(ext);

if (!mimeOk && !extOk) {
  toast.error(`Bu dosya formatı desteklenmiyor. Desteklenen: PNG, JPG, PDF, SVG, AI, PSD`);
  return;
}
if (ext === '.eps') {
  toast.error('EPS formatı desteklenmiyor. Lütfen AI, PDF veya PNG olarak dışa aktarın.');
  return;
}
```

---

## GÖREV 9/10 — allDone Redirect + Upload Çakışması

### Dosya
`src/app/siparis/[id]/tasarim-yukle/page.tsx` (satır ~138-150)

### Sorun
Tüm tasarımlar tamamlandığında redirect yapıyor AMA upload devam edebilir.

### Fix

```typescript
useEffect(() => {
  if (!order) return;
  if (uploadingItemId) return; // upload devam ediyor, bekle

  const allDone =
    order.items.length > 0 &&
    order.items.every((i) => i.designsComplete);

  if (allDone) {
    toast.success("Tüm tasarımlar yüklendi — prova hazırlığı başlıyor...");
    const t = setTimeout(() => router.push(`/onay/${orderId}`), 2000);
    return () => clearTimeout(t);
  }
}, [order, orderId, router, toast, uploadingItemId]);
```

Değişiklikler:
1. `uploadingItemId` devam ediyorsa redirect yapma
2. Redirect hedefi → `/onay/${orderId}` (prova akışına yönlendir)
3. Timeout 1.5sn → 2sn

---

## GÖREV 10/10 — siparis/[id] Detay Sayfası: Design Status Gösterimi

### Dosya
`src/app/siparis/[id]/page.tsx`

### Sorun (satır ~445-457, ~630-633, ~843-874)
1. `hasUploadedDesign` async fetch'e dayanıyor — promote henüz tamamlanmadıysa false
2. Upload CTA sadece `awaiting_upload` ve `paid`'de gösteriliyor — ama tasarım varken de gösteriyor
3. Phase index sadece `statusToPhaseIndex` + `hasUploadedDesign` max — ara durumları yansıtmıyor

### Fix

```typescript
// Satır ~843-874 — Upload CTA bloğu:
// Tasarım yüklü ise CTA gösterme
{(order.status === "paid" || order.status === "awaiting_upload") && !hasUploadedDesign && (
  // upload CTA
)}

// Tasarım yüklü ama QC henüz başlamamış ise bilgi göster:
{hasUploadedDesign && (order.status === "paid" || order.status === "awaiting_upload") && (
  <Card padding="p-5" className="text-center">
    <p className="text-sm text-gri-700">
      Tasarımın yüklendi. Sistem ön-kontrolü başlatılıyor...
    </p>
    <div className="mt-2 flex justify-center">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pim-mercan border-t-transparent" />
    </div>
  </Card>
)}
```

---

## GÖREV 11/13 — Panelim: proof_generating/qc Durumlarında /onay CTA Ekle

### Dosya
`src/app/panelim/page.tsx`

### Sorun (satır 291-301)
`qc_pending`, `human_review`, `proof_generating` statuslarında sadece "İnceleniyor" yazısı var. Hiçbir CTA yok — kullanıcı ne yapacağını bilmiyor. Daha kritik: `proof_generating` durumunda bıçak üretimi `/onay` sayfasına bağımlı (client-side hidden iframe). Kullanıcı `/onay`'ı hiç açmazsa bıçak ASLA üretilmez.

### Fix

```typescript
// src/app/panelim/page.tsx — OrderActionCta fonksiyonu, satır 291-301:

// ESKİ:
case "qc_pending":
case "human_review":
case "proof_generating":
  return (
    <div className="flex items-center gap-2 text-[12px] text-gri-500">
      <span className="w-3 h-3 rounded-full bg-sari animate-pulse shrink-0" />
      {isEn
        ? "Under review — results in a few minutes"
        : "İnceleniyor — birkaç dakika içinde sonuç çıkacak"}
    </div>
  );

// YENİ — proof_generating'de /onay'a yönlendir (cutline üretimi için):
case "qc_pending":
case "human_review":
  return (
    <div className="flex items-center gap-2 text-[12px] text-gri-500">
      <span className="w-3 h-3 rounded-full bg-sari animate-pulse shrink-0" />
      {isEn
        ? "AI check in progress — results in a few minutes"
        : "AI ön-kontrol yapılıyor — birkaç dakika içinde sonuç çıkacak"}
    </div>
  );

case "proof_generating":
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[12px] text-gri-500">
        <span className="w-3 h-3 rounded-full bg-pim-mercan animate-pulse shrink-0" />
        {isEn
          ? "Cut line being prepared..."
          : "Bıçak çizimi hazırlanıyor..."}
      </div>
      <Button
        variant="primary"
        size="sm"
        href={`/onay/${order.id}`}
        className="w-full"
      >
        {isEn ? "View proof preparation →" : "Prova hazırlığını gör →"}
      </Button>
    </div>
  );
```

### Neden önemli
Bıçak çizimi `/onay` sayfasındaki hidden iframe ile üretiliyor (client-side). Kullanıcı bu sayfayı açmazsa:
- Bıçak asla üretilmez
- 5dk SLA dolar → operatöre düşer
- Operatör yoksa sipariş sonsuza kadar bekler

Bu CTA kullanıcıyı `/onay`'a çeker → iframe tetiklenir → bıçak üretilir.

---

## GÖREV 12/13 — Sipariş Detay: proof_generating'de /onay CTA Ekle

### Dosya
`src/app/siparis/[id]/page.tsx`

### Sorun (satır 956-965)
`proof_generating` durumunda "Bıçak çizimi hala hazırlanıyor" yazısı + deaktif butonlar var. Ama kullanıcıyı `/onay`'a yönlendirmiyor → bıçak üretimi tetiklenmiyor.

### Fix

```typescript
// Satır 956-965 — proof_generating/proof_validating bloğu:

// ESKİ:
{order.status === "proof_generating" ||
order.status === "proof_validating" ? (
  <div className="flex items-center gap-2 text-[13px] text-gri-700 bg-gri-50 rounded-lg p-3">
    <span className="inline-block w-2 h-2 rounded-full bg-pim-mercan animate-pulse" />
    <span>
      {order.status === "proof_validating"
        ? "Düzenlemenizi kontrol ediyoruz — birkaç saniye sonra onay butonları aktif olur."
        : "Bıçak çizimi hala hazırlanıyor — birkaç dakika sonra onay butonları aktif olur."}
    </span>
  </div>
)

// YENİ:
{order.status === "proof_generating" ||
order.status === "proof_validating" ? (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-[13px] text-gri-700 bg-gri-50 rounded-lg p-3">
      <span className="inline-block w-2 h-2 rounded-full bg-pim-mercan animate-pulse" />
      <span>
        {order.status === "proof_validating"
          ? "Düzenlemenizi kontrol ediyoruz — birkaç saniye."
          : "Bıçak çizimi hazırlanıyor — hazır olunca onaylayabileceksin."}
      </span>
    </div>
    {order.status === "proof_generating" && (
      <Button
        variant="primary"
        size="sm"
        href={`/onay/${order.id}`}
      >
        Prova hazırlığını gör →
      </Button>
    )}
  </div>
)
```

---

## GÖREV 13/13 — Panelim + Sipariş Detay: proof_pending Status Polling

### Dosyalar
- `src/app/panelim/page.tsx`
- `src/app/siparis/[id]/page.tsx`

### Sorun
Kullanıcı panelime bakıyor, sipariş `qc_pending` veya `proof_generating` durumunda. Status değiştiğinde (→ `proof_pending`) sayfa otomatik güncellenmiyor. Kullanıcı manuel F5 yapmak zorunda.

### Fix — panelim'de order polling

```typescript
// src/app/panelim/page.tsx — useEffect bloğuna ekle (mevcut refreshCustomerOrders sonrasına):

// Aktif siparişlerden biri "bekleme" statusundaysa 10sn aralıkla poll et
useEffect(() => {
  if (!hydrated) return;
  const hasWaiting = orders.some(
    (o) =>
      o.status === "qc_pending" ||
      o.status === "proof_generating" ||
      o.status === "proof_validating" ||
      o.status === "human_review"
  );
  if (!hasWaiting) return;

  const interval = setInterval(() => {
    void refreshCustomerOrders();
  }, 10000); // 10sn

  // 5dk sonra polling durdur (sayfa açık kalırsa)
  const timeout = setTimeout(() => clearInterval(interval), 300000);

  return () => {
    clearInterval(interval);
    clearTimeout(timeout);
  };
}, [hydrated, orders]);
```

### Fix — sipariş detayda da polling

```typescript
// src/app/siparis/[id]/page.tsx — benzer logic:
// Eğer status qc_pending/proof_generating ise 5sn aralıkla order fetch et.
// Status proof_pending'e geçince polling durdur + prova CTA göster.

useEffect(() => {
  const waitingStatuses = ["qc_pending", "proof_generating", "proof_validating", "human_review"];
  if (!order || !waitingStatuses.includes(order.status)) return;

  const interval = setInterval(async () => {
    // order'ı yeniden fetch et (mevcut fetchOrder fonksiyonunu kullan)
    try {
      const fresh = await fetchCustomerOrder(orderId);
      if (fresh) setOrder(fresh);
    } catch { /* sessiz */ }
  }, 5000);

  const timeout = setTimeout(() => clearInterval(interval), 300000);

  return () => {
    clearInterval(interval);
    clearTimeout(timeout);
  };
}, [order?.status, orderId]);
```

---

## UYGULAMA SIRASI (ZORUNLU)

| # | Görev | Dosya | Süre |
|---|-------|-------|------|
| 1 | Payment callback fix | api/payment/callback/route.ts | 15 dk |
| 2 | GET redirect fix | api/payment/callback/route.ts | 5 dk |
| 3 | odeme-sonuc polling | odeme-sonuc/page.tsx | 10 dk |
| 4 | upload-complete mock kontrol | api/design/upload-complete/route.ts | 10 dk |
| 5 | run-order-qc retry | lib/agents/run-order-qc.ts | 10 dk |
| 6 | tasarim-yukle tanıma | siparis/[id]/tasarim-yukle/page.tsx | 10 dk |
| 7 | advance-status endpoint | api/orders/[id]/advance-status/route.ts | 15 dk |
| 8 | tasarim-yukle donma fix | siparis/[id]/tasarim-yukle/page.tsx | 15 dk |
| 9 | allDone redirect fix | siparis/[id]/tasarim-yukle/page.tsx | 5 dk |
| 10 | siparis detay design status | siparis/[id]/page.tsx | 10 dk |
| **11** | **Panelim proof_generating CTA** | **panelim/page.tsx** | **10 dk** |
| **12** | **Siparis detay /onay CTA** | **siparis/[id]/page.tsx** | **5 dk** |
| **13** | **Panelim + detay polling** | **panelim + siparis/[id]** | **15 dk** |

**Her görev sonrası:** `npx tsc --noEmit` + commit (`fix(post-payment):` prefix)

---

## TEST SENARYOSU (hepsini sırayla test et)

```
Senaryo A — Tasarım ödeme ÖNCESI yüklü:
1. Sticker konfigüre et + tasarım yükle + sepete ekle + ödeme yap
2. /odeme-sonuc → "Tasarımın yüklendi" mesajı görmeli ✅
3. /siparis/[id] → Phase 2+ (AI kontrol) görmeli ✅
4. Birkaç dk bekle → status qc_pending/proof_generating olmalı ✅
5. /onay/[id] → cutline önizleme görmeli ✅

Senaryo B — Tasarım ödeme SONRASI yükleniyor:
1. Sepete ekle (tasarımsız) + ödeme yap
2. /odeme-sonuc → "Tasarım yükle" butonu görmeli ✅
3. /tasarim-yukle → dosya yükle → sayfa donmamalı ✅
4. AI (.ai) dosya yükle → kabul edilmeli ✅
5. Tüm tasarımlar yüklendi → /onay'a redirect olmalı ✅

Senaryo C — Status takılma recovery:
1. Sipariş awaiting_upload'da takılıysa ve design_files'da dosya varsa
2. /tasarim-yukle → "Zaten yüklü" mesajı görmeli ✅
3. advance-status endpoint tetiklenmeli → status ilerlemeli ✅

Senaryo D — Panelim'den prova akışına ulaşma (YENİ):
1. Sipariş ver + tasarım yükle + ödeme yap
2. Tarayıcıyı kapat, sonra tekrar aç
3. /panelim → sipariş kartında "Prova hazırlığını gör" butonu olmalı ✅
4. Butona tıkla → /onay/[id] açılmalı ✅
5. Bıçak çizimi otomatik başlamalı (hidden iframe) ✅
6. Bıçak hazır → "Bu ürünü onayla" butonu aktif olmalı ✅

Senaryo E — Status değişiminde sayfa güncellenmesi (YENİ):
1. /panelim'de sipariş "İnceleniyor" durumunda
2. 10sn bekle → status değişirse kart otomatik güncellenmeli ✅
3. proof_pending'e geçince "Provayı incele ve onayla" butonu görünmeli ✅
```

---

## ÖNCEKİ GÖREV DOSYALARI

Bu dosya şunları kapsar (ayrı yapılmasına gerek yok):
- `CURSOR-GOREVLER-ODEME-SONRASI-AKIS.md` — 7 görev → burada Görev 1,2,4,5,10
- `CURSOR-GOREVLER-TASARIM-YUKLE-FIX.md` — 4 görev → burada Görev 8,9

---

*Hazırlayan: Claude Code (mimari) · 25-26 May 2026*
