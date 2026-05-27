Admin paneli yonetim bolumu — 9 fix. Emoji kullanma. Bu session'da sadece Cursor kod yaziyor.

---

## FIX 1 — Odemeler musteri kolonu bos (KRITIK)

`/admin/odemeler` sayfasinda 14 islemin hepsinde MUSTERI kolonu "—" gosteriyor.

Sorun: payments tablosu orders tablosuyla JOIN yapilamiyor veya user bilgisi cekilmiyor.

Debug:
1. Odemeler sayfasinin API endpoint'ini bul
2. Query'de payments → orders → profiles JOIN'ini kontrol et
3. `payment_intents` tablosunda `order_id` veya `user_id` var mi kontrol et
4. JOIN'i duzelt — her odeme satirinda musteri adi gorunmeli

```sql
-- Beklenen join:
SELECT pi.*, o.user_id, p.display_name
FROM payment_intents pi
LEFT JOIN orders o ON o.id = pi.order_id
LEFT JOIN profiles p ON p.id = o.user_id
```

---

## FIX 2 — Odemeler ve Finans rakam tutarsizligi (KRITIK)

Odemeler: 34.541 TL / Finans (Bu ay): 64.559 TL — ayni donem icin 30K fark.

Iki sayfa farkli veri kaynagi kullaniyor olabilir:
- Odemeler: `payment_intents` tablosu (sadece PayTR basarili islemler)
- Finans: `orders` tablosu (siparis tutarlari toplami — iptal dahil?)

Cozum: Iki sayfanin da ayni kaynaktan hesaplamasini sagla. Finans'ta:
- "Brut siparis tutari" = orders toplami
- "Tahsil edilen" = payment_intents (status=consumed) toplami
- Fark = iptal + iade + bekleyen

Iki rakam birbirini tutmali veya fark aciklanmali.

---

## FIX 3 — Kupon checkout entegrasyonu

`/odeme` sayfasinda kupon input alani var mi kontrol et. "Faz 2'de eklenecek" notu varsa:

1. Odeme sayfasinda kupon kodu input alani ekle (zaten `couponCode` state varsa aktif et)
2. `/api/customer/validate-coupon` endpoint'i cagir
3. Gecerli kupon → indirim uygula, ozete yansit
4. Gecersiz → hata mesaji

Mevcut kupon sistemi (`/admin/kuponlar`) calisiyorsa backend hazir demek — sadece frontend entegrasyonu eksik.

NOT: Eger `/odeme` sayfasinda zaten kupon alani varsa ama gizlenmisse, gizlemeyi kaldir.

---

## FIX 4 — Finans test verisi filtresi

Finans sayfasinda "Admin Test" siparisleri metriklere dahil.

Dashboard/Siparisler'deki `isTestOrderLike` filtresini Finans sorgularina da uygula:
- Ciro KPI'lari
- Top musteriler
- Donem bazli grafikler

Test toggle ekle: "(X test siparisi gizli) [Test siparislerini goster]"

---

## FIX 5 — Operasyon rolu finans yetkisi kisitla

RBAC matrisinde Operasyon rolu "finans (sadece goruntuleme)" yetkisine sahip. Gereksiz — KVKK need-to-know ilkesine aykiri.

`src/lib/rbac.ts` veya yetki tanimlama dosyasinda Operasyon rolunden finans yetkisini kaldir:

```typescript
// Eski:
operation: ["orders", "fason", "shipping", "finance_read"]

// Yeni:
operation: ["orders", "fason", "shipping"]
```

Finans sayfalarina erisim sadece admin ve accountant rollerine acik kalmali.

---

## FIX 6 — Calisan davet akisi + kaldirma guard

### 6a. Calisan kaldirma confirm modal
"Kaldir" butonuna tiklaninca confirm modal cikmali. Tek super admin kaldirilmaya calisilirsa ENGELLE:

```typescript
const isSoleAdmin = admins.filter(a => a.role === "super_admin").length === 1;
const isRemovingSelf = targetUserId === currentUserId;

if (isSoleAdmin && target.role === "super_admin") {
  toast.error("Tek super admin kaldirilamaz.");
  return;
}

// Confirm modal:
// "Bu calisani kaldirmak istediginizden emin misiniz?"
// [Iptal] [Kaldir]
```

### 6b. Davet notu
Mevcut "once hesap acsin" akisi guvenlik riski. Sayfa ustune uyari ekle:

```tsx
<p className="text-sm text-sari-koyu bg-sari-soft/30 rounded-lg p-3 mb-4">
  Calisan eklemek icin: kisi /auth'tan hesap acar, sonra burada rolunu atarsiniz.
  Token bazli davet sistemi yakin zamanda eklenecek.
</p>
```

---

## FIX 7 — Kupon "En populer" KPI duzelt

Tum kuponlar 0 kullanim ama "EN POPULER KUPON: REPRINT-2BOW05" yaziyor.

0 kullanim varken "Henuz kullanim yok" goster:

```typescript
const mostUsed = coupons.sort((a, b) => b.usageCount - a.usageCount)[0];

if (!mostUsed || mostUsed.usageCount === 0) {
  return "Henuz kullanim yok";
}
return `${mostUsed.code} (${mostUsed.usageCount} kullanim)`;
```

---

## FIX 8 — Odemeler "Islem" kolonu aksiyonlar

Odemeler tablosunda "Islem" kolonu sadece "paytr" yaziyor. Aksiyon butonlari ekle:

```tsx
// Her satir icin:
<td className="flex gap-1">
  <Button size="xs" variant="ghost" href={`/admin/siparisler/${orderId}`}>
    Siparis
  </Button>
  <Button size="xs" variant="ghost" onClick={() => copyToClipboard(paytrRef)}>
    Ref kopyala
  </Button>
</td>
```

---

## FIX 9 — Calisan "Son giris" guncelleme

"Son giris: 8 gun once" yaziyor ama Sefa bugun giris yapmis.

`profiles.last_sign_in_at` Supabase auth'tan otomatik gelmiyorsa, login callback'te guncelle:

```typescript
// Auth callback veya middleware'de:
await admin.from("profiles")
  .update({ last_sign_in_at: new Date().toISOString() })
  .eq("id", user.id);
```

Veya Supabase auth.users tablosundaki `last_sign_in_at` alanini kullan (profiles yerine).

---

## KONTROL

Her fix sonrasi: `npx tsc --noEmit` + commit (`fix(admin):` prefix)

Test:
1. /admin/odemeler — musteri kolonu dolu mu?
2. Odemeler toplam ↔ Finans toplam tutarli mi?
3. /odeme sayfasinda kupon girilebiliyor mu?
4. Finans'ta test verisi filtrelenmis mi?
5. Operasyon roluyle /admin/finans erisim engelleniyor mu?
6. Tek admin kaldirma engelleniyor mu?
7. Kupon "En populer" 0 kulanimda "Henuz yok" mu?
