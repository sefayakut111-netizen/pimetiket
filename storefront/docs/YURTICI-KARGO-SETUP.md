# 📦 Yurtıçi Kargo Kurulum Rehberi

> **Sefa için 4 adımlı kurulum** — kargo etiketi otomasyonu + tracking polling.
> **Süre:** 30 dakika (anlaşma sonrası) · **Maliyet:** anlaşma şartlarına bağlı

---

## Şu anki durum

✅ **Kod tarafı hazır** — `lib/shipping/`, `src/app/api/admin/shipping/label/`, SOAP istemcisi yazılı.
🟡 **DRY_RUN modunda** — `YURTICI_DRY_RUN=true` default, sahte tracking event üretiyor.
❌ **Env yok** — `YURTICI_USERNAME`, `YURTICI_PASSWORD` set değil.

**Sonuç:** Kargo etiketi PDF'i basılır (jspdf zaten çalışıyor — barkod dahil), ama:
- Yurtıçi sistemine **otomatik gönderim talimatı** atılmaz
- **Tracking event'leri** sahte (sefa manuel girer)

---

## Adımlar

### 1. Anlaşma yap (Sefa'da)
1. https://anlasma.yurticikargo.com veya **müşteri temsilcisi** ara
2. **Aylık tahmini gönderim adedi**, **hedef şehirler**, **paket boyutları** söyle
3. Sözleşme tamam → Yurtıçi sana:
   - **Müşteri kodu** (USERNAME)
   - **Müşteri şifresi** (PASSWORD)
   - **SOAP API endpoint** (default: webservices.yurticikargo.com:8080)
   verir

### 2. Vercel'e env ekle (3 dk)
1. Vercel → **Settings** → **Environment Variables**
2. Aşağıdaki 4 değişken (hepsi **Production** scope):

   | Key | Value |
   |-----|-------|
   | `YURTICI_USERNAME` | Müşteri kodu |
   | `YURTICI_PASSWORD` | Müşteri şifresi |
   | `YURTICI_LANGUAGE` | `TR` |
   | `YURTICI_DRY_RUN` | `false` |

3. **(Opsiyonel)** Custom endpoint varsa:
   ```
   YURTICI_TRACKING_ENDPOINT=http://webservices.yurticikargo.com:8080/KOPSWebServices/ShippingOrderDispatcherServices
   ```

### 3. Redeploy (2 dk)
Vercel → Deployments → Redeploy

### 4. Test gönderim
1. Admin → `/admin/siparisler/<id>` → "Kargo Etiketi" kartı
2. "Etiket Bas" → PDF iniyorsa ✓
3. "Yurtıçi'ye Gönder" (varsa) → SOAP istemcisi `createShippingOrder` çağırır
4. Tracking no Yurtıçi'den döner → otomatik `shipments` tablosuna yazılır
5. Cron `shipment-polling` (5 dk'da bir) tracking event'lerini çeker

---

## Mevcut Cron Job'lar

`vercel.json` içinde aktif:
| Cron | Görev | Frekans |
|------|-------|---------|
| `shipment-polling` | Aktif gönderiler için Yurtıçi tracking API'sini sorgular | 5 dk |
| `auto-deliver-stale` | 7 gün önce kargolanan + delivered eventi gelmeyen siparişleri otomatik teslim sayar | 1 saat |

---

## Sorun giderme

### "DRY_RUN modunda" warning hâlâ görünüyor
- `YURTICI_DRY_RUN=false` değil mi kontrol et (string olarak, boolean değil)
- Redeploy yaptın mı?

### SOAP error: "Authentication failed"
- USERNAME/PASSWORD doğru mu? Yurtıçi panel'inden tekrar test et
- IP whitelist gerek mi? Vercel IP aralıklarını Yurtıçi'ye bildir

### Tracking event gelmiyor
- Yurtıçi'nin endpoint'i değişti mi (yeni URL: KEPSWebServices/...)
- Cron çalışıyor mu: Vercel Functions → `/api/cron/shipment-polling` log

---

## Alternatif: Manuel mod (anlaşma gelene kadar)

Anlaşma süreci uzarsa, **manuel tracking** zaten çalışıyor:
1. Sefa kargoya verir, tracking no'yu alır
2. `/admin/kargo/<orderId>` → "Tracking No Gir" → kaydet
3. Müşteri `/siparis/<id>` sayfasında tracking no'yu görür
4. Yurtıçi web sitesine kendi başına bakar

**Bu mod %100 çalışıyor** — Yurtıçi API kurulumu bunu otomatize eder, manuel iş yükünü azaltır.

---

**Tarih:** 21 Mayıs 2026 · **Versiyon:** v1.0
