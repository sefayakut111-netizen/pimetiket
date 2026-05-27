Admin paneli operasyon analizi — 10 fix. Emoji kullanma, SVG ikon kullan. Bu session'da sadece Cursor kod yaziyor.

---

## FIX 1 — Iptal orani kartina drill-down link

Dashboard'daki iptal orani kartina (%19) tiklaninca `/admin/siparisler?status=cancelled` filtresine gitsin. Operatör hangi siparislerin iptal edildigini görsün.

```tsx
<Link href="/admin/siparisler?status=cancelled">
  {/* iptal orani karti */}
</Link>
```

---

## FIX 2 — Cron hata sayisina hover tooltip

Dashboard'daki "Cron 13/16 · 3 hata" yazisina hover ile hangi 3 cron'un patladigini goster:

```tsx
<span title="auto-refund: fn_process_proof_pending_sla yok&#10;cleanup-stale-uploads: created_at kolonu&#10;upload-reminders: paid_at kolonu">
  3 hata
</span>
```

Veya cron health verisinden dinamik tooltip olustur.

---

## FIX 3 — Saatlik yogunluk haritasi esigi dusur

Dashboard'da "50+ siparis sonrasi aktif olacak (30/50)" yaziyor. Esik 50 cok yuksek.

Esigi 20'ye dusur veya esik kontrolunu kaldir — 0 siparis olsa bile haritayi goster (bos hucrelerde "0" gosterir).

---

## FIX 4 — Siparis durum chip'lerine sayi ekle

`/admin/siparisler` sayfasindaki durum filtre chip'leri ve hizli gorunum chip'leri sayi gostermiyor.

```
Eski: [Tasarim bekleniyor] [Musteri onayi bekliyor] [Uretime hazir]
Yeni: [Tasarim bekleniyor (7)] [Musteri onayi bekliyor (2)] [Uretime hazir (2)]
```

Hizli gorunum chip'leri icin de ayni:
```
Eski: [36h+ prova] [Uretime atanmamis]
Yeni: [36h+ prova (2)] [Uretime atanmamis (2)]
```

Sayilari siparis listesinden hesapla.

---

## FIX 5 — Manuel siparis: fiyat bos guard

`/admin/siparis-ekle` sayfasinda birim fiyat alani bosken ozet 850 TL gosteriyor.

- Birim fiyat 0 veya bos iken ozet toplam 0 gostersin
- "Olustur" butonu fiyat girilmeden DISABLED olsun
- TC Kimlik No icin 11 hane + Mod10/Mod11 validasyonu ekle (gecersizse kirmizi uyari)

---

## FIX 6 — Prova SLA alarmi cron durumuna duyarli

`/admin/prova` sayfasinda "SLA ASILDI — otomatik iade tetiklenecek" yaziyor ama cron calismiyorsa bu yanlis.

Cron saglik durumunu kontrol et:
- Cron calisiyor → "SLA asildi — otomatik iade tetiklenecek"
- Cron calismiyor/hata → "SLA asildi — otomatik iade pasif, manuel islem gerekli"

```typescript
const cronHealthy = cronStatus?.autoRefund?.lastSuccess && 
  Date.now() - new Date(cronStatus.autoRefund.lastSuccess).getTime() < 48 * 60 * 60 * 1000;

const slaMessage = cronHealthy 
  ? "SLA asildi — otomatik iade tetiklenecek"
  : "SLA asildi — otomatik iade pasif, manuel islem gerekli";
```

---

## FIX 7 — AI QC bos state son 30 gun ozeti

`/admin/ai-qc` sayfasinda kuyruk temizken sadece egitim metni var. Ustteki KPI alani bos gozukmesin:

```
Son 30 gun: X onay, Y red, Z flag — ort. bekleme X.X saat
```

Mevcut `design_quality_checks` veya `order_events` tablosundan son 30 gun istatistigi cek.

---

## FIX 8 — Manifest indirme KVKK guard

`/admin/siparisler/[id]` siparis detayinda "Baski manifesti indir" butonu partner atanmadan da aktif.

Partner atanmamissa:
- Buton DISABLED
- Tooltip: "Manifest indirmek icin once partner atayin"

```typescript
const hasPartner = order.assignedPartnerId != null;
<Button disabled={!hasPartner} title={!hasPartner ? "Manifest indirmek icin once partner atayin" : undefined}>
  Manifest indir
</Button>
```

---

## FIX 9 — Siparis durumu geri donus kisitlamasi

`/admin/siparisler/[id]` detayda durum guncelleme radio listesinde operatör "Uretime hazir"dan "Tasarim bekleniyor"a geri donebiliyor. State machine butunlugu bozulabilir.

Sadece ileri yonlu gecislere izin ver. Mevcut durumun oncesindeki asamalar DISABLED olsun:

```typescript
const statusOrder = ["awaiting_upload", "qc_pending", "qc_flagged", "human_review", "proof_generating", "proof_pending", "proof_approved", "ready_to_ship", "fason_assigned", "in_production", "shipped", "delivered"];

const currentIndex = statusOrder.indexOf(order.status);

// Sadece currentIndex + 1 ve sonrasi + "cancelled" secilabilir
const isAllowed = (targetStatus) => {
  if (targetStatus === "cancelled") return true;
  const targetIndex = statusOrder.indexOf(targetStatus);
  return targetIndex > currentIndex;
};
```

Geri asamalar gri + tiklanamaz.

---

## FIX 10 — Sol menu badge tooltip

Sidebar'da "Siparisler 27" yaziyor ama liste 16 gosteriyor. Fark: test + iptal filtrelenmis.

Badge'e tooltip ekle:

```tsx
<span title="27 aktif siparis (iptal haric). Liste test siparislerini gizliyor — toggle ile goster.">
  27
</span>
```

---

## KONTROL

Her fix sonrasi: `npx tsc --noEmit` + commit (`fix(admin):` prefix)
