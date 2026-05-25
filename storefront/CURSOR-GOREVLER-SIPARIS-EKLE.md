# Cursor Manuel Sipariş İyileştirmeleri — `/admin/siparis-ekle`

> Claude Code (mimari) tarafından hazırlanmıştır.
> Dosya: `src/app/admin/siparis-ekle/page.tsx` (535 satır)
> 10 görev: 5 düzeltme + 5 ekleme

---

## DÜZELTMELER (5)

### GÖREV 1/10 — Çoklu Ürün Ekleme (P1)

#### Sorun
Sadece 1 ürün eklenebilir. Müşteri hem etiket hem sticker isterse 2 ayrı sipariş oluşturmak zorunda.

#### Değişiklik

Tek item state'lerini array'e çevir:

```typescript
interface OrderItem {
  id: string;          // uuid (client-side)
  product: ProductType;
  title: string;
  width: string;
  height: string;
  qty: string;
  unit: string;
}

const [items, setItems] = useState<OrderItem[]>([
  { id: crypto.randomUUID(), product: 'etiket', title: '', width: '60', height: '40', qty: '1000', unit: '0.85' },
]);

const addItem = () => {
  setItems(prev => [...prev, {
    id: crypto.randomUUID(),
    product: 'etiket',
    title: '',
    width: '60',
    height: '40',
    qty: '1000',
    unit: '0.85',
  }]);
};

const removeItem = (id: string) => {
  if (items.length <= 1) return; // en az 1 ürün olmalı
  setItems(prev => prev.filter(i => i.id !== id));
};

const updateItem = (id: string, patch: Partial<OrderItem>) => {
  setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
};
```

Hesap güncelle:

```typescript
const itemTotals = items.map(i => {
  const q = Number(i.qty) || 0;
  const u = Number(i.unit) || 0;
  return q * u;
});
const subtotal = itemTotals.reduce((s, t) => s + t, 0);
```

UI'da her item ayrı kart:

```
┌─ Ürün 1 ────────────────────────── [✕ Kaldır] ┐
│ [Etiket] [Sticker]                              │
│ Başlık: [_________________]                     │
│ Genişlik: [60] Yükseklik: [40] Adet: [1000]   │
│ Birim: [0,85₺]  Ara toplam: 850₺              │
└──────────────────────────────────────────────────┘

┌─ Ürün 2 ────────────────────────── [✕ Kaldır] ┐
│ [Etiket] [Sticker]                              │
│ ...                                              │
└──────────────────────────────────────────────────┘

[+ Ürün ekle]
```

Submit'te `items` array'ini API'ye gönder (mevcut `items: [itemPayload]` → `items: itemPayloads`).

---

### GÖREV 2/10 — Malzeme / Kaplama / Şekil Seçimi (P1)

#### Sorun
Sadece serbest metin başlık var — malzeme, kaplama, şekil yapısal olarak seçilmiyor.

#### Değişiklik

Her item kartına dropdown'lar ekle:

```typescript
interface OrderItem {
  // ... mevcut alanlar ...
  material?: string;      // vinil, transparan, kuse, kraft...
  coating?: string;       // yok, mat, parlak, soft_touch
  shape?: string;         // square, circle, oval, diecut
  customization?: string; // yok, emboss, yaldiz, spotuv
}
```

Malzeme listesi ürün tipine göre değişir:

```typescript
const STICKER_MATERIALS = [
  { id: 'vinil', label: 'Vinil' },
  { id: 'transparan', label: 'Transparan' },
  { id: 'holo', label: 'Holografik' },
  { id: 'simli', label: 'Simli' },
];

const ETIKET_MATERIALS = [
  { id: 'kuse', label: 'Kuşe' },
  { id: 'kraft', label: 'Kraft' },
  { id: 'beyaz', label: 'Opak PP' },
  { id: 'seffaf', label: 'Şeffaf' },
  { id: 'metalik', label: 'Metalize' },
];

const COATINGS = [
  { id: 'yok', label: 'Kaplama yok' },
  { id: 'mat', label: 'Mat selefon' },
  { id: 'parlak', label: 'Parlak selefon' },
  { id: 'soft_touch', label: 'Soft touch' },
];
```

UI — her item kartında ürün tipi seçiminin altına:

```
Malzeme: [Vinil ▼]   Kaplama: [Mat ▼]   Şekil: [Diecut ▼]
```

Seçilen malzeme/kaplama → item title'a otomatik yansıt:

```typescript
// Başlık otomatik üret (elle de düzenlenebilir):
const autoTitle = `${item.product === 'etiket' ? 'Etiket' : 'Sticker'} — ${materialLabel} ${coatingLabel}`;
```

Submit payload'da `meta` alanına ekle:

```typescript
meta: {
  material: item.material,
  coating: item.coating,
  shape: item.shape,
  customization: item.customization,
  notes: notes.trim() || undefined,
}
```

---

### GÖREV 3/10 — Mevcut Müşteri Arama (P1)

#### Sorun
Her seferinde ad/tel/adres elle yazılıyor — tekrar müşteri için zahmetli.

#### Değişiklik

Müşteri bilgileri kartının üstüne arama alanı ekle:

```typescript
const [customerSearch, setCustomerSearch] = useState('');
const [customerResults, setCustomerResults] = useState<any[]>([]);
const [searchLoading, setSearchLoading] = useState(false);

// Debounced search — 300ms
useEffect(() => {
  if (customerSearch.length < 2) { setCustomerResults([]); return; }
  const timer = setTimeout(async () => {
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/admin/customers?q=${encodeURIComponent(customerSearch)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setCustomerResults(data.customers ?? []);
      }
    } finally {
      setSearchLoading(false);
    }
  }, 300);
  return () => clearTimeout(timer);
}, [customerSearch]);
```

UI:

```
┌─ Müşteri bilgileri ──────────────────────────────┐
│                                                   │
│ 🔍 Mevcut müşteri ara: [Ali Yılmaz________] ▼   │
│  ┌─────────────────────────────────────────────┐  │
│  │ Ali Yılmaz · 0532 123 45 67 · İstanbul    │  │  ← tıkla → doldur
│  │ Aliye Demir · 0555 987 65 43 · Ankara     │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│ veya yeni müşteri bilgisi gir:                    │
│ Ad Soyad: [____________]  Telefon: [__________]  │
│ Şehir: [__________]      Adres: [____________]   │
└───────────────────────────────────────────────────┘
```

Müşteri seçildiğinde:

```typescript
const selectCustomer = (c: any) => {
  setName(c.display_name ?? '');
  setPhone(c.phone ?? '');
  setCity(c.city ?? '');
  setAddress(c.address ?? '');
  setEmail(c.email ?? '');
  if (c.invoice_type === 'corporate') {
    setInvoiceType('corporate');
    setVkn(c.vkn ?? '');
    setCompanyName(c.company_name ?? '');
    setTaxOffice(c.tax_office ?? '');
  }
  setCustomerSearch('');
  setCustomerResults([]);
};
```

NOT: `/api/admin/customers` endpoint'i zaten mevcut ve `?q=` arama destekliyor (CRM sayfasında kullanılıyor). Sadece frontend'de çağırmak yeterli.

---

### GÖREV 4/10 — Otomatik Fiyat Hesaplama (P1)

#### Sorun
Birim fiyat elle giriliyor — fiyat motoruyla tutarsız olabilir.

#### Değişiklik

Her item kartında "birim fiyat" input'unun yanına "Hesapla" butonu ekle:

```typescript
const calcPrice = async (item: OrderItem) => {
  if (!item.material) {
    toast.error('Önce malzeme seç');
    return;
  }
  
  const w = Number(item.width) || 0;
  const h = Number(item.height) || 0;
  const q = Number(item.qty) || 0;
  
  if (w <= 0 || h <= 0 || q <= 0) {
    toast.error('Boyut ve adet gir');
    return;
  }

  try {
    // Müşteri tarafındaki pricing API'yi kullan
    const res = await fetch('/api/public/pricebook');
    // veya doğrudan client-side hesaplama:
    // quoteCustomerSticker / quoteEtiket fonksiyonlarını çağır

    // En basit: admin pricing API'den canlı config çek + calculatePrice
    const configRes = await fetch(`/api/admin/pricing?scope=${item.product === 'sticker' ? 'sticker' : 'etiket_rulo'}`);
    const configData = await configRes.json();
    
    if (configData.ok && configData.live) {
      // calculatePrice ile birim fiyat hesapla
      // ...
      const unitPrice = result.unitPrice;
      updateItem(item.id, { unit: unitPrice.toFixed(4) });
      toast.success(`Birim fiyat: ${unitPrice.toFixed(2)} ₺`);
    }
  } catch {
    toast.error('Fiyat hesaplanamadı');
  }
};
```

UI:

```
Birim fiyat (₺): [0.85] [🔄 Hesapla]
                          ↑ malzeme + boyut + adet'e göre otomatik
```

Hesapla butonu disabled olsun eğer malzeme/boyut/adet eksikse.

---

### GÖREV 5/10 — Tasarım Dosyası Yükleme (P2)

#### Sorun
Sipariş oluşturuluyor ama dosya ayrıca yüklenmeli.

#### Değişiklik

Her item kartının altına opsiyonel dosya yükleme alanı ekle:

```typescript
interface OrderItem {
  // ... mevcut alanlar ...
  designFile?: File | null;
  designPreviewUrl?: string;
  skipDesign?: boolean;   // "dosya sonra yüklenecek"
}
```

UI:

```
┌─ Tasarım dosyası (opsiyonel) ─────────────────────┐
│                                                     │
│ ☐ Dosya sonra yüklenecek                           │
│                                                     │
│ [Dosya seç veya sürükle]                           │
│ PNG, AI, PSD, PDF, SVG, JPG · max 30MB            │
│                                                     │
│ [logo.png — 2.4MB ✓]                   [✕ Kaldır] │
└─────────────────────────────────────────────────────┘
```

"Dosya sonra yüklenecek" checkbox işaretlenirse dosya alanı gizlenir.

Submit akışı:
1. Sipariş oluştur (`POST /api/admin/orders/manual`)
2. Dosya varsa → her dosya için `POST /api/design/upload-init` + `PUT` + `POST /api/design/upload-complete`
3. Dosya yoksa → sipariş `awaiting_upload` kalır (mevcut davranış)

---

## EKLEMELER (5)

### GÖREV 6/10 — E-posta Alanı (P2)

#### Değişiklik

Müşteri bilgileri kartına email alanı ekle:

```typescript
const [email, setEmail] = useState('');
```

```
Ad Soyad: [________]  Telefon: [__________]
E-posta: [________]   Şehir: [__________]
Adres: [________________________________]
```

Validation'a ekle (opsiyonel — zorunlu değil):

```typescript
if (email && !email.includes('@')) return 'Geçerli bir e-posta gir';
```

Submit payload'daki `address` objesine ekle:

```typescript
address: {
  name, phone, addr: address, city, label: "Manuel giriş",
  email: email.trim() || undefined,  // YENİ
}
```

---

### GÖREV 7/10 — Teslimat Süresi Düzenleme (P2)

#### Değişiklik

Özet kartında veya ödeme kartında teslimat süresi göster + düzenlenebilir yap:

```typescript
const defaultDeliveryDays = product === 'sticker' ? 7 : 12;
const [deliveryDays, setDeliveryDays] = useState(defaultDeliveryDays);

// Ürün tipi değişince default güncelle:
useEffect(() => {
  setDeliveryDays(product === 'sticker' ? 7 : 12);
}, [product]);
```

UI — özet kartında:

```
Tahmini teslimat: [12] iş günü  (standart: etiket 12, sticker 7)
```

Submit'te:

```typescript
estimatedDelivery: addDaysIso(deliveryDays),
```

---

### GÖREV 8/10 — İndirim / Kupon Alanı (P2)

#### Değişiklik

Ödeme kartının altına indirim bölümü ekle:

```typescript
type DiscountType = 'none' | 'percent' | 'fixed';
const [discountType, setDiscountType] = useState<DiscountType>('none');
const [discountValue, setDiscountValue] = useState('');

const discountAmount = useMemo(() => {
  const val = Number(discountValue) || 0;
  if (discountType === 'percent') return Math.round(subtotal * val / 100);
  if (discountType === 'fixed') return Math.min(val, subtotal);
  return 0;
}, [discountType, discountValue, subtotal]);

// Toplam güncelle:
const total = subtotal - discountAmount + vat + shipping;
// KDV hesabı: (subtotal - discount) × VAT_RATE
const vatBase = subtotal - discountAmount;
const vat = Math.round(vatBase * VAT_RATE);
```

UI:

```
┌─ İndirim (opsiyonel) ─────────────────────────────┐
│ [○ Yok] [○ Yüzde (%)] [○ Sabit tutar (₺)]       │
│                                                     │
│ Değer: [10]  → 85₺ indirim                        │
│ Sebep: [Telefonda anlaşıldı____________]           │
└─────────────────────────────────────────────────────┘
```

Submit payload'a ekle:

```typescript
discount: discountAmount > 0 ? {
  type: discountType,
  value: Number(discountValue),
  amount: discountAmount,
  reason: discountReason.trim(),
} : undefined,
```

Özet kartında:

```
Ara toplam:    850 ₺
İndirim (%10): -85 ₺
KDV (%20):     153 ₺
Kargo:         Ücretsiz
───────────────────
Toplam:        918 ₺
```

---

### GÖREV 9/10 — "Kaydet ve Yeni Sipariş" Butonu (P2)

#### Değişiklik

Submit bölümüne 2. buton ekle:

```typescript
const [submitAction, setSubmitAction] = useState<'redirect' | 'new'>('redirect');

const handleSubmit = async () => {
  // ... mevcut logic ...
  
  toast.success(`Sipariş oluşturuldu — ${json.orderId}`);
  
  if (submitAction === 'new') {
    resetForm(); // tüm state'leri başlangıca döndür
  } else {
    router.push(`/admin/siparisler/${json.orderId}`);
  }
};
```

UI:

```
[İptal]  [Oluştur ve detaya git]  [Oluştur ve yeni ekle]
                                    ↑ secondary buton
```

```typescript
<Button
  type="button"
  variant="ghost"
  onClick={() => { setSubmitAction('new'); void handleSubmit(); }}
  disabled={loading}
>
  Oluştur + yeni ekle
</Button>
<Button
  type="submit"
  variant="primary"
  size="lg"
  className="flex-1"
  disabled={loading}
>
  {loading ? "Kaydediliyor..." : "Oluştur ve detaya git"}
</Button>
```

`resetForm` fonksiyonu:

```typescript
const resetForm = () => {
  setName(''); setPhone(''); setCity(''); setAddress(''); setEmail('');
  setInvoiceType('individual'); setTc(''); setVkn(''); setCompanyName(''); setTaxOffice('');
  setItems([{ id: crypto.randomUUID(), product: 'etiket', title: '', width: '60', height: '40', qty: '1000', unit: '0.85' }]);
  setPayment('transfer'); setNotes('');
  setDiscountType('none'); setDiscountValue('');
  setDeliveryDays(12);
};
```

---

### GÖREV 10/10 — Otomatik Taslak Kaydetme (P3)

#### Sorun
Yarım kalan form kaybolur — sayfa kapanınca her şey gider.

#### Değişiklik

Form state'ini localStorage'a 10sn'de bir auto-save:

```typescript
const DRAFT_KEY = 'pim_manual_order_draft_v1';

// Auto-save (10sn debounce)
useEffect(() => {
  const timer = setTimeout(() => {
    const draft = { name, phone, city, address, email, invoiceType, tc, vkn, companyName, taxOffice, items, payment, notes, discountType, discountValue, deliveryDays };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, 10_000);
  return () => clearTimeout(timer);
}, [name, phone, city, address, email, invoiceType, tc, vkn, companyName, taxOffice, items, payment, notes, discountType, discountValue, deliveryDays]);

// Mount'ta taslak kontrol
useEffect(() => {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (saved) {
    try {
      const draft = JSON.parse(saved);
      // Basit kontrol: en az 1 alan doluysa sor
      if (draft.name || draft.phone || draft.items?.[0]?.title) {
        if (confirm('Önceki oturumdan kaydedilmemiş taslak var. Devam etmek ister misin?')) {
          // State'leri restore et
          setName(draft.name ?? '');
          setPhone(draft.phone ?? '');
          // ... diğer alanlar ...
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      }
    } catch { /* corrupted draft, ignore */ }
  }
}, []);

// Başarılı submit sonrası taslağı temizle:
localStorage.removeItem(DRAFT_KEY);
```

Sayfanın üstünde taslak varsa küçük bilgi:

```typescript
{hasDraft && (
  <div className="mb-3 text-[12px] text-sari-koyu bg-sari-soft/30 rounded px-3 py-2">
    📝 Önceki oturumdan taslak yüklendi.
    <button onClick={() => { resetForm(); localStorage.removeItem(DRAFT_KEY); }} className="underline ml-2">Temizle</button>
  </div>
)}
```

---

## Uygulama Sırası

| # | Görev | Süre |
|---|---|---|
| 1 | Çoklu ürün ekleme | 1.5 sa |
| 2 | Malzeme/kaplama/şekil dropdown | 1 sa |
| 3 | Mevcut müşteri arama | 45 dk |
| 4 | Otomatik fiyat hesaplama | 45 dk |
| 5 | Tasarım dosyası yükleme | 1 sa |
| 6 | E-posta alanı | 10 dk |
| 7 | Teslimat süresi düzenleme | 15 dk |
| 8 | İndirim/kupon alanı | 30 dk |
| 9 | Kaydet ve yeni sipariş | 15 dk |
| 10 | Otomatik taslak kaydetme | 30 dk |

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
