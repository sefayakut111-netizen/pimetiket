# Sistem Denetimi — Doğrulanmış P0 Fix'leri (1 Haziran)

## AMAÇ

Sistem geneli denetim (13 başlık, 81 ajan, adversaryal doğrulama) sonucu: 7 P0 + 36 P1 + 33 P2
doğrulandı, 11 yanlış-pozitif elendi. Bu dosya **7 doğrulanmış P0'ı** içerir — her biri kanıtlı,
file:line referanslı. P1/P2'ler ayrı turda.

> Migration'lar: dosyayı yaz + commit + push. **Apply'ı Sefa Supabase Studio'da manuel yapar.**
> Bir sonraki migration no = `supabase/migrations/` en yüksek + 1. RLS: `drop policy if exists; create policy` pattern.
> Editör fix'leri (Görev 4+7) koordinat matematiği — DİKKATLİ uygula, doğrulama adımlarını atlama.

---

## GÖREV 1/7 — admin_role_permissions RLS yok [security]

#### Yeni migration: `supabase/migrations/<N>_admin_role_permissions_rls.sql`

Mig 054:38 `admin_role_permissions` tablosunu `create table` ile oluşturmuş ama hiçbir migration RLS
enable etmemiş + policy yok. RBAC yetki matrisinin kendisi korumasız.

```sql
alter table public.admin_role_permissions enable row level security;

drop policy if exists "admin_role_permissions_read" on public.admin_role_permissions;
create policy "admin_role_permissions_read"
  on public.admin_role_permissions for select to authenticated
  using (public.is_admin());
-- INSERT/UPDATE/DELETE: yalnızca service_role (policy YOK = authenticated yazamaz, admin client bypass eder)
```

> ÖNCE doğrula: `public.is_admin()` fonksiyonu var mı (başka policy'lerde kullanılıyor mu)? Yoksa mevcut admin-check pattern'ini kullan.

**Doğrulama:** authenticated (admin değil) kullanıcı `select * from admin_role_permissions` → 0 satır; admin endpoint'leri (service-role) çalışmaya devam eder.

---

## GÖREV 2/7 — fn_create_partner_with_contacts admin yetkisi yok [security]

#### Yeni migration: `supabase/migrations/<N>_partner_create_admin_guard.sql`

Mig 086:368 `grant execute ... to authenticated` + fonksiyon gövdesinde hiç admin kontrolü yok.
Herhangi bir oturum açmış kullanıcı sahte partner oluşturabilir.

```sql
-- Fonksiyon gövdesine admin guard ekle (mevcut tanımı CREATE OR REPLACE ile koruyup başına ekle)
-- ... fonksiyonun başı:
--   if not public.is_admin() then raise exception 'forbidden: admin required'; end if;
revoke execute on function public.fn_create_partner_with_contacts(jsonb, jsonb, jsonb, uuid) from authenticated;
grant execute on function public.fn_create_partner_with_contacts(jsonb, jsonb, jsonb, uuid) to service_role;
```

> Fonksiyonun mevcut tam tanımını Mig 067/086'dan al, `CREATE OR REPLACE FUNCTION` ile gövdenin EN BAŞINA `is_admin()` guard ekle. Çağıran endpoint `createAdminClient()` (service-role) kullanıyorsa grant değişikliği endpoint'i kırmaz — DOĞRULA.

**Doğrulama:** Partner oluşturma admin panelinden çalışır; doğrudan authenticated RPC çağrısı `forbidden` döner.

---

## GÖREV 3/7 — Google OAuth KVKK onayını atlıyor [legal]

#### Dosya: `src/app/auth/page.tsx`

`validate()` (satır ~123) email+şifre kayıtta `acceptKvkk` zorunlu tutuyor ama `onGoogleSignIn()`
(satır ~129-162) bu kontrolü tamamen atlıyor → KVKK açık rıza alınmadan hesap açılıyor.

`onGoogleSignIn` başına: `acceptKvkk` işaretli değilse `setError("Devam etmek için KVKK metnini onayla")` + `return`. Checkbox kayıt modunda Google butonunun da üstünde görünür olmalı.

**Doğrulama:** KVKK kutusu işaretsizken Google ile giriş butonu uyarı verir, OAuth başlamaz; işaretliyken normal çalışır.

---

## GÖREV 4/7 — Editör: blade rotation SVG'ye yansımıyor [bug] ✂️

#### Dosya: `src/lib/editor/pikaso/blade-transform.ts` + `PikasoEditorCanvas.tsx`

Transformer `rotateEnabled: true` (PikasoEditorCanvas:257) — kullanıcı bıçağı döndürebiliyor. Ama
`BladeTransformMm` interface'inde (blade-transform.ts:5-9) `rotation` alanı yok; `bladeTransformFromGroup`
(satır 57-71) `group.rotation()` okumuyor. Döndürülmüş bıçak → export'ta YANLIŞ kesim hattı.

1. `BladeTransformMm`'e `rotationDeg: number` ekle (DEFAULT'a `rotationDeg: 0`).
2. `bladeTransformFromGroup`'ta `rotationDeg: group.rotation()` oku.
3. `applyBladeTransformToBundle` → `transformRing`'de her noktayı merkez (cx,cy) etrafında `rotationDeg` kadar döndür (ölçek+offset'ten SONRA veya tutarlı sırayla).
4. `render-cutline.ts` `applyGroupTransform`'ta `group.rotation(transform.rotationDeg)` set et (önizleme ile export tutarlı olsun).

**Doğrulama:** Bıçağı 45° döndür → export edilen SVG/PDF'te kesim hattı görsel ile aynı açıda; 0°'de regresyon yok.

---

## GÖREV 5/7 — Editör: görüntü rotasyonu contour'a yansımıyor [bug] ✂️

#### Dosya: `src/lib/editor/cutline/types.ts` + `placement.ts` + `contour.ts`

`placementFromPikasoImage` (placement.ts:24-25) Konva'nın `rotation()`'ını okuyor ama `ImagePlacementMm`
interface'inde (types.ts:14-19) `rotation` alanı yok. `mapPixelPathsToLabelMm` (contour.ts:7-19) sadece
sx/sy scale + offset uyguluyor, rotasyon yok → döndürülmüş tasarımda kontur kayık/yanlış.

1. `ImagePlacementMm`'e `rotationDeg: number` ekle.
2. `placementFromPikasoImage` çıktısına `rotationDeg` koy.
3. `mapPixelPathsToLabelMm`'de: önce piksel noktasını görüntü merkezine göre `rotationDeg` döndür, sonra scale+offset uygula.

> Görev 4 ve 5 ilişkili (ikisi de rotation) ama AYRI katmanlar (4=bıçak grubu, 5=görüntü→kontur eşleme). İkisini de yap, ayrı doğrula.

**Doğrulama:** Görseli döndür → "Otomatik bıçak oluştur" → kontur döndürülmüş silüeti takip eder; 0°'de regresyon yok (commit f6871bc label-local fix korunur).

---

## GÖREV 6/7 — PayTR reconciler hardcoded order_id → recovery kırık [bug]

#### Dosya: `src/app/api/cron/paytr-reconciler/route.ts` (satır ~183)

`p_order_id: "RECONCILER"` hardcoded. Mig 065 döneminde RPC bunu yok sayıyordu; **Mig 078 sonrası RPC
`p_order_id`'yi doğrudan `orders.id` olarak kullanıyor**. Yani ilk IPN-miss recover "RECONCILER" id'li
order yazar, ikinci+ recover `unique_violation` (23505) ile kalıcı patlar → ödeme alınmış ama sipariş oluşmamış kalır.

`p_order_id: "RECONCILER"` → `p_order_id: generateOrderId()`. callback/route.ts:284-307'deki 3-deneme
23505 retry mekanizmasını buraya da uygula (kopyala).

```ts
import { generateOrderId } from "@/lib/customer-order"; // import yoksa ekle
// ... reconcile döngüsünde:
let candidateOrderId = generateOrderId();
// 3x retry on rpcErr.code === "23505" → yeni generateOrderId()
```

**Doğrulama:** `npx tsc --noEmit` temiz; reconciler 2+ IPN-miss order'ı ardarda kurtarabilir (unique_violation yok).

---

## GÖREV 7/7 — Rulo etiket 10001-25000 adet fiyat bypass'ı [security/fiyat]

#### Dosya: `src/lib/payment-validation.ts` + `src/app/api/payment/init/route.ts`

`ETIKET_MAX_QTY=25000` UI izin veriyor ama `PRICEBOOK_MAX_QTY=10000`. qty>10000 → pricebook lookup
`qty_above_max` → `quoteEtiketFromConfig` null → payment-validation:311 `recalced=false` → sadece sanity
floor uygulanır. Müşteri 10001-25000 arası **gerçek fiyatın altında** ödeyebilir (gelir kaybı + TKHK).

**İKİ SEÇENEK — Sefa kararı gerek:**
- (A) **Hızlı/güvenli:** `ETIKET_MAX_QTY=10000` yap + `init/route.ts` CartItemSchema'da qty üst sınırı `.max(10000)`. 10000 üstü sipariş engellenir.
- (B) **Kalıcı:** `PRICEBOOK_MAX_QTY=25000` + pricebook matrisini 25000'e kadar genişlet (büyük iş).

Cursor: **(A)'yı uygula** (güvenli varsayılan) + Sefa'ya "B isterse pricebook genişletilecek" notu bırak.
`init/route.ts` CartItemSchema'da qty için `z.number().int().positive().max(10000)` ekle (server-side guard).

**Doğrulama:** qty=15000 etiket siparişi → init 400 reddeder (veya UI 10000'e cap); qty=10000 normal fiyat hesaplanır.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

Her görev bitince:
1. `npx tsc --noEmit` **TEMİZ** (kırıksa push ETME).
2. `git add -A`
3. `git commit -m "fix(audit-p0): RLS + partner guard + KVKK OAuth + editör rotation + reconciler + etiket qty cap"`
4. `git push origin main` → Vercel deploy.
5. **Migration'lar (Görev 1,2):** push edildi ama Supabase'e UYGULANMADI → Sefa'ya bildir: "Mig <N..> Studio'da apply et" (küçük no → büyük).
6. Deploy READY → **commit hash + canlı URL + apply bekleyen migration listesi + Görev 7 için A/B kararı sorusu** bildir.

> Git kökü `pim-etiket/core/`. Editör fix'leri (4,5) canlıda `/editor`'da, fiyat (7) `/etiket/yapilandir`'da test edilmeli.

## DOSYA LİSTESİ
**Yeni:** 2 migration (admin_role_permissions RLS, partner create guard)
**Düzenlenecek:** auth/page.tsx, blade-transform.ts, PikasoEditorCanvas.tsx, render-cutline.ts, cutline/types.ts, placement.ts, contour.ts, paytr-reconciler/route.ts, payment-validation.ts, payment/init/route.ts
