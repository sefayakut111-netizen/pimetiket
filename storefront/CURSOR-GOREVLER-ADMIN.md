# Cursor Admin Panel Düzeltmeleri — 25 Mayıs 2026

> Claude Code (mimari) tarafından hazırlanmıştır.
> Cursor bu talimatları sırayla uygulayacak.
> Her görev bağımsız commit edilebilir.

---

## GÖREV 1/6 — Fiyat Hesaplayıcıları `/admin/fiyatlar` İçine Taşı (P1)

### Sorun

4 ayrı fiyat sayfası var:
- `/admin/fiyatlar` → Ana fiyat yönetimi (API-driven, draft/live/history)
- `/admin/fiyat-hesapla` → Sticker hesaplayıcı (hardcoded defaults, API yok)
- `/admin/fiyat-hesapla-etiket` → Rulo etiket hesaplayıcı (hardcoded defaults)
- `/admin/fiyat-hesapla-tabaka` → Tabaka etiket hesaplayıcı (hardcoded defaults)

Hesaplayıcılar `/api/admin/pricing` API'sini kullanmıyor — kendi fallback config'leri var.
Sefa `/admin/fiyatlar`'da fiyat değiştirince hesaplayıcılar eski fiyatı gösterebilir.

### Çözüm

**Adım 1: `/admin/fiyatlar/page.tsx`'e tab sistemi ekle**

Mevcut yapı zaten 3 profil seçici var (Sticker/Rulo/Tabaka). Buna 2. seviye tab ekle:

```
[Sticker 🏷] [Rulo Etiket 📋] [Tabaka Etiket 📄]     ← mevcut profil seçici
  |
  ├── [Fiyat Yönetimi]  ← mevcut içerik (malzeme, kaplama, tier, operasyon, marj)
  └── [Hesaplayıcı]     ← YENİ TAB — ilgili hesaplayıcıyı embed eder
```

**Adım 2: Hesaplayıcı component'lerini ayır**

Her hesaplayıcı sayfasının core logic'ini bağımsız component'e çıkar:

```
src/components/admin/pricing/StickerCalculator.tsx    ← /fiyat-hesapla'dan extract
src/components/admin/pricing/RuloCalculator.tsx       ← /fiyat-hesapla-etiket'ten extract
src/components/admin/pricing/TabakaCalculator.tsx     ← /fiyat-hesapla-tabaka'dan extract
```

Her component:
- Props olarak `liveConfig` alsın (`/api/admin/pricing` response'u)
- Fallback defaults KALDIRILMASIN (geriye uyumluluk), ama API config varsa öncelikli olsun
- Pattern:
```typescript
interface CalculatorProps {
  liveConfig?: PricingConfig | null;  // API'den gelen canlı config
}

// Component içinde:
const config = liveConfig ?? FALLBACK_DEFAULTS;
```

**Adım 3: `/admin/fiyatlar/page.tsx`'de hesaplayıcıyı göster**

Seçili profil (sticker/rulo/tabaka) için ilgili calculator component'ini render et:

```typescript
const [activeTab, setActiveTab] = useState<"config" | "calculator">("config");

// Tab bar:
<div className="flex gap-2 border-b mb-4">
  <button onClick={() => setActiveTab("config")}
    className={cn("px-4 py-2", activeTab === "config" && "border-b-2 border-pim-mercan font-semibold")}>
    Fiyat Yönetimi
  </button>
  <button onClick={() => setActiveTab("calculator")}
    className={cn("px-4 py-2", activeTab === "calculator" && "border-b-2 border-pim-mercan font-semibold")}>
    Hesaplayıcı
  </button>
</div>

// Tab content:
{activeTab === "config" && <PriceConfigPanel ... />}
{activeTab === "calculator" && scope === "sticker" && <StickerCalculator liveConfig={liveData} />}
{activeTab === "calculator" && scope === "etiket_rulo" && <RuloCalculator liveConfig={liveData} />}
{activeTab === "calculator" && scope === "etiket_tabaka" && <TabakaCalculator liveConfig={liveData} />}
```

**Adım 4: Eski sayfaları redirect'e çevir**

Eski URL'leri bozmamak için redirect ekle:

```typescript
// src/app/admin/fiyat-hesapla/page.tsx → tamamen değiştir:
import { redirect } from "next/navigation";
export default function Page() {
  redirect("/admin/fiyatlar?tab=calculator&scope=sticker");
}

// src/app/admin/fiyat-hesapla-etiket/page.tsx
export default function Page() {
  redirect("/admin/fiyatlar?tab=calculator&scope=etiket_rulo");
}

// src/app/admin/fiyat-hesapla-tabaka/page.tsx
export default function Page() {
  redirect("/admin/fiyatlar?tab=calculator&scope=etiket_tabaka");
}
```

**Adım 5: Sidebar güncelle**

`src/components/layout/AdminShell.tsx` sidebar'dan:
- "Fiyat hesapla" menü item'ını **kaldır** (Yönetim grubundan)
- "Fiyat yönetimi" (Sistem grubunda) **tek giriş noktası** olarak kalsın

### Doğrulama
- `/admin/fiyatlar` → Sticker profili → "Hesaplayıcı" tab → sticker calculator çalışıyor
- `/admin/fiyat-hesapla` → otomatik `/admin/fiyatlar?tab=calculator&scope=sticker`'a yönleniyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 2/6 — Raporlar'ı Finans ile Birleştir (P1)

### Sorun

İki sayfa aynı veri kaynağından (`fetchAllOrdersForAdmin`) okuyup benzer şeyler gösteriyor:
- `/admin/finans` → Gelir KPI, revenue trend, ödeme dağılımı, top müşteriler
- `/admin/raporlar` → Gelir özeti, aylık trend, top ürünler, sticker vs etiket

### Çözüm

**Adım 1: `/admin/finans/page.tsx`'e tab ekle**

```
Finans & Raporlar
  ├── [Genel Bakış]    ← mevcut finans içeriği (KPI + trend + ödeme + müşteriler)
  └── [Detay Raporlar]  ← raporlar içeriği (aylık aggregate + top ürünler + ürün kırılımı)
```

**Adım 2: Raporlar içeriğini component olarak ayır**

```
src/components/admin/reports/DetailReports.tsx  ← /raporlar'dan extract
```

İçerik:
- `aggregateMonthly()` ile aylık gelir/sipariş bar chart
- `topSizes()` ile popüler boyut/ürün tablosu
- Sticker vs Etiket kırılım donut chart

**Adım 3: Finans sayfasında göster**

```typescript
const [reportTab, setReportTab] = useState<"overview" | "detail">("overview");

// Tab bar (mevcut time range selector'ın ALTINDA):
<div className="flex gap-2 border-b mb-4">
  <button ...>Genel Bakış</button>
  <button ...>Detay Raporlar</button>
</div>

{reportTab === "overview" && <FinanceOverview ... />}  // mevcut finans içeriği
{reportTab === "detail" && <DetailReports orders={orders} />}
```

**Adım 4: Eski raporlar sayfasını redirect'e çevir**

```typescript
// src/app/admin/raporlar/page.tsx
import { redirect } from "next/navigation";
export default function Page() {
  redirect("/admin/finans?tab=detail");
}
```

**Adım 5: Sidebar güncelle**

`AdminShell.tsx`:
- "Raporlar" menü item'ını **kaldır** (Sistem grubundan)
- "Finans" item'ını "Finans & Raporlar" olarak **yeniden adlandır**
- İkonu koru (📊 veya mevcut ikon)

### Doğrulama
- `/admin/finans` → "Detay Raporlar" tab → aylık chart + top ürünler gösteriyor
- `/admin/raporlar` → otomatik `/admin/finans?tab=detail`'e yönleniyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 3/6 — Design QC Test'i Debug Altına Taşı (P2)

### Sorun
`/admin/agents/design-qc-test` operatör karıştırabilir — production QC kuyruğu (`/admin/ai-qc`) ile aynı yerde.

### Çözüm

**Adım 1: Dosyayı taşı**

```
src/app/admin/agents/design-qc-test/page.tsx
  → src/app/admin/debug/design-qc-test/page.tsx
```

Dosya içeriği AYNI kalır, sadece konum değişir.

**Adım 2: Sayfanın üstüne uyarı banner ekle**

```typescript
// page.tsx içinde return'ün en üstüne:
<div className="mb-4 rounded-lg border border-sari bg-sari-soft px-4 py-3 text-sm text-lacivert">
  ⚠️ Bu sayfa geliştirici test aracıdır — gerçek sipariş QC işlemleri için{" "}
  <a href="/admin/ai-qc" className="underline font-medium">AI QC Kuyruğu</a>'nu kullanın.
</div>
```

**Adım 3: Sidebar güncelle**

`AdminShell.tsx` — mevcut sidebar'da bu sayfa zaten Sistem grubunda mı kontrol et.
Eğer varsa, "Sipariş simülatörü" altına taşı veya "Debug araçları" alt grubu oluştur.
Eğer sidebar'da yoksa (sadece URL ile erişim), dokunma.

### Doğrulama
- `/admin/debug/design-qc-test` → sayfa çalışıyor + uyarı banner görünüyor
- `/admin/agents/design-qc-test` → 404 (veya redirect ekle)
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 4/6 — Kuponlar localStorage → DB (P2)

### Sorun
`/admin/kuponlar` kuponları `localStorage` `pim_coupons_v1` key'inde tutuyor.
DB'de `coupons` tablosu zaten var (Migration 005). Bağlanmamış.

### Çözüm

**Adım 1: API endpoint oluştur**

`src/app/api/admin/coupons/route.ts`:

```typescript
// GET — tüm kuponları listele
// assertPermission("coupons", "view")
// supabase.from("coupons").select("*").order("created_at", { ascending: false })

// POST — yeni kupon oluştur
// assertPermission("coupons", "create")
// body: { code, type, value, min_subtotal, max_uses, valid_from, valid_to }
// supabase.from("coupons").insert({...})
// audit_log INSERT

// PATCH — kupon güncelle (active toggle, değer değiştir)
// assertPermission("coupons", "update")
// supabase.from("coupons").update({...}).eq("id", id)
// audit_log INSERT

// DELETE — kupon sil
// assertPermission("coupons", "delete")
// supabase.from("coupons").delete().eq("id", id)
// audit_log INSERT
```

**Adım 2: `/admin/kuponlar/page.tsx` güncelle**

- `STORAGE_KEY` ve localStorage okuma/yazma kodunu **kaldır**
- `SAMPLE_COUPONS` fallback'i **kaldır**
- Yerine:
  - `useEffect` ile `GET /api/admin/coupons` fetch
  - CRUD işlemleri API'ye POST/PATCH/DELETE
  - Optimistic UI veya loading state

- Mevcut UI (tablo, form, toggle) AYNI kalır — sadece veri kaynağı değişir

**Adım 3: Mevcut localStorage verisini migrate et (opsiyonel)**

Sayfa ilk yüklendiğinde:
```typescript
useEffect(() => {
  const local = localStorage.getItem("pim_coupons_v1");
  if (local) {
    // Bir kerelik: localStorage'daki kuponları DB'ye aktar
    // POST /api/admin/coupons/migrate body: JSON.parse(local)
    // Başarılıysa localStorage'ı temizle
    localStorage.removeItem("pim_coupons_v1");
  }
}, []);
```

Bu migration kodu 1 kez çalışır, sonra localStorage temiz kalır.

### Doğrulama
- `/admin/kuponlar` → DB'den kuponlar listeleniyor
- Yeni kupon ekle → DB'de `coupons` tablosunda görünüyor
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 5/6 — Manuel Sipariş DB'ye Bağla (P2)

### Sorun
`/admin/siparis-ekle` siparişi localStorage'a kaydediyor. DB'de `fn_create_manual_order` RPC zaten var (Migration 013). Bağlanmamış.

### Çözüm

**Adım 1: `/admin/siparis-ekle/page.tsx` save fonksiyonunu güncelle**

Mevcut `handleSave` fonksiyonundaki localStorage yazma kodunu şu şekilde değiştir:

```typescript
const handleSave = async () => {
  // ... mevcut validation ...

  try {
    const res = await fetch("/api/admin/orders/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subtotal,
        shipping,
        total,
        address: { name: customerName, phone, addr: address, city },
        invoice: invoiceType === "corporate"
          ? { type: "corporate", vkn, companyName, taxOffice }
          : { type: "individual", tc: tcNo },
        payment: { method: paymentMethod },
        estimatedDelivery: addDaysIso(new Date(), deliveryDays),
        items: [{
          product: productType,
          title: productTitle,
          config: `${width}×${height}mm`,
          width,
          height,
          qty,
          unit: unitPrice,
          total: qty * unitPrice,
        }],
      }),
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    toast({ title: "Sipariş oluşturuldu", description: `#${data.orderId}` });
    router.push("/admin/siparisler");
  } catch (err) {
    toast({ title: "Hata", description: (err as Error).message, variant: "destructive" });
  }
};
```

**Adım 2: localStorage yazma kodunu kaldır**

- `addToCustomerOrders()` veya benzeri localStorage çağrısını sil
- `pim_customer_orders_updated` event dispatch'ini sil
- Yönlendirmeyi `/admin` yerine `/admin/siparisler`'a çevir

**Adım 3: Mevcut `/api/admin/orders/manual/route.ts` kontrol et**

Bu endpoint zaten var ve `fn_create_manual_order` RPC'yi çağırıyor. 
Sadece frontend'in bu endpoint'i kullanması gerekiyor.
Endpoint'in body validation'ı frontend'in gönderdiği formatla uyumlu olmalı.

### Doğrulama
- `/admin/siparis-ekle` → form doldur → kaydet → `/admin/siparisler`'da DB'den görünüyor
- Supabase Dashboard → `orders` tablosunda `is_manual = true` kayıt var
- `npx tsc --noEmit` → 0 hata

---

## GÖREV 6/6 — Yardım Talepleri İsim Tutarlılığı (P3)

### Sorun
- Sayfa: `/admin/yardim-talepleri/page.tsx`
- API: `/api/admin/help-requests/route.ts`
- Sidebar: "Yardım Talepleri"

URL'de Türkçe (`yardim-talepleri`), API'de İngilizce (`help-requests`). Tutarsız.

### Çözüm

**Seçenek A (önerilen — minimum değişiklik):**
Sadece sidebar label'ını ve sayfa başlığını tutarlı tut. URL ve API isimlerini DEĞİŞTİRME (breaking change riski).

Yapılacak: **Hiçbir şey.** Bu kozmetik, breaking change'e değmez.

**Seçenek B (tam tutarlılık istiyorsan):**
1. `/admin/yardim-talepleri/` → içeriği koru, sadece `<h1>` başlığını "Yardım Talepleri (Prova Destek)" olarak netleştir
2. API path'i değiştirme — 46+ import reference kırılır

**Karar:** Seçenek A — dokunma.

---

## Uygulama Sırası

1. **Görev 1** — Fiyat hesaplayıcıları taşı (en büyük yapısal değişiklik)
2. **Görev 2** — Raporlar birleştir (benzer pattern, Görev 1'den sonra kolay)
3. **Görev 4** — Kuponlar DB'ye (bağımsız, API endpoint yazma)
4. **Görev 5** — Manuel sipariş DB'ye (küçük, endpoint zaten var)
5. **Görev 3** — QC test taşı (dosya taşıma + banner)
6. **Görev 6** — Atla (kozmetik, değmez)

Her görev sonrası: `npx tsc --noEmit` + commit.

---

## Sidebar Nihai Yapı (Görevler tamamlandıktan sonra)

```
Operasyon
  ├── Dashboard
  ├── Siparişler (badge)
  ├── Manuel Sipariş
  ├── AI QC (badge)
  ├── Prova (badge)
  ├── Kargo
  └── Üretim Partnerleri (badge)

Müşteri
  ├── Müşteriler
  ├── Yorumlar
  ├── İadeler
  ├── Tasarımlar
  └── Yardım Talepleri (badge)

İçerik
  ├── Ürünler
  ├── Aboneler
  ├── Galeri
  └── Site Görselleri

Yönetim
  ├── Finans & Raporlar          ← birleşti
  ├── Kuponlar                   ← artık DB'den
  ├── Çalışanlar
  └── Fiyat Yönetimi             ← hesaplayıcılar içine taşındı, "Fiyat hesapla" kalktı

Sistem
  ├── Denetçiler (badge)
  ├── Denetim Kaydı
  ├── KVKK Talepleri
  ├── Yedekler
  ├── Arşiv
  ├── Debug Araçları              ← QC test buraya taşındı
  │   ├── Sipariş Simülatörü
  │   └── Design QC Test
  ├── E-posta Sağlığı
  └── Ayarlar
```

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
