# Akış Denetimi — 5 Doğrulanmış P0 (dosya/fason/arşiv bütünlüğü)

Müşteri dosyası akış denetiminden (1 Haz, 37 ajan, adversaryal doğrulama) **doğrulanmış P0'lar**.
file:line kanıtlı. **Görev 1 EN ACİL — canlıda gerçek müşteri kaybı** (Claude canlıda kod+API ile teyit etti).

> Mimari: `docs/PIM-HAFIZA-V2-MIMARI.md` ayrı iş (Cursor onu yapıyor olabilir — çakışma yok, farklı dosyalar).
> Migration yok (P0'lar kod). Sefa kuralları geçerli: cüzdan/puan yok, partner'a ₺ yok.

---

## GÖREV 1/5 — Multi-design upload TAMAMEN KIRIK 🔴🔴🔴 [data-loss]

#### Dosya: `src/components/ui/MultiDesignDropZone.tsx` (~satır 96-142)

`/etiket/yapilandir`'da kullanılıyor (canlı, ölü kod değil). Component `temp-upload-init`'e **yanlış şema**
gönderiyor → API Zod reddediyor → 400 → çoklu tasarım yükleme **sessizce başarısız** → etiket ek tasarımları
HİÇ kaydedilmiyor.

**3 ayrı uyumsuzluk (hepsi düzeltilecek):**
1. **Request body** (satır 99-101): `{ fileName, mimeType, sizeBytes }` gönderiyor.
   API (`temp-upload-init/route.ts:30-34`) `{ originalName, sizeBytes, mimeType }` bekliyor (`originalName` zorunlu Zod `.min(1)`).
   → `{ originalName: file.name, sizeBytes: file.size, mimeType: file.type }` yap.
2. **mimeType fallback** (satır 101): `"application/octet-stream"` `ALLOWED_MIME_TYPES` içinde değil → 400.
   → Boş MIME'de uzantıdan türet veya dosyayı reddet (DesignDropZone nasıl yapıyorsa aynı).
3. **Response parse** (satır 105-115): `initData.ok/tempId/signedUploadUrl/signedUploadToken` okuyor.
   API `{ uploadUrl, token, storagePath, fileId }` dönüyor.
   → Parse'ı API'nin gerçek response'una göre düzelt; kontrol `!initData.uploadUrl || !initData.fileId`.

> En temizi: **DesignDropZone.tsx**'in (tek dosya, ÇALIŞAN) init→upload→complete akışını referans al, MultiDesignDropZone'u birebir aynı şemaya getir. İkisi aynı API'yi kullanmalı.

**Doğrulama:** `/etiket/yapilandir`'da 2+ tasarım yükle → hepsi başarılı, `design_temp_uploads`'a kaydoluyor, ödeme sonrası promote ediliyor.

---

## GÖREV 2/5 — MultiDesignDropZone magic-byte + DB kaydını atlıyor 🔴 [security]

#### Dosya: `src/components/ui/MultiDesignDropZone.tsx`

`temp-upload-complete` endpoint'i HİÇ çağrılmıyor (DesignDropZone:148-166 çağırıyor). Sonuç: (a) magic-byte
MIME doğrulaması atlanıyor → sahte PDF/PNG (içinde .exe) kabul edilir; (b) `design_temp_uploads` row açılmıyor
→ `promote-temp-designs.ts:153-160` row bulamaz → metaFallback (size=0, taşıma olmaz).

**Fix:** Storage upload'dan sonra `POST /api/design/temp-upload-complete` çağrısı ekle (DesignDropZone:148-166
ile birebir aynı akış). Response'tan `tempId` + `previewUrl` al.

> Görev 1 + 2 aynı dosyada — birlikte yap. Akışı DesignDropZone ile hizalamak ikisini birden çözer.

**Doğrulama:** Multi-design yükleme sonrası `design_temp_uploads`'ta row var; sahte-MIME dosya reddedilir.

---

## GÖREV 3/5 — Fason terminate token iptal etmiyor 🔴 [security]

#### Dosya: `src/app/api/admin/fason/partners/[id]/terminate/route.ts` (~satır 29-37)

Partner sonlandırılınca sadece `fason_partners.active=false, status='terminated'` set ediliyor.
`fason_access_tokens.revoked_at` dokunulmuyor → sonlandırılmış partnerin eski token'ı HÂLÂ geçerli →
müşteri dosyalarına erişim sürüyor.

**Fix:** Partner update'inden sonra ekle:
```ts
await admin.from("fason_access_tokens")
  .update({ revoked_at: new Date().toISOString() })
  .eq("fason_partner_id", id)
  .is("revoked_at", null);
```
(`pause` route'una da aynısı mantıklı — pasif partnere de erişim kesilsin; Sefa onayıyla.)

**Doğrulama:** Partner terminate → eski token ile `/api/fason/download/[token]` 403/revoked döner.

---

## GÖREV 4/5 — restoreCustomerToHot design_files'ı güncellemiyor 🔴 [data-loss]

#### Dosya: `src/lib/storage/restore-service.ts` (~satır 132-146)

`restoreCustomerToHot()` profiles/orders/reviews/returns'ü `archive_status='hot'` yapıyor ama
`design_files`'a DOKUNMUYOR → restore sonrası müşteri profili 'hot' görünür ama tasarım dosyaları
'cold' kilitli kalır, müşteri kendi tasarımına erişemez.

**Fix:** orders/reviews/returns güncellemelerinden sonra:
```ts
await supabase.from("design_files")
  .update({ archive_status: "hot", archived_at: null })
  .eq("user_id", userId);
```

**Doğrulama:** Arşivlenmiş müşteri restore → design_files 'hot' olur, tasarımlara erişilir.

---

## GÖREV 5/5 — storageObjectExists tüm dosyayı indiriyor 🔴 [flow-break]

#### Dosya: `src/lib/storage/promote-temp-designs.ts` (~satır 80-83, çağrılar 91/185/192)

`storageObjectExists` varlık kontrolü için `.download(path)` kullanıyor — **tüm dosya body'sini indiriyor**
(30MB × 3 çağrı). Cold Vercel lambda'da timeout → promote abort → müşteri dosyası storage'da kalır ama
order'a bağlanmaz (dosya kaybı hissi).

**Fix:** `.download()` yerine `.list()` ile sadece varlık kontrolü:
```ts
const dir = path.substring(0, path.lastIndexOf("/"));
const name = path.substring(path.lastIndexOf("/") + 1);
const { data } = await admin.storage.from(STORAGE_BUCKET).list(dir, { search: name, limit: 1 });
return (data?.length ?? 0) > 0;
```
(Veya Supabase Storage HEAD REST çağrısı.) Body indirme YOK.

**Doğrulama:** Büyük dosyalı (30MB) sipariş promote → hızlı tamamlanır, timeout yok; dosya order path'inde.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

1. `rm -rf .next/dev/types` sonra `npx tsc --noEmit` → 0 hata (kalırsa push etme).
2. `git add -A`
3. `git commit -m "fix(akis-p0): multi-design upload semasi + magic-byte + fason token iptal + restore design_files + promote exists-check"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash + canlı URL bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. Görev 1 EN KRİTİK — Sefa `/etiket/yapilandir`'da çoklu tasarım yükleyip test etmeli.
> P1'ler (19 adet — fason token grant, multi-design PDF, SVG XSS, arşiv checksum vb.) ayrı turda; bunlar P0.
