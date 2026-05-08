# Pim Mascot Asset'leri

Bu klasör profesyonel illüstratör çıktısı Pim baykuş varyasyonlarını içerir.

## Beklenen dosyalar

| Dosya | Kullanım |
|---|---|
| `pim-detailed.png` (veya .svg) | Hero, Bottom CTA, marketing visualler. **Tam karakter:** açık önlük + 2 cep + ear tufts + pençeler |
| `pim-simplified.png` (veya .svg) | Logo placement: sayfa içi marker, kartlar. **Sadece kuş** (önlüksüz, magnifiersız) |
| `pim-icon.png` (veya .svg) | Favicon, küçük avatar (32-64px). **Sadece kafa + gözlük + gaga** |
| `pim-horizontal-lockup.svg` | TopBar wordmark, header'lar. Simplified mark + "pim etiket" yazı |
| `pim-vertical-lockup.svg` | Vertical contexts (footer brand, mobile menu) |
| `pim-single-color.svg` | Damga, embroidery, single-color print. Coral OR siyah silüet |

## Kanonik kaynak

`docs/brand/PIM_MASCOT_BRIEF.md` — karakter spec'i.

## Format tercihi

- **SVG (öncelikli)**: scalable, küçük dosya, render kalitesi yüksek
- **PNG fallback**: transparent background, 2x retina (mascot-detailed-2x.png)

Şu an `Pim.tsx` component'i hâlâ inline SVG kullanıyor (placeholder). Bu klasöre
profesyonel asset'ler kaydedildikten sonra `Pim.tsx` `<Image>` veya `<img>` ile
bu dosyaları kullanacak şekilde güncellenir.
