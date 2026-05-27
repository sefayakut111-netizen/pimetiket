Admin paneli icerik bolumu — 6 fix. Emoji kullanma. Bu session'da sadece Cursor kod yaziyor.

---

## FIX 1 — Aboneler test filtresi

`/admin/aboneler` sayfasinda test verisi filtresi yok. Diger sayfalardaki (Siparisler, Prova, Tasarimlar) gibi toggle ekle.

Test aboneleri filtrele: e-posta adresi `+test` iceren veya `test` kelimesi gecen kayitlar.

```tsx
// Toggle:
(1 test abonesi gizli) [Test abonelerini goster]
```

Mevcut `isTestOrderLike` veya benzeri helper'i kullan ya da aboneler icin yeni filtre fonksiyonu olustur.

---

## FIX 2 — Aboneler tab chip sayilari

Sekmelerde kayit sayisi yok: "Tumu / Sablon / Bulten / Siparis sonrasi"

Sayi ekle:
```
Tumu (2) / Sablon (2) / Bulten (0) / Siparis sonrasi (0)
```

---

## FIX 3 — Blog "Sil" butonu confirm modal

`/admin/blog` sayfasinda yayinda bir yazinin yaninda "Sil" linki var. Tiklandiginda confirm modal cikmali:

```tsx
// Sil tiklaninca:
if (!confirm) {
  // Modal ac:
  // "Bu yaziyi silmek istediginizden emin misiniz? Bu islem geri alinamaz."
  // [Iptal] [Sil]
}
```

Zaten modal varsa dogrula. Yoksa ekle — yayindaki icerigin yanlislikla silinmesi tehlikeli.

---

## FIX 4 — Urunler toplu siralama

`/admin/urunler` sayfasinda 22 kart tek tek yukari/asagi butonuyla siralaniyor. 11. sirayi 1.'ye cekmek 10 tik.

Cozum (birini sec):

**A) Drag & drop:** `@dnd-kit/core` veya native HTML drag ile siralama. Karmasik ama en iyi UX.

**B) Siralama input:** Her kartta sayi input'u — operatör direkt "1" yazar, kaydeder.

**C) Toplu aktif/pasif:** Checkbox + "Secilenleri gizle/goster" bar'i.

En basit olan B secenegi yeterli — her kartta kucuk sayi input'u:
```tsx
<input type="number" value={card.sort_order} onChange={...} className="w-14 h-8 text-center" />
```

---

## FIX 5 — Blog SEO alanlari listede gosterme

`/admin/blog` listesinde meta description, OG image, okuma suresi gorunmuyor.

Her blog satirinda su bilgileri ekle:
- Meta description: ilk 60 karakter (varsa yesil tik, yoksa kirmizi "SEO eksik")
- OG image: kucuk thumbnail (varsa) veya "Gorsel yok" uyarisi
- Okuma suresi: "3 dk" gibi (kelime sayisi / 200)

```tsx
<td className="text-xs text-gri-500">
  {post.metaDescription ? "SEO ✓" : <span className="text-kirmizi">SEO eksik</span>}
</td>
<td className="text-xs text-gri-500">
  {post.ogImage ? <img src={post.ogImage} className="w-8 h-8 rounded" /> : "—"}
</td>
```

---

## FIX 6 — Site Gorselleri OG slot link tutarliligi

`/admin/site-gorselleri` sayfasinda bazi slot'larda "Sayfayi ac" linki var, bazlarinda yok.

Her slot icin uygun link ekle:
- Anasayfa Hero → `/`
- Etiket Karti → `/etiket`
- Sticker Karti → `/sticker`
- Sablonlar Hero → `/sablonlar`
- Giris Hero → `/auth`
- OG Default → `/`
- OG Anasayfa → `/`
- Blog Default Hero → `/blog`

Link yoksa ekle, tutarli olsun.

---

## KONTROL

Her fix sonrasi: `npx tsc --noEmit` + commit (`fix(admin):` prefix)
