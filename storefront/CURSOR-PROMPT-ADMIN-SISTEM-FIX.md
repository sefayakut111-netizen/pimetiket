Admin paneli sistem bolumu — 9 fix + Sefa'nin yapacaklari. Emoji kullanma. Bu session'da sadece Cursor kod yaziyor.

---

## FIX 1 — Ayarlar formu DB'den deger cekmiyor (KRITIK)

`/admin/ayarlar` sayfasinda KDV disinda tum sayisal alanlar bos gosteriliyor (kargo ucreti, ucretsiz esik, min/max siparis, hosgeldin/referans ceki, teslim sureleri). Audit log'da "Site ayarlari guncellendi" kaydi var — DB'de deger var ama form GET'te cekilmiyor.

Debug:
1. `src/app/admin/ayarlar/page.tsx` dosyasini oku
2. Ayarlar API endpoint'ini bul (muhtemelen `/api/admin/settings` GET)
3. API'nin dondugu JSON'u kontrol et — degerler var mi?
4. Form state'inin API'den doldurulan initial values'ini kontrol et
5. Sorun bulunca duzelt — form acildiginda DB'deki mevcut degerler gelmeli
6. ONEMLI: Bos form kaydet basilirsa 0 yazilmasin — degismeyen alanlari gonderme veya backend'de 0 guard ekle

---

## FIX 2 — Sifre degistirme eski sifre alani ekle (GUVENLIK)

`/admin/profil` sayfasinda sifre degistirme formunda "Yeni sifre" + "Tekrar" var ama "Mevcut sifre" alani yok.

Ekle:
```tsx
<Input type="password" label="Mevcut sifre" required />
<Input type="password" label="Yeni sifre" required />
<Input type="password" label="Yeni sifre tekrar" required />
```

Backend'de mevcut sifreyi dogrula (Supabase auth.signInWithPassword ile) — eslesmezse red.

---

## FIX 3 — Sistem menusu 404 duzelt

Sol menude "Denetciler" linki `/admin/sistem/denetciler` adresine gidiyor → 404.

`src/components/layout/AdminShell.tsx` dosyasinda link'i duzelt:
```
Eski: /admin/sistem/denetciler
Yeni: /admin/denetciler
```

Tum sistem alt menusundeki linkleri kontrol et — hangisi 404 veriyor?

---

## FIX 4 — Audit log filtre + donem ekleme

`/admin/denetim-kaydi` sayfasinda sadece arama kutusu var. 44 kayittan 30'u ayni tip (telif taahut).

Ekle:
1. Aksiyon tipi filtresi: "Tumü / Ayar degisikligi / Siparis / KVKK / Giris/Cikis / Telif"
2. Tarih araligi: son 7 gun / 30 gun / 90 gun / tum zamanlar
3. Kullanici filtresi (admin dropdown)

Telif taahut kayitlari cok fazla — "Telif" tipini varsayilan olarak gizle veya grupla:
```
"30 telif taahut onay kaydi (gruplandı)" — tikla genislet
```

---

## FIX 5 — Cron "Calistir" butonu confirm modal

`/admin/cron-izleme` sayfasinda auto-refund, archive-inactive gibi mali etkili cron'lar tek tikla tetikleniyor.

Confirm modal ekle:
```tsx
// Calistir tiklaninca:
// "Bu cron'u manuel tetiklemek istediginizden emin misiniz?
//  auto-refund: 36 saatten eski prova siparislerini otomatik iptal eder."
// [Iptal] [Calistir]
```

Ozellikle auto-refund ve archive-inactive icin uyari mesaji net olmali.

---

## FIX 6 — Denetciler sayi tutarsizligi

Hero banner "5 aksiyon bekliyor" ama kart uyarilari toplami 4 (Is Akisi 2 + Musteri 1 + SEO 1).

Toplam hesaplamasini kontrol et — kartlardaki uyari sayilarinin gercek toplami ne ise banner'da o gosterilsin.

---

## FIX 7 — Fiyat yonetimi operasyon toggle tutarsizligi

Operasyon bolumu "Devre disi" rozetinde ama canli simulasyon "Setup 50₺ / Paketleme 3₺" gosteriyor.

Toggle `operation.enabled = false` ise simulasyonda da bu kalemleri 0 olarak hesapla. Eger deger kullaniliyorsa toggle "Aktif" gostermeli.

Kontrol et:
1. Toggle state DB'ye kaydediliyor mu?
2. `calculatePrice()` fonksiyonu `operation.enabled` kontrolu yapiyor mu?
3. Tutarsizligi duzelt — toggle kapali = hesaplamada da kapali

---

## FIX 8 — Ayarlar "Varsayilana sifirla" confirm modal

Tek tikla KDV, kargo, cek miktarlari gibi kritik degerleri sifirlayan buton. Confirm modal ekle:

```
"Tum ayarlari varsayilan degerlere dondurmek istediginizden emin misiniz?
 Bu islem geri alinamaz."
[Iptal] [Sifirla]
```

---

## FIX 9 — Cron hata mesaji tam goster

Cron tablosunda hata mesaji kesik gosteriliyor. Satira tiklamadan tam hata gorunmuyor.

Her hata satirinda mesajin ilk 100 karakterini goster:
```tsx
{cron.error && (
  <p className="text-xs text-kirmizi mt-1 truncate max-w-md" title={cron.error}>
    {cron.error}
  </p>
)}
```

---

## SEFA'NIN YAPACAKLARI (kod degil — env/config)

### S10 — R2 yedekler secret key yenile
Cloudflare Dashboard → R2 → API Tokens → yeni token olustur veya mevcut tokeni yenile.
Vercel → Settings → Environment Variables → `R2_SECRET_ACCESS_KEY` guncelle.
Redeploy sonrasi `/admin/yedekler` kontrol et.

### S11 — 3 Cron DB hatasi kontrol
Migration 110 + 111 uygulanmisti. Cron'larin duzeldigi kontrol et:
```
curl -H "Authorization: Bearer $CRON_SECRET" https://pimetiket.com/api/cron/auto-refund
curl -H "Authorization: Bearer $CRON_SECRET" https://pimetiket.com/api/cron/cleanup-stale-uploads
curl -H "Authorization: Bearer $CRON_SECRET" https://pimetiket.com/api/cron/upload-reminders
```
Hala hata veriyorsa Supabase SQL Editor'de fonksiyon/kolon varligini dogrula:
```sql
SELECT proname FROM pg_proc WHERE proname = 'fn_process_proof_pending_sla';
SELECT column_name FROM information_schema.columns WHERE table_name = 'design_files' AND column_name = 'created_at';
SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paid_at';
```

### S12 — R2 arsiv aktif et
Vercel → Environment Variables → `R2_ARCHIVE_DRY_RUN` degerini `false` yap → redeploy.
Bu KVKK m.7 arsivleme gereksinimi icin zorunlu.

### S13 — 2FA backup recovery code
Admin profilde TOTP kayitli ama backup code yok. Supabase Auth'tan recovery code olustur veya backup admin hesabi tanimla.

---

## KONTROL

Her fix sonrasi: `npx tsc --noEmit` + commit (`fix(admin):` prefix)

Test:
1. /admin/ayarlar — form degerleri DB'den geliyor mu?
2. Sifre degistirme eski sifre istiyor mu?
3. Sol menu "Denetciler" 404 vermiyor mu?
4. Audit log filtre/donem calisiyor mu?
5. Cron "Calistir" confirm modal cikmali
6. Fiyat operasyon toggle tutarli mi?
