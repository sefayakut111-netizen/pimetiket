# Pim Etiket — İkon Tasarım Anayasası (Icon Design Spec)

> Bu belge, `src/components/Icon.tsx` kütüphanesine eklenecek **her yeni ikonun** uymak
> zorunda olduğu kuralları tanımlar. Amaç: tek elden çıkmış gibi duran, kurumsal,
> tutarlı bir ikon dili. Üretim (Faz 2) ve QC (Faz 3) bu belgeyi referans alır.

## 1. Teknik çekirdek (değişmez)

| Özellik | Değer |
|---|---|
| `viewBox` | `0 0 24 24` — **istisnasız** |
| `fill` | `none` (outline ikon) |
| `stroke` | `currentColor` — renk asla hard-code edilmez |
| `strokeLinecap` | `round` |
| `strokeLinejoin` | `round` |
| Boyut | `size` prop (px), `width=height=size` |
| Renklendirme | Tailwind `text-*` sınıfı ile (ör. `text-pim-mercan`) |

Ortak başlık `baseProps(size)` helper'ından gelir. Yeni ikon bu helper'ı kullanır:

```tsx
const Yeni = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    {/* path'ler */}
  </svg>
);
```

## 2. Çizgi kalınlığı (stroke-width) skalası

Mevcut kütüphanedeki kullanımdan türetilmiş, **yeni ikonlar da bu skalaya oturur**:

| Kalınlık | Kullanım | Örnek mevcut ikon |
|---|---|---|
| `1.6` | Detaylı / yapısal formlar | Box, Truck, Wallet, Roll, Sticker, Cog, Doc, Tag, Users, Refresh |
| `1.7` | Standart UI ikonları (varsayılan tercih) | Sparkle, Info, ChatBubble, Calendar, Home, User, Eye |
| `1.8` | Güven/öne çıkan rozetler | Shield, Package |
| `2.0` | Çizgisel/geometrik, ok ve menü | ArrowR, X, Menu, Edit, Instagram |
| `3.0` | Yalnız onay vurgusu (tek istisna) | Check |

Kural: **şüphede kalırsan 1.7 kullan.** 1.6–2.0 dışına çıkma; 3.0 yalnız "tik/onay" için.

## 3. Dolgu istisnaları

Genel kural outline'dır. İki meşru istisna:

- **Tam dolu form** (ör. Star): `fill="currentColor"`, stroke yok — yalnız "aktif/seçili/puan" durumları için.
- **Aksan noktası** (ör. Instagram lens noktası): tek küçük detay `fill="currentColor" stroke="none"`.

Bunun dışında dolu (filled) ikon üretme.

## 4. Marka aksanı — mercan kontur kesim

Pim Etiket'in imzası: **kontur kesim (die-cut) ipucu mercan kesikli çizgiyle** verilir.
Ürün/üretim bağlamındaki ikonlarda (sticker tabakası, kesim tipi, etiket bandı) bu aksan kullanılabilir:

```tsx
stroke="#FF6B5B" strokeWidth="1.6" strokeDasharray="2.5 1.6"
```

Mercan, ikonun **vurgu** unsurudur — gövdenin tamamı değil. UI ikonlarında renk
`currentColor`'da kalır; mercan yalnız "kesim/sticker" anlamı taşıyan detaylarda.

## 5. Marka renk paleti (referans)

| Rol | Hex | Token |
|---|---|---|
| Mürekkep (ana çizgi) | `#1F1B2D` | `text-pim-ink` |
| Mercan (aksan/CTA) | `#FF6B5B` | `text-pim-mercan` |
| Kırmızı koyu ton | `#E04B3C` / `#C73A2D` | — |
| Amber | `#F0B22F` | — |
| Krem/bej zemin | `#FAF4E8` / `#EFE9DA` | — |

İkon gövdesi renk almaz; renk **kullanıldığı yerde** `text-*` ile verilir.

## 6. İsimlendirme ve kayıt

- İsim: **PascalCase, semantik** (ne yaptığı, markaya özel değil): `Truck`, `Wallet`, `Shield`.
- Tanım sırası mantıksal gruplara göre; dosya sonundaki `export const Icon = { ... }`
  registry'sine **mutlaka eklenir**.
- Kullanım: `<Icon.Ad size={18} className="text-pim-mercan" />`

## 7. Geometri & kalite kuralları

- Tüm path'ler **24×24 grid** içinde; kenardan en az ~2px nefes payı.
- Optik denge: ikon görsel olarak ortalanır (matematiksel değil, optik merkez).
- Köşeler tutarlı yuvarlaklıkta; keskin uç bırakma (round cap zaten zorunlu).
- Gereksiz nokta/path yok — minimum çizgiyle maksimum okunabilirlik.
- 16px'te bile net okunmalı (hairline detaylardan kaçın).

## 8. Kabul kriteri (QC checklist)

Bir ikon ancak şunların **hepsi** doğruysa kabul edilir:

- [ ] `viewBox="0 0 24 24"`, `baseProps` kullanılmış
- [ ] stroke-width skalaya uygun (1.6 / 1.7 / 1.8 / 2.0; istisna 3.0 Check)
- [ ] `currentColor` — hard-code renk yok (mercan aksan istisnası hariç)
- [ ] round cap/join
- [ ] 24-grid içinde, taşma yok, optik merkezde
- [ ] `Icon` registry'sine eklenmiş, PascalCase semantik isim
- [ ] 16px ve 20px render'da net okunuyor
