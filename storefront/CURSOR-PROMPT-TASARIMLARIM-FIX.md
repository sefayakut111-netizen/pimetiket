`src/app/tasarimlarim/page.tsx` dosyasını oku ve şu düzeltmeleri yap:

## 1. Multi-design siparişlerde her tasarım ayrı kart olsun

Şu an bir sipariş 4 tasarımlıysa tek kart gösteriliyor "(4 tasarım)" yazıyla. YANLIŞ.

Doğrusu: her design_file ayrı bir kart olarak gösterilmeli. Yani 4 tasarımlı sipariş = 4 ayrı kart.

Her kart:
- Tasarımın kendi önizlemesi (design_files'dan)
- Dosya adı (original_name)
- Dosya boyutu + tarih
- Hangi siparişe ait (sipariş numarası küçük yazıyla)
- Ürün bilgisi (Sticker · Opak Folyo + Yok)
- Konfigürasyon bilgisi (Kontur kesim · 80×100mm · Die-cut)
- Status badge (İnceleniyor / QC geçti / Onaylandı / Üretimde)

Veri kaynağı: mevcut API'den `design_files` tablosunu sorgula. Her design_file row'u bir kart. Aynı order_id'ye sahip design_files gruplama yapabilirsin ama HER dosya ayrı kart.

## 2. Her karta 3 buton ekle

Mevcut: "Yeniden bastır" + "Sipariş →" (2 buton)

Yeni: 3 buton yan yana, eşit genişlikte:

```
[⬇ İndir] [✨ Yeniden bastır] [📋 Sipariş →]
```

- **İndir**: Tasarım dosyasının orijinalini indir. `/api/orders/[orderId]/items/[itemId]/design-file` endpoint'inden download. `<a href="..." download>` kullan.
- **Yeniden bastır**: Mevcut davranış — konfigüratöre yönlendir (reorder)
- **Sipariş →**: Sipariş detay sayfasına git `/siparis/[orderId]`

3 buton aynı satırda, eşit genişlikte grid olsun:
```tsx
<div className="grid grid-cols-3 gap-2 mt-3">
  <a href={downloadUrl} download className="...">İndir</a>
  <Button size="sm" href={reorderUrl}>Yeniden Bastır</Button>
  <Button size="sm" variant="ghost" href={`/siparis/${orderId}`}>Sipariş</Button>
</div>
```

## 3. Sayfa başlığı ve alt metin

Mevcut: "28 tasarım yüklendi — yeniden bastırmak için tek tıkla."
Bu sayı `design_files` sayısı olmalı (sipariş sayısı değil). Her dosya ayrı sayılmalı.

Her fix sonrası `npx tsc --noEmit` + commit yap.
