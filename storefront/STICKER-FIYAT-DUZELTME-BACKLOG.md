# Sticker Fiyat — Bekleyen Küçük Düzeltmeler (backlog)

> Tek tek commit yerine biriktirilir; 2-3 madde olunca (veya Sefa "yap" deyince) **tek Cursor prompt'unda** uygulanır.
> Hepsi gösterim/metin veya küçük tutarlılık — fiyat/geometri motoru DEĞİŞMEZ. Her uygulamada `tsc 0` + kartlı runner 556.85.

## Açık maddeler

### 1) MALİYET kartı alt-yazısı stale (91dd846 sonrası)
- **Dosya:** `src/components/admin/pricing/StickerCalculator.tsx` → MALİYET kartı (`OperatorCostHero`) alt açıklaması.
- **Sorun:** Hâlâ *"partner alacağı · m² maliyet × (laminasyon+kesim) × tier"* yazıyor. Ama 91dd846 ile partner
  maliyetinden **kesim + tier ÇIKTI** (sadece m² maliyet × laminasyon kaldı).
- **Fix:** Metni **"partner alacağı · m² maliyet × laminasyon"** yap. (Hesap zaten doğru; sadece açıklama eski.)
- **Ciddiyet:** Kozmetik. Yanlış fiyat değil, yanlış açıklama.

### 2) Sayfa modu — Malzeme adımı TAMAM işaretlenmiyor (Faz 2 canlı doğrulama)
- **Dosya:** `src/app/sticker/yapilandir/page.tsx` → adım-tamamlanma (step tracker) mantığı, sayfa modu dalı.
- **Sorun:** `?sayfa=1` modunda Malzeme kartı seçilince fiyat + özet doğru güncelleniyor (Opak 302₺ → Hologram 464₺ doğrulandı) **ama** ADIMLAR panelinde "Malzeme · ADIM 1" yeşil **TAMAM** olmuyor (Laminasyon/Sayfa boyutu/Sayfa adedi TAMAM oluyor).
- **Fix:** Sayfa modunda malzeme seçili ise Malzeme adımını da `tamam` say.
- **Ciddiyet:** Kozmetik — AMA "Sepete ekle" tüm adımların TAMAM olmasına bağlıysa **Faz 3'te blocker** olabilir; Faz 3'te sepet akışıyla birlikte kontrol et.

### 3) Sayfa modu — İŞLEM ÖZETİ bireysel-sticker alanları gösteriyor (Faz 2 canlı doğrulama)
- **Dosya:** `src/app/sticker/yapilandir/page.tsx` → İŞLEM ÖZETİ paneli, sayfa modu dalı.
- **Sorun:** `?sayfa=1` modunda özet hâlâ bireysel alanları gösteriyor: **"Şekil: Kare"**, **"Köşe: Düz"**, **"Toplam adet: X sticker"**. (Boyut/Malzeme/Kesim:Tabaka doğru.)
- **Fix:** Sayfa modunda **Şekil + Köşe satırlarını gizle**, "Toplam adet: X sticker" yerine **"Sayfa adedi: X sayfa"** yaz.
- **Ciddiyet:** Kozmetik. Fiyat doğru; sadece özet etiketleri sayfa moduna uyarlanmamış.

---

## Uygulanmış (referans)
- d14656c: "Toplam tabaka" + overage "+fazla" + fire tabanı netleştirildi.
- 91dd846: partner MALİYET tier+kesimden ayrıldı (malzeme × m² + laminasyon).
- 67fafe1: ölü #4 adımı kaldırıldı + kâr KDV-hariç.
