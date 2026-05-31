# Marka Konumlandırma Hizalaması — "online etiket & sticker baskı, etikette uzman"

## AMAÇ
Makinelerin (Google + AI) bizi doğru ve net kategorize etmesi için kendimizi tanımladığımız metinleri
**somut kategoriyle** hizala. Şu an ana sayfa/Organization "AI destekli dijital baskı **ekosistemi**" diyor
(soyut, kategori-belirsiz). Sefa kararı: birincil tanım **"Türkiye'de online etiket ve sticker baskı —
AI destekli, küçük adetten"**.

**Strateji:** Etikette uzmanlık → **etiket öne çıksın, sticker yanında**; "AI destekli" ve "küçük adet"
ana kategori değil, **fark/üst-başlık**. "ekosistem" kelimesini kaldır.

> Sadece metin/schema değişikliği. Mantık/akış değişmez. CLAUDE.md sefaRules geçerli (abartı/dalkavuk dil yok,
> "süresiz" yok). tsc temiz kalmalı.

---

## GÖREV 1/4 — Root metadata (`src/app/layout.tsx`)

- **`description`** (şu an "AI destekli dijital baskı ekosistemi…") → somut, etiket-öncelikli, ~150-160 karakter:
  > `"Türkiye'de online etiket ve sticker baskı. Kuşe, şeffaf, kraft etikette uzman; küçük adetten, AI destekli. Tasarımını yükle ya da şablon seç, baskıya gönder."`
- **`openGraph.description`** ve **`twitter.description`** → aynı/uyumlu metin.
- **`keywords`** → etiket terimlerini öne al, sticker'ı sonra:
  `["online etiket baskı", "etiket baskı", "kuşe etiket", "şeffaf etiket", "kraft etiket", "rulo etiket baskı", "tabaka etiket", "küçük adet etiket baskı", "sticker baskı", "die cut sticker", "hologram sticker", "AI destekli etiket baskı"]`
- **Title (MARKA KARARI — Sefa'ya not):** Şu an `default: "Pim Etiket — Markanın Etiketi, Fikrinin Sticker'ı"` (şiirsel, "etiket baskı" ifadesi yok). SEO için kategori-net öneri:
  > `default: "Pim Etiket — Online Etiket & Sticker Baskı"`
  Şiirsel cümle ana sayfa H1/hero'da kalabilir. **İki seçeneği de yorum olarak bırak**, Sefa hangisini isterse o aktif olsun (varsayılan: kategori-net olan). Tek satır `// SEFA: marka başlığı mı (şiirsel) yoksa kategori-net mi?` yorumu.

**Doğrulama:** `<title>` ve meta description'da "etiket baskı" net geçiyor; "ekosistem" kalmadı.

---

## GÖREV 2/4 — Organization schema (`src/app/layout.tsx`, `ORGANIZATION_LD`)

- **`description`** → somut + etiket vurgusu:
  > `"Türkiye'de online etiket ve sticker baskı hizmeti — etiket baskıda uzman, küçük adet dahil, AI destekli. Türkiye geneli teslimat."`
- Başka alan (legalName, adres, vatID, email) **değişmez**.

**Doğrulama:** Rich Results / schema validator'da Organization.description yeni metni gösterir, hata yok.

---

## GÖREV 3/4 — llms.txt (`public/llms.txt`)

- Açılış `>` satırını etiket-öncelikli + uzmanlık + küçük adet ile güncelle (mevcut yapıyı koru):
  > `> Türkiye'de online etiket ve sticker baskı hizmeti — etiket baskıda uzman. Kuşe, şeffaf/transparan, kraft, metalik, holografik, vinil malzemelerde rulo ve tabaka etiket; die-cut, kiss-cut, bumper sticker. Küçük adetten, AI destekli: online yapılandır, tasarım yükle ya da şablon seç, baskıya gönder.`
- Ürün listesinde **Etiket baskı maddesi en üstte** kalsın (zaten öyle).

**Doğrulama:** `/llms.txt` açılış cümlesi etiket-öncelikli; linkler bozulmadı.

---

## GÖREV 4/4 — Tutarlılık kontrolü (anasayfa hero + hakkımızda)

- `src/app/page.tsx` ana hero alt başlığı ve `src/app/hakkimizda` giriş cümlesinde marka tanımı varsa,
  aynı dille hizala: "online etiket ve sticker baskı — etikette uzman, AI destekli, küçük adetten".
  (Şiirsel H1 başlığına dokunma; sadece **tanım/açıklama** cümlesini tutarlı yap.)
- Yeni kategori/iddia **uydurma** — sadece mevcut tanımı somutlaştır.

**Doğrulama:** Anasayfa, Organization, llms.txt, metadata aynı "ne yapan firma" cümlesini söylüyor (varlık tutarlılığı).

---

## GENEL DOĞRULAMA
1. `tsc --noEmit` temiz.
2. Hiçbir yerde "dijital baskı ekosistemi" (soyut) kalmadı; "online etiket ve sticker baskı" (somut) + "etikette uzman" geçiyor.
3. keywords etiket-öncelikli.
4. Mevcut akış/tasarım bozulmadı (sadece metin/schema).

## DEĞİŞEN DOSYALAR
`src/app/layout.tsx` (metadata + Organization), `public/llms.txt`, (gerekirse) `src/app/page.tsx`,
`src/app/hakkimizda/*` — yalnız tanım cümleleri.
</content>
