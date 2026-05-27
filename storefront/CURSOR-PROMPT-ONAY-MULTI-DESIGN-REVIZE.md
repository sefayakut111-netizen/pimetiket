`src/app/onay/[orderId]/page.tsx` dosyasını oku ve aşağıdaki 3 değişikliği yap:

## 1. Multi-design tasarımlar sol sidebar'da büyük kartlar olarak gösterilsin

Şu an sol sidebar'da 1 ürün kartı var, altında küçük rakam butonları (1✓ 2⏳ 3⏳ 4⏳). Bu YANLIŞ.

Doğrusu: her tasarım kendi kartında, ana ürün kartıyla aynı boyutta gösterilmeli. Yani 4 tasarımlı sipariş = sol sidebar'da 4 ayrı kart. Her kart:
- Tasarımın thumbnail önizlemesi (varsa cutline preview, yoksa design preview)
- "Tasarım 1", "Tasarım 2" başlığı
- Status badge (onay bekleniyor / onaylandı / düzenleniyor)
- Tıklayınca sağ panelde o tasarımın bıçak önizlemesi gösterilsin

Her kart, mevcut item kartıyla aynı stilde olmalı (aynı border, padding, seçili durumda mercan border). Seçili tasarım vurgulanmalı.

Mevcut küçük rakam butonları (1✓ 2⏳) kaldırılsın.

## 2. Her tasarım tek tek onaylanabilsin

Sağ panelde her tasarım için ayrı "Bu tasarımı onayla" butonu olmalı. Mevcut "Bu ürünü onayla" butonu TEK tasarımı onaylasın (activeDesignFileId bazlı).

Onaylanan tasarımın sol sidebar kartında yeşil tik + "Onaylandı" badge gösterilsin. Kart hafif opak olsun (opacity-70).

## 3. Tüm tasarımlar onaylandıktan sonra "Tümünü Onayla" butonu

En altta (action bar altında veya ayrı bir sticky bar) büyük bir "Tüm Tasarımları Onayla ve Üretime Gönder" butonu olsun.

Bu buton:
- Tüm tasarımlar tek tek onaylanmadan DISABLED olmalı (gri, tıklanamaz)
- Tüm tasarımlar onaylandığında AKTİF olmalı (yeşil, büyük)
- Tıklayınca `finalizeProof` çağrısın ve `/onay/[orderId]/tamamlandi`'ya yönlendirsin
- Disabled durumda altında "Önce tüm tasarımları tek tek onayla" yazısı gösterilsin

Örnek layout:

```
SOL SIDEBAR                          SAĞ PANEL
┌──────────────────────┐    ┌──────────────────────────────┐
│ [🖼️] Tasarım 1      │    │ Bıçak  Tasarım  Zemin  CMYK │
│ ✅ Onaylandı         │    │                              │
├──────────────────────┤    │  [Bıçak önizleme - Tasarım 2]│
│ [🖼️] Tasarım 2  ◀── │    │                              │
│ 🔵 İnceleniyor       │    │                              │
├──────────────────────┤    ├──────────────────────────────┤
│ [🖼️] Tasarım 3      │    │ Yardım iste  Düzenle  Onayla │
│ ⏳ Bıçak hazırlanıyor │    └──────────────────────────────┘
├──────────────────────┤
│ [🖼️] Tasarım 4      │
│ ⏳ Bıçak hazırlanıyor │
└──────────────────────┘

═══════════════════════════════════════════════════════
│  ✅ Tüm Tasarımları Onayla ve Üretime Gönder       │  ← tüm tasarımlar onaylanınca aktif
═══════════════════════════════════════════════════════
```

## Teknik notlar

- `activeDesignFileId` state'i zaten var — sol sidebar kartına tıklayınca bunu set et
- Her tasarım kartı için `designs[]` array'inden `design_file_id`, `file_name`, `cutline` bilgisi al
- Onay durumu: `cutline` varsa ve `proof_status` kontrol et
- `handleApprove` fonksiyonu `cutlineId` ile çağrılıyor — her tasarım için ayrı cutline ID gönder
- `finalizeProof` fonksiyonu zaten var — tüm tasarımlar onaylanınca çağır

Her fix sonrası `npx tsc --noEmit` + commit yap.

## Sonrasında

Tüm değişiklikleri tamamladıktan sonra `/onay` sayfasının tüm kodunu baştan sona kontrol et:
- TypeScript hata yok mu?
- Multi-design akışı doğru çalışıyor mu?
- Tek tasarımlı siparişler bozulmamış mı?
- Responsive düzgün mü?
- Edge case'ler (0 tasarım, 1 tasarım, 5+ tasarım) düzgün mü?

Sorun bulursan düzelt, commit yap.
