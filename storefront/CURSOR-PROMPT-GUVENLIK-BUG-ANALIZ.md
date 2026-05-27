Tum sistemi guvenlik acigi ve bug icin analiz et. Emoji kullanma. Her baslik icin ilgili dosyalari oku, sorun bul, duzelt, commit yap.

---

# BASLIK 1: AUTH + OTURUM GUVENLIGI

Dosyalar:
- `src/middleware.ts`
- `src/app/auth/page.tsx` + ilgili auth sayfalari
- `src/lib/supabase/server.ts` + `admin.ts` + `client.ts`
- `src/app/api/auth/` (tum endpoint'ler)

Kontrol:
- Middleware hassas path'leri dogru koruyor mu? (/admin/*, /partner/*, /api/admin/*)
- Auth olmadan erisilen endpoint var mi?
- Session token HttpOnly cookie'de mi?
- CSRF korumasi var mi?
- Rate limiting: login, OTP, sifre sifirlama endpoint'lerinde var mi?
- Brute force korumasi: ardisik basarisiz giris denemesi engelleniyor mu?
- Magic link / OTP token suresi makul mu (10dk vs 24 saat)?
- Sifre degistirmede eski sifre dogrulaniyormu?
- Admin 2FA bypass edilebilir mi?
- Session timeout var mi (24 saat, 7 gun)?

---

# BASLIK 2: API ENDPOINT GUVENLIGI

Dosyalar:
- `src/app/api/admin/` (rastgele 20 endpoint sec)
- `src/app/api/orders/` (tum endpoint'ler)
- `src/app/api/payment/` (callback, init, refund)
- `src/app/api/design/` (upload-init, upload-complete)
- `src/app/api/customer/` (tum endpoint'ler)
- `src/app/api/partner/` (tum endpoint'ler)
- `src/app/api/pim/` (chat, feedback)
- `src/app/api/cron/` (tum endpoint'ler)

Kontrol:
- Her admin endpoint'te `assertAdmin()` veya `assertPermission()` var mi?
- Her customer endpoint'te auth + sahiplik (ownership) kontrolu var mi?
- Partner endpoint'lerde partner_id dogrulama var mi?
- Cron endpoint'lerde `CRON_SECRET` kontrolu var mi?
- Payment callback'te hash dogrulama var mi?
- IDOR acigi: baska kullanicinin verisine erisim mumkun mu? (order_id, user_id filtreleri)
- SQL injection riski: raw query var mi? (Supabase client kullaniliyorsa dusuk risk)
- Request body validation: zod/yup schema var mi? Eksik validation?
- File upload: magic-byte kontrolu var mi? Max boyut limiti?
- Rate limiting: kritik endpoint'lerde (payment, upload, chat) var mi?

---

# BASLIK 3: XSS + INJECTION

Dosyalar:
- `src/components/pim/PimChat.tsx` — kullanici girdisi render
- `src/app/admin/` — form input'lari
- Tum `dangerouslySetInnerHTML` kullanimlari
- Tum `<img src={userInput}>` kullanimlari

Kontrol:
- Kullanici girdisi escape edilmeden HTML'e yaziliyor mu?
- `dangerouslySetInnerHTML` kullanilan yer var mi? Varsa input sanitize ediliyor mu?
- Markdown render (PimChat renderMessageText) XSS'e acik mi?
- URL parametreleri (searchParams) direkt render ediliyor mu?
- `<img src={previewUrl}>` — signed URL disinda kullanici kontrollu URL var mi?
- Admin formlarinda HTML injection riski var mi?

---

# BASLIK 4: KVKK + VERI GUVENLIGI

Dosyalar:
- `src/lib/pim/memory.ts` — localStorage'da kisisel veri
- `src/lib/pim/chat-consent.ts` — KVKK riza
- `src/app/api/customer/notifications/route.ts`
- `src/app/api/admin/customers/` — musteri verileri
- `supabase/migrations/` — RLS policy'leri

Kontrol:
- Musteri kisisel verileri (ad, adres, TC, telefon) sadece yetkili erisiyor mu?
- Partner musteri fiyatlarini goruyor mu? (goremez kurali)
- RLS policy'leri dogru mu? Partner sadece kendi siparislerini gorebiliyor mu?
- localStorage'da hassas veri (token, TC, kart no) saklaniyormu?
- CSV/JSON export'larda kisisel veri var mi? Auth kontrollu mu?
- Audit log'da kisisel veri maskeleniyor mu?
- Silinen siparis/musteri verileri gercekten siliniyor mu (KVKK m.7)?

---

# BASLIK 5: ODEME GUVENLIGI

Dosyalar:
- `src/app/api/payment/init/route.ts`
- `src/app/api/payment/callback/route.ts`
- `src/app/api/payment/refund/route.ts`
- `src/app/odeme/page.tsx`
- `src/lib/payment-validation.ts`

Kontrol:
- Payment callback hash dogrulama tamam mi? (PayTR HMAC)
- Tutar manipulasyonu: client taraftan gelen tutar server'da yeniden hesaplaniyor mu?
- Replay attack: ayni callback birden fazla isleniyor mu? Idempotency key var mi?
- Admin bypass: production'da devre disi mi?
- Refund endpoint: yetki kontrolu var mi? Cift iade riski var mi?
- Kart bilgisi server'da saklanmiyor mu? (PCI-DSS)
- PayTR iframe guvenli mi? (sandbox vs production flag)

---

# BASLIK 6: STORAGE + DOSYA GUVENLIGI

Dosyalar:
- `src/app/api/design/upload-init/route.ts`
- `src/app/api/design/upload-complete/route.ts`
- `src/lib/storage/` (tum dosyalar)
- Supabase Storage policy'leri

Kontrol:
- Dosya boyut limiti enforced mi (30MB)?
- Magic-byte MIME dogrulama calisiyor mu?
- Zarli dosya turleri engelleniyor mu? (.exe, .sh, .bat, .php)
- Signed URL suresi makul mu (5dk)?
- Baska kullanicinin dosyasina erismek mumkun mu?
- Storage bucket RLS policy'leri dogru mu?
- Path traversal riski: dosya adi `../../etc/passwd` olabilir mi?

---

# BASLIK 7: BUG TARAMASI

Tum projeyi tara:

```bash
npx tsc --noEmit 2>&1 | head -50
```

Ek kontroller:
- `console.log` debug satirlari kalmis mi? (production'da bilgi sizintisi)
- `any` type kullanimi var mi? (runtime crash riski)
- Undefined/null access (optional chaining eksik) var mi?
- Promise rejection yakalanmamis (unhandled) var mi?
- Memory leak riski: useEffect cleanup eksik mi?
- Sonsuz render dongusu riski: useEffect dependency hatasi?
- Race condition: ayni anda 2 islem ayni veriyi degistirebilir mi?

---

# CIKTI

Her baslik icin:
```
BASLIK X: Y sorun bulundu (Z kritik, W onemli), N duzeltildi
- [KRITIK] Sorun: ... → Fix: ...
- [ONEMLI] Sorun: ... → Fix: ...
```

Kritik guvenlik aciklari HEMEN duzelt.
Onemli bug'lar duzelt.
Dusuk riskli uyarilar listele ama duzeltmeyebilirsin.

Her fix sonrasi: `npx tsc --noEmit` + commit (`fix(security):` veya `fix(bug):` prefix)
