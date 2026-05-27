`src/app/admin/page.tsx` dosyasini oku ve tum emoji kullanımlarini temizle.

## KURAL

- Emoji YASAK — hic bir yerde emoji kullanma
- Ikon gerekiyorsa mevcut `Icon` componentini kullan (`src/components/Icon.tsx`)
- Icon yoksa basit bir SVG inline ikon kullan
- Dekoratif emoji (baslik, kart, badge, buton) tamamen KALDIR
- Status gostergesi icin renkli dot (●) veya Icon kullan

## YAPILACAK

Dosyadaki tum emoji'leri bul ve degistir:

| Emoji | Nereye | Degisiklik |
|-------|--------|------------|
| 📊 📈 📉 | Kart basliklar | KALDIR, sadece metin birak |
| 🎯 | Hedef/KPI | KALDIR |
| 📦 🚚 | Siparis/kargo | `<Icon.Package />` veya `<Icon.Truck />` kullan |
| ⚠️ 🔴 🟡 🟢 | Status/uyari | Renkli dot (`<span className="w-2 h-2 rounded-full bg-kirmizi" />`) kullan |
| 💰 | Finans | KALDIR |
| 🎉 | Basari | KALDIR |
| 📋 📁 | Dosya/liste | `<Icon.Doc />` veya `<Icon.List />` kullan |
| 🔔 | Bildirim | `<Icon.Bell />` kullan |
| 👥 | Musteri | `<Icon.Users />` kullan |
| ✅ ❌ | Onay/red | `<Icon.Check />` veya renkli dot kullan |
| 📚 | Egitim | KALDIR |
| 🏭 | Uretim | KALDIR, metin yeterli |
| 💳 | Odeme | KALDIR |

## ONEMLI

- Sadece `src/app/admin/page.tsx` degil, admin altindaki TUM sayfalari da kontrol et
- `src/app/admin/**/*.tsx` dosyalarinda emoji ara
- `grep -rn "[\x{1F300}-\x{1F9FF}]" src/app/admin/` ile bul
- Her emoji'yi ya kaldir ya Icon/SVG ile degistir
- Bos birakma — emoji kaldirinca baslik/etiket anlamsiz kalmasin

`npx tsc --noEmit` + commit (`fix(admin): emoji temizligi, SVG ikon gecisi`).
