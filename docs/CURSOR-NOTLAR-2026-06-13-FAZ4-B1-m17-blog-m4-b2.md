# Cursor Görevi — FAZ 4 Batch 1: M17 blog XSS/upload + M4-B2 (kaynak fix)

> 13 Haz 2026 · Claude mimari + adversaryal. Migration YOK (M4'ün riskli RPC gate'i bilinçli ATLANDI — low/latent için fn_finalize_proof'a dokunmaya değmez; kaynak fix yeterli).
> Branch: `claude/file-review-updates-vnd6og`. **Push YOK** — Claude diff doğrulayacak.

## Kapsam
| # | Bulgu | Severity | Migration |
|---|---|---|---|
| M17 | blog javascript:/data: XSS (#1) + upload public-bucket (#5) | medium (blog canlı) | yok |
| M4-B2 | onaylı item'da bg-remove → yeniden onay gerekmiyor | low/latent | yok |

> **M1 #13 (para) bu doc'ta YOK** — Sefa kararı bekliyor (ayrı verilecek). M4'ün B1/B3'ü NO-OP (zaten çözülmüş).

---

## M17 — blog XSS + upload güvenliği (6 dosya, migration yok)

### ⚠️ ÖNCE: `src/lib/storage/magic-bytes.ts` — WebP imzası ekle (PREREQ)
**Bunu ÖNCE yap** yoksa yeni magic-byte gate **tüm webp upload'larını kırar** (bugün çalışıyor). magic-bytes WebP tanımıyor:
- MIME_ALIASES'a `"image/webp": ["image/webp"]` ekle.
- SIGNATURES: WebP = RIFF konteyner — **süreksiz** imza: byte 0-3 = `52 49 46 46` ('RIFF') VE byte 8-11 = `57 45 42 50` ('WEBP'). Mevcut matcher offset-0 bitişik byte varsayıyor → `detectMimeFromMagicBytes` içine özel dal ekle (0'da RIFF + 8'de WEBP → mime 'image/webp', label 'WEBP'). png/jpeg etkilenmemeli.

### #1 — XSS: render allowlist (BİRİNCİL) + write reject (ikincil)
**`src/app/blog/[slug]/page.tsx`** (renderBody link dalı ~132-142): `<a href={link[2]}>` ÖNCESİ allowlist (image dalındaki 88. satır deseninin link'e genellenmişi):
```ts
const safeHref = /^(https?:\/\/|\/|mailto:)/i.test(link[2]);
if (!safeHref) return <span key={j}>{link[1]}</span>;
```
**`src/app/api/admin/blog/route.ts`** (POST ~72 + PATCH ~148, trim sonrası): defense-in-depth:
```ts
if (/\]\(\s*(javascript:|data:)/i.test(body_tr))
  return NextResponse.json({ error: "İçerikte güvensiz bağlantı (javascript:/data:) var" }, { status: 400 });
```
> TÜM `javascript:` VE TÜM `data:` reddet (render allowlist zaten ikisini de düşürüyor — tutarlı). Mevcut 400 deseni (route.ts:73-78).

### #5 — upload: server-side multipart magic-byte (site-images deseni — partner DEĞİL)
> **partner upload-revision'ı KOPYALAMA** — `categorizeFile` webp'i 'blocked' yapar + pdf/ai/psd taksonomisi blog'a yanlış. **Doğru referans: `src/app/api/site-images/route.ts:97-263`** (raster, categorizeFile çağırmaz).

**`src/app/api/admin/blog/upload-cover/route.ts`** — yeniden yaz (site-images deseni): assertPermission('blog','create') → `formData()` (throw→400) → `file = formData.get('file')` (File değilse 400) → size>5MB→413 → `claimedMime=file.type`, **`ALLOWED_MIME=['image/png','image/jpeg','image/webp']`** (svg/pdf/ai/psd YOK) değilse 415 → `maybeSanitizeUploadBytes(bytes, claimedMime, name)` → `detectMimeFromMagicBytes(bytes.slice(0,512), claimedMime)` `!matchesClaim`→400 → path `blog/covers/{uuid}.{ext}` → `admin.storage.from('public-assets').upload(bytes,{contentType: claimedMime, upsert:false})` (**contentType SERVER-PINNED** = text/html-as-png vektörünü öldürür) → `{ publicUrl }` dön. `createAdminClient()` kullan. `categorizeFile` ÇAĞIRMA.

**`src/app/api/admin/blog/upload-image/route.ts`** — upload-cover ile birebir aynı, yalnız path `blog/inline/{uuid}.{ext}`.

**`src/components/admin/icerik/BlogTab.tsx`** (uploadCover ~143-179, handleInlineImageUpload ~181-244): iki-adım (signed-url POST → PUT) yerine tek `FormData` POST: `const fd=new FormData(); fd.append('file',file); fetch('/api/admin/blog/upload-cover'|'/upload-image',{method:'POST',body:fd})` (content-type header EKLEME — browser multipart boundary set eder); `json.publicUrl`'i eskisi gibi oku. Ayrı PUT-to-signedUrl bloğu (161-165, 208-212) + `{extension}` body kaldır. Client size/type ön-kontrolleri kalsın (UX).

---

## M4-B2 — onaylı item'da bg-remove → yeniden onay (1 dosya, kaynak fix)
> Sorun: onaylanmış bir item'da müşteri arka plan sildirince proof_status='approved' kalıyor → yeni artwork eski cutline ile üretime gidebilir. **Kaynak fix** (RPC gate'e gerek yok): bg-remove sonrası proof_status'u resetle.

**`src/app/api/orders/[id]/proof/[itemId]/background/remove/route.ts`**:
- order_items select'ine (~48-58) `proof_status` ekle.
- meta update'ine (~147-156): item'ın MEVCUT proof_status'u **'approved' ise** `proof_status:'viewed', proof_approved_at:null` ekle (yeni artwork → yeniden onay); değilse dokunma.
```ts
...(itemRow.proof_status === "approved" ? { proof_status: "viewed", proof_approved_at: null } : {})
```
> Desen: `save-cutline-edit.ts:409-417` 'edited' reset deseninin bg-tarafı eşi ('viewed' Mig 084 check'inde geçerli).

---

## DİKKAT
- ❌ magic-bytes WebP imzasını ATLAMA (yoksa webp upload kırılır) — ÖNCE onu yap.
- ❌ blog upload'ta partner upload-revision/`categorizeFile` kullanma (webp'i bloklar) — site-images deseni.
- ❌ blog ALLOWED_MIME'a svg ekleme (public bucket'a güvensiz SVG sokma).
- ❌ M4'te fn_finalize_proof RPC'sine dokunma / migration 187 yazma (low/latent için over-engineering + false-positive riski) — yalnız bg-remove kaynak fix.
- ❌ Push etme.

## Doğrulama (Claude — verify-cursor-diff manifest'iyle, lean)
- build temiz · render allowlist + write-reject var · upload route'larında `detectMimeFromMagicBytes` + server-pinned contentType var, `createSignedUploadUrl` YOK · magic-bytes'ta `image/webp` var · bg-remove'da `proof_status: "viewed"` var.
- En kritik manuel regresyon testi: **gerçek .webp cover upload** → 200 + render (fix öncesi 400 mime_mismatch).

## Sıra
1. Cursor: M17 (magic-bytes ÖNCE → render → write → 2 upload route → BlogTab) + M4-B2. `npm run build`. 2 commit (push yok).
2. Claude: verify-cursor-diff manifest + webp manuel test doğrula.
