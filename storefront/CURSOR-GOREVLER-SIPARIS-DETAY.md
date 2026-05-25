# Cursor Sipariş Detay Sayfası İyileştirmeleri — `/siparis/[id]`

> Claude Code (mimari) tarafından hazırlanmıştır.
> Dosya: `src/app/siparis/[id]/page.tsx` (1300+ satır)
> 10 görev: 4 düzeltme + 6 ekleme

---

## DÜZELTMELER (4)

### GÖREV 1/10 — localStorage Cache Kaldır (P1 Bug)

#### Sorun
`DesignUploadCard` component'i (satır 1218-1241) hâlâ `pim_design_files_v1` localStorage key'i kullanıyor. DB'den design_files de çekiliyor → 2 veri kaynağı tutarsız → müşteri farklı cihazda dosyaları görmez.

#### Değişiklik

`loadFiles()` ve `saveFiles()` fonksiyonlarını (satır 1218-1241) kaldır veya devre dışı bırak. `DesignUploadCard` component'inin dosya listesini sadece DB'den (Supabase `design_files` tablosu) okumasını sağla.

Mevcut DB fetch zaten var mı kontrol et — `dbRowToUploaded()` (satır 1254-1273) tanımlı. Bu fonksiyon kullanılıyor mu? Eğer DesignUploadCard zaten DB'den okuyorsa, localStorage backup'ı tamamen sil:

```typescript
// SİL veya yorum yap:
// const STORAGE_KEY_FILES = "pim_design_files_v1";
// function loadFiles(orderId: string): UploadedFile[] { ... }
// function saveFiles(orderId: string, files: UploadedFile[]): void { ... }
```

DesignUploadCard component'inde `loadFiles`/`saveFiles` çağrılarını bul ve kaldır. Yerine sadece DB fetch sonucunu kullan.

---

### GÖREV 2/10 — EPS Metin Kaldır (P1 Bug)

#### Sorun
Satır 114 ve 217'de "PDF, AI, **EPS**, PSD, PNG, JPG, SVG" yazıyor ama EPS sistemden çıkarıldı.

#### Değişiklik

TR (satır 114):
```typescript
// ESKİ:
designEmptyDesc: "PDF, AI, EPS, PSD, PNG, JPG, SVG kabul ederim..."

// YENİ:
designEmptyDesc: "PDF, AI, PSD, PNG, JPG, SVG kabul ederim. Yükledikten sonra Pim AI saniyeler içinde DPI / CMYK / boşluk kontrolü yapar.",
```

EN (satır 217):
```typescript
// ESKİ:
designEmptyDesc: "Accepts PDF, AI, EPS, PSD, PNG, JPG, SVG..."

// YENİ:
designEmptyDesc: "Accepts PDF, AI, PSD, PNG, JPG, SVG. Once uploaded, Pim AI runs DPI / CMYK / margin checks in seconds.",
```

---

### GÖREV 3/10 — Prova Değişiklik İste → Modal (P1)

#### Sorun
`respondToProof("request_change")` satır 329'da `prompt()` kullanıyor — native browser prompt, kötü UX.

#### Değişiklik

State ekle:

```typescript
const [changeRequestOpen, setChangeRequestOpen] = useState(false);
const [changeRequestNote, setChangeRequestNote] = useState('');
```

Mevcut `respondToProof` fonksiyonundaki `request_change` dalını güncelle:

```typescript
// ESKİ (satır 328-336):
// if (action === "request_change") {
//   note = prompt("Hangi değişikliği istiyorsun?");
//   if (note === null) { setProofResponding(false); return; }
// }

// YENİ — "Değişiklik iste" butonu modal açar:
// respondToProof sadece "approve" için direkt çağrılır
// "request_change" için modal açılır, modal içinden submit
```

"Değişiklik iste" butonunu (satır ~820) güncelle:

```typescript
<Button
  variant="secondary"
  onClick={() => setChangeRequestOpen(true)}
  disabled={proofResponding}
>
  {c.proofRequestChange}
</Button>
```

Modal:

```typescript
{changeRequestOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <Card padding="p-6" className="w-full max-w-md">
      <h3 className="text-lg font-semibold text-lacivert mb-2">
        {locale === 'en' ? 'Request changes' : 'Değişiklik iste'}
      </h3>
      <p className="text-[13px] text-gri-700 mb-4">
        {locale === 'en'
          ? 'Describe what you want changed. Our team will review and update the proof.'
          : 'Ne değişmesini istiyorsun? Ekibimiz inceleyip provayı güncelleyecek.'}
      </p>
      <textarea
        value={changeRequestNote}
        onChange={(e) => setChangeRequestNote(e.target.value)}
        placeholder={locale === 'en'
          ? 'e.g. "Logo should be 2mm bigger" or "Cut line too close to edge"'
          : 'Örn: "Logo 2mm büyük olsun" veya "Bıçak çizgisi kenara çok yakın"'}
        rows={4}
        className="w-full px-3 py-2.5 rounded-lg ring-1 ring-gri-200 text-[14px] focus:ring-2 focus:ring-pim-mercan/40 focus:outline-none resize-none mb-4"
        autoFocus
      />
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={() => { setChangeRequestOpen(false); setChangeRequestNote(''); }}>
          {locale === 'en' ? 'Cancel' : 'Vazgeç'}
        </Button>
        <Button
          variant="primary"
          onClick={async () => {
            setChangeRequestOpen(false);
            await respondToProof("request_change");
            setChangeRequestNote('');
          }}
          disabled={proofResponding}
        >
          {locale === 'en' ? 'Send request' : 'Talebi gönder'}
        </Button>
      </div>
    </Card>
  </div>
)}
```

`respondToProof` fonksiyonunda `note` değişkenini `changeRequestNote` state'inden al (prompt yerine).

---

### GÖREV 4/10 — "Pim'e sor" Butonu Çalıştır (P1 Bug)

#### Sorun
Satır 1185: `<button>` onClick yok → tıklayınca hiçbir şey olmuyor.

#### Değişiklik

```typescript
// ESKİ (satır 1185):
<button className="text-[12.5px] font-semibold text-pim-mercan mt-2 hover:underline">
  {c.openChat}
</button>

// YENİ — PimChat widget'ı aç:
<button
  className="text-[12.5px] font-semibold text-pim-mercan mt-2 hover:underline"
  onClick={() => {
    // PimChat floating butonunu programmatic aç
    // Mevcut PimChat window event'i var mı kontrol et
    window.dispatchEvent(new CustomEvent('pim-chat-open', {
      detail: { context: `siparis_${order?.id}` },
    }));
  }}
>
  {c.openChat}
</button>
```

NOT: `PimChat.tsx` component'inde `pim-chat-open` event listener'ı yoksa ekle. Alternatif olarak SSS sayfasına link:

```typescript
<Link
  href="/sss"
  className="text-[12.5px] font-semibold text-pim-mercan mt-2 hover:underline"
>
  {c.openChat}
</Link>
```

Hangisi daha kolay uygulanabilirse onu yap. PimChat event mekanizması yoksa Link kullan.

---

## EKLEMELER (6)

### GÖREV 5/10 — Fatura PDF İndirme (P2)

#### Değişiklik

Ödeme kartında (satır ~1160-1174) "Fatura" satırının yanına indirme linki:

```typescript
<div className="text-[11.5px] text-gri-500 mt-2 flex items-center justify-between">
  <span>
    {c.invoice}: {INVOICE_LABEL[order.invoice.type]}
  </span>
  {/* Fatura PDF — basit sipariş özeti */}
  <button
    type="button"
    onClick={async () => {
      // Basit yaklaşım: mevcut print-job manifest'ten PDF üret
      // veya /api/orders/[id]/invoice-pdf endpoint'i
      window.open(`/api/orders/${order.id}/invoice-pdf`, '_blank');
    }}
    className="text-[11px] font-semibold text-pim-mercan hover:underline"
  >
    📄 Fatura indir
  </button>
</div>
```

Fatura PDF endpoint yoksa şimdilik bu butonu gizle:

```typescript
{/* TODO: /api/orders/[id]/invoice-pdf endpoint hazır olunca aktif et */}
{false && (
  <button ...>📄 Fatura indir</button>
)}
```

---

### GÖREV 6/10 — İade Talebi Linki (P2)

#### Değişiklik

Delivered sipariş'te, Pim sohbet kartının ÜSTÜNE:

```typescript
{order.status === 'delivered' && (
  <Card padding="p-4" className="!bg-gri-50">
    <div className="flex items-center justify-between">
      <div>
        <div className="font-semibold text-[13px]">
          {locale === 'en' ? 'Need to return?' : 'İade mi istiyorsun?'}
        </div>
        <div className="text-[12px] text-gri-700 mt-0.5">
          {locale === 'en'
            ? 'Submit a return request within 14 days'
            : '14 gün içinde iade talebi oluşturabilirsin'}
        </div>
      </div>
      <Button variant="ghost" size="sm" href="/iade-talep">
        {locale === 'en' ? 'Return request' : 'İade talebi →'}
      </Button>
    </div>
  </Card>
)}
```

---

### GÖREV 7/10 — SLA Countdown (proof_pending) (P2)

#### Değişiklik

proof_pending CTA kartında (satır ~710-727), "Prova onayın bekleniyor" mesajının yanına SLA geri sayım:

```typescript
{order.status === "proof_pending" && (
  <div className="mt-4 rounded-xl bg-pim-mercan-tint/30 ring-1 ring-pim-mercan/30 p-4">
    <div className="flex items-center justify-between mb-1">
      <div className="font-semibold text-[14px] text-pim-mercan">
        ✋ {locale === 'en' ? 'Proof approval needed' : 'Prova onayın bekleniyor'}
      </div>
      {/* SLA countdown */}
      <SlaCountdown createdAt={order.createdAt} locale={locale} />
    </div>
    <p className="text-[13px] text-gri-700 mb-3">...</p>
    <Button variant="primary" size="sm" href={`/onay/${order.id}`}>...</Button>
  </div>
)}
```

SLA countdown component:

```typescript
function SlaCountdown({ createdAt, locale }: { createdAt: number; locale: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000); // dakikada 1 güncelle
    return () => clearInterval(t);
  }, []);

  const elapsedHours = (now - createdAt) / 3600000;
  const remainingHours = Math.max(0, 36 - elapsedHours);

  if (remainingHours <= 0) {
    return (
      <span className="text-[12px] font-bold text-kirmizi animate-pulse">
        ⏰ {locale === 'en' ? 'SLA expired' : 'Süre doldu!'}
      </span>
    );
  }

  if (remainingHours <= 6) {
    return (
      <span className="text-[12px] font-bold text-kirmizi">
        🔴 {Math.floor(remainingHours)}{locale === 'en' ? 'h left' : ' saat kaldı'}
      </span>
    );
  }

  if (remainingHours <= 12) {
    return (
      <span className="text-[12px] font-semibold text-sari-koyu">
        ⏰ {Math.floor(remainingHours)}{locale === 'en' ? 'h left' : ' saat kaldı'}
      </span>
    );
  }

  return (
    <span className="text-[11px] text-gri-500">
      ⏳ {Math.floor(remainingHours)}{locale === 'en' ? 'h remaining' : ' saat kaldı'}
    </span>
  );
}
```

---

### GÖREV 8/10 — Sipariş İptal Butonu (P2)

#### Değişiklik

Header'daki "Tekrar sipariş" butonunun yanına, awaiting_upload/paid status'ta:

```typescript
{(order.status === 'paid' || order.status === 'awaiting_upload') && (
  <Button
    variant="ghost"
    size="sm"
    onClick={async () => {
      if (!confirm(
        locale === 'en'
          ? 'Are you sure you want to cancel this order? A refund will be processed.'
          : 'Bu siparişi iptal etmek istediğine emin misin? İade işlemi başlatılacak.'
      )) return;
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success(locale === 'en' ? 'Order cancelled — refund initiated' : 'Sipariş iptal edildi — iade başlatıldı');
        void fetchCustomerOrder(id).then(o => o && setOrder(o));
      } else {
        toast.error(locale === 'en' ? 'Cancellation failed' : 'İptal başarısız');
      }
    }}
    className="!text-kirmizi"
  >
    {locale === 'en' ? 'Cancel order' : 'Siparişi iptal et'}
  </Button>
)}
```

NOT: `/api/orders/[id]/cancel` endpoint'i yoksa oluştur — sadece paid/awaiting_upload status'tan cancelled'a geçiş + PayTR refund trigger.

---

### GÖREV 9/10 — Tasarım Thumbnail Lightbox (P2)

#### Değişiklik

Sipariş özetindeki `SiparisOzetiDesignThumb` (satır ~906-913) tıklandığında büyütme:

```typescript
const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

// Thumbnail'a onClick ekle:
<div onClick={() => setLightboxSrc(previewUrl)} className="cursor-zoom-in">
  <SiparisOzetiDesignThumb ... />
</div>

// Lightbox:
{lightboxSrc && (
  <div
    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
    onClick={() => setLightboxSrc(null)}
  >
    <img
      src={lightboxSrc}
      alt="Tasarım büyütme"
      className="max-w-full max-h-[90vh] object-contain rounded-lg"
    />
    <button
      className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40"
      onClick={() => setLightboxSrc(null)}
    >
      ✕
    </button>
  </div>
)}
```

---

### GÖREV 10/10 — Mobil Sticky CTA (P2)

#### Değişiklik

Sayfanın en altına, status'a göre koşullu mobil sticky bar:

```typescript
{/* MOBILE STICKY CTA */}
{(() => {
  if (order.status === 'awaiting_upload' || order.status === 'paid') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-sm border-t border-gri-200 shadow-lg px-4 py-3 safe-area-bottom">
        <Button variant="primary" size="md" href={`/siparis/${order.id}/tasarim-yukle`} className="w-full">
          📁 Tasarım yükle
        </Button>
      </div>
    );
  }
  if (order.status === 'proof_pending') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-sm border-t border-gri-200 shadow-lg px-4 py-3 safe-area-bottom">
        <Button variant="primary" size="md" href={`/onay/${order.id}`} className="w-full !bg-yesil hover:!bg-yesil-koyu">
          ✋ Provayı onayla
        </Button>
      </div>
    );
  }
  return null;
})()}
{/* Bottom padding for sticky bar */}
{(order.status === 'awaiting_upload' || order.status === 'paid' || order.status === 'proof_pending') && (
  <div className="h-16 md:hidden" aria-hidden />
)}
```

---

## Uygulama Sırası

| # | Görev | Süre |
|---|---|---|
| 1 | localStorage cache kaldır | 15 dk |
| 2 | EPS metin kaldır | 2 dk |
| 3 | Prova değişiklik iste → modal | 20 dk |
| 4 | "Pim'e sor" butonu çalıştır | 5 dk |
| 5 | Fatura PDF indirme | 10 dk |
| 6 | İade talebi linki (delivered) | 10 dk |
| 7 | SLA countdown (proof_pending) | 15 dk |
| 8 | Sipariş iptal butonu (paid/awaiting_upload) | 15 dk |
| 9 | Tasarım thumbnail lightbox | 15 dk |
| 10 | Mobil sticky CTA | 10 dk |

Her görev sonrası: `npx tsc --noEmit` + commit.

---

*Hazırlayan: Claude Code (mimari) · 25 May 2026*
