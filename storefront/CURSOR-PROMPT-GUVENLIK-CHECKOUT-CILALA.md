# Güvenlik checkout+auth sertleştirme — review cilası (commit öncesi)

> Commit'siz güvenlik P0/P1 işini (server-side total/coupon/shipping doğrulama, open-redirect guard,
> MFA fail-closed, şifre-sıfırlama PKCE, cart merge) Claude review etti. İş sağlam; commit ÖNCESİ
> 1 kritik + 3 ufak düzeltme. Sırayla uygula. **Migration / prod DB'ye DOKUNMA.** `tsc --noEmit` temiz kalmalı.
> Var olan davranışı koru; yalnız aşağıdaki noktalara dokun.

---

## GÖREV 1/4 — 🔴 MFA fail-closed sonsuz döngü guard'ı (sole-admin kilitlenme)

`src/lib/supabase/middleware.ts` — admin MFA `catch` bloğu (≈L336-342) fail-closed olup
`/auth/mfa-challenge`'a yönlendiriyor. Ama hemen üstündeki (B) bloğunun aksine `/admin/profil` ve
`/admin/ayarlar/2fa` istisnalarını İÇERMİYOR. `getAuthenticatorAssuranceLevel()` ısrarla throw ederse:
`/admin/X → catch → /auth/mfa-challenge → (TOTP yok) → /admin/profil?force_2fa=1 → /admin/profil de
/admin altında → catch → ... SONSUZ DÖNGÜ` → tek admin (Sefa) /admin'den tamamen kilitlenir.

**Yapılacak:** `catch` bloğunu, (B) bloğuyla simetrik şekilde kurtarma/enroll sayfalarını dışarıda
bırakacak biçimde güncelle:

```ts
} catch {
  // MFA kontrolü başarısız — fail-closed. AMA kurtarma/enroll sayfaları erişilebilir
  // kalmalı; yoksa /admin/profil → mfa-challenge → /admin/profil sonsuz döngü (sole-admin lockout).
  if (
    !pathname.startsWith("/admin/profil") &&
    !pathname.startsWith("/admin/ayarlar/2fa")
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/mfa-challenge";
    redirectUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }
  // İstisna sayfalar → akışın devamına bırak (admin 2FA kurabilsin / profile erişebilsin)
}
```

**Doğrulama:** getAAL throw senaryosunda `/admin/profil` ve `/admin/ayarlar/2fa` erişilebilir kalır
(döngü yok); diğer tüm `/admin/*` yolları mfa-challenge'a gider (fail-closed korunur).

---

## GÖREV 2/4 — 🟢 payment/init: ölü 3. kargo kontrolünü kaldır

`src/app/api/payment/init/route.ts` — kargo iki kez kontrol ediliyor. İlk kontrol gerçek korumayı
yapıyor (`expectedClientShipping = couponKind==='free_ship' ? 0 : serverShipping` vs `body.shipping`).
Son blok (`total_mismatch` kontrolünden SONRA gelen) ise:

```ts
if (Math.abs(checkoutTotals.effectiveShipping - body.shipping) > 0.05) {
  return NextResponse.json(
    { error: "shipping_mismatch", expected: checkoutTotals.effectiveShipping },
    { status: 400 }
  );
}
```

ölü koddur: `computeCheckoutTotals` non-free-ship'te `effectiveShipping = body.shipping` döner
→ fark hep 0; free-ship'te ise ilk kontrol zaten `body.shipping === 0` şartını koymuştur.
**Bu son bloğu sil.** İlk kargo kontrolü + total kontrolü korumayı tam sağlıyor.

**Doğrulama:** Normal sipariş, free-ship kuponu ve hatalı kargo gönderen sahte istek — üçü de
GÖREV 2 öncesiyle aynı sonucu verir (geçer/geçer/`shipping_mismatch`).

---

## GÖREV 3/4 — 🟢 customer-cart.ts girinti düzeltmesi

`src/lib/customer-cart.ts` `mergeGuestCartIntoDb` içinde `const match = dbItems.find(...)` sonrası
`        if (match) {` satırının girintisi kaymış (fazladan boşluk). Çevre koda uygun girintiye çek.
Davranış değişmez; yalnız formatlama.

---

## GÖREV 4/4 — 🟢 Kupon kaydında gerçek çekilen tutarı yaz (audit doğruluğu)

`src/app/api/payment/callback/route.ts` + `src/lib/payment/coupon-server.ts`:
`applyCouponAfterOrder` şu an `discount_amount`'ı coupon satırından **yeniden hesaplıyor**. Init ile
callback arasında admin kuponu düzenlerse, kayıtlı indirim müşteriden gerçekten çekilen tutardan
(snapshot'taki `couponDiscount`) sapabilir.

**Yapılacak:** `applyCouponAfterOrder` params'ına opsiyonel `chargedDiscount?: number` ekle; verildiyse
`coupon_uses.discount_amount` olarak BUNU kullan (limit kontrolleri aynen kalsın — onlar coupon
satırından devam etsin, yalnız KAYDA yazılan tutar snapshot'tan gelsin). Callback'te
`chargedDiscount: intent.snapshot.couponDiscount ?? undefined` geçir. Snapshot'ta yoksa eski
davranış (yeniden hesap) fallback olsun. `kind === 'free_ship'` için indirim 0 kalır.

**Doğrulama:** Normal kupon siparişi → `coupon_uses.discount_amount`, kullanıcıdan çekilen indirimle
birebir aynı. Snapshot'ta couponDiscount yoksa kod çökmeden eski hesaba düşer.

---

## GENEL DOĞRULAMA
1. `tsc --noEmit` temiz.
2. MFA throw senaryosunda admin /admin/profil ile 2FA kurup kurtulabilir (döngü yok); diğer admin yolları fail-closed.
3. Checkout fiyat/kupon/kargo/toplam doğrulaması GÖREV öncesiyle aynı güçte (server-side koruma bozulmadı).
4. Kupon kaydı gerçek çekilen tutarı yansıtır.
5. Migration yok; prod DB değişmedi. Editör akışı (/editor, /onay, /duzenle) bu pas'tan etkilenmedi.

## DEĞİŞECEK DOSYALAR
`src/lib/supabase/middleware.ts` (Görev 1),
`src/app/api/payment/init/route.ts` (Görev 2),
`src/lib/customer-cart.ts` (Görev 3),
`src/app/api/payment/callback/route.ts` + `src/lib/payment/coupon-server.ts` (Görev 4).
