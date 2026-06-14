# Cursor Görevi — FAZ 2 Kalan 5 Launch-Blocker

> 13 Haz 2026 · Claude mimari + çok-ajanlı (doğrula→tasarım→adversaryal→final-spec). Her bulgunun adversaryal-bulduğu holes düzeltilmiş.
> Branch: `claude/file-review-updates-vnd6og`. **Push YOK** — Claude diff doğrulayacak.

## Triyaj
| # | Bulgu | Tip | Migration |
|---|---|---|---|
| 1 | **reprint-kupon idempotency** (çift indirim) | P1 para | **183** |
| 2 | **M9 RBAC self-escalation + impersonation** | Yüksek güvenlik | **184** |
| 3 | **M3 partner upload magic-byte** | P1 güvenlik | yok |
| 4 | **M4 multi-design onay** | P1 akış | yok |
| 5 | **auditor double-run** (çift aksiyon) | P1 idempotency | yok |

> **Migration no:** reprint=**183**, M9=**184** (ikisi de taslakta 183 dedi — M9 dosyasını `184_...` yap + içindeki yorum başlığını 184 yap).

Önerilen commit: 5 ayrı commit (her bulgu) VEYA 2 commit (migrationlılar + TS-only). Her biri sonunda `npm run build`. **Push etme.**

---

## 1) reprint-kupon idempotency — Migration 183 + route

### 1a) `storefront/supabase/migrations/183_reprint_coupon_idempotency.sql` (YENİ)
**SIRA ZORUNLU: önce DO-block dedupe (DEACTIVATE, asla DELETE), sonra CREATE UNIQUE INDEX.** is_active predicate'e DAHİL.
```sql
-- Migration 183 — Reprint kupon idempotency (FAZ 2)
-- coupons.description üzerinde kısmi unique index (is_active=true DAHİL → deaktive slot serbest).
-- SIRA: referans-güvenli dedupe → CREATE UNIQUE INDEX. coupon_uses.coupon_id ON DELETE CASCADE
-- olduğu için referanslı kupon ASLA silinmez (deactivate edilir).

-- 1) Referans-güvenli dedupe (index'ten ÖNCE)
do $$
declare r record;
begin
  for r in
    select description from public.coupons
    where description like 'Tekrar baskı — %' and is_active = true
    group by description having count(*) > 1
  loop
    with keep as (
      select c.id from public.coupons c
      where c.description = r.description and c.is_active = true
      order by (exists (select 1 from public.coupon_uses cu where cu.coupon_id = c.id)) desc,
               c.created_at asc, c.id asc
      limit 1
    )
    update public.coupons c set is_active = false, updated_at = now()
    where c.description = r.description and c.is_active = true
      and c.id not in (select id from keep);
  end loop;
end$$;

-- 2) Kısmi unique index (dedupe'tan SONRA)
create unique index if not exists coupons_reprint_source_unique
  on public.coupons (description)
  where description like 'Tekrar baskı — %' and is_active = true;

comment on index public.coupons_reprint_source_unique is
  'Mig 183: kaynak sipariş başına max 1 AKTİF reprint kuponu. is_active=true predicate → deaktive slot serbest (wedge yok).';
```

### 1b) `storefront/src/app/api/loyalty/reprint-coupon/route.ts`
Hot-path SELECT (satır 74-79, `.eq("description",...).eq("is_active",true)`) **DOKUNMA** (index ile hizalı). INSERT bloğunu (satır 92-115) idempotent yap:
- INSERT'e `.select("code, value").single()` ekle.
- `insertErr.code === "23505"` → re-SELECT (**aynı `is_active=true` filtre**); satır dönerse `{code, value, reused:true}`; **dönmezse ASLA `{code:undefined}` dönme** → `console.error` + `409 "Kupon oluşturulamadı (yarışlı, tekrar deneyin)"`.
- Diğer insertErr → 500.
- Başarıda `inserted.code/value` döndür (sabit 10 değil — `coupons_normalize` trigger code'u uppercase'liyor, DB değerini kullan).

> **3 nokta hizalı olmalı:** hot-path SELECT / 23505 re-SELECT / index predicate — üçü de `is_active=true`. Em-dash (`—` U+2014) route ile migration'da birebir aynı (UTF-8 koru). Desen: `admin/fason/assign/route.ts:134` 23505 idiom.

---

## 2) M9 RBAC — Migration 184 + 2 TS

### 2a) `storefront/src/app/api/admin/impersonate/partner/route.ts` (B1)
Satır 47: `assertPermission("fason", "create")` → **`assertPermission("staff", "update")`** (impersonation yüksek-yetki; operations rolü fason:create taşıyor, staff:update yalnız super_admin'de — Mig 055). Başka satıra dokunma.

### 2b) `storefront/src/lib/supabase/assert-permission.ts` (B3)
Satır 71-74'teki legacy NULL-fallback bloğunu değiştir:
```ts
// ESKİ: if (!p.admin_role || p.admin_role === "super_admin") return guardResult;
// YENİ:
if (p.admin_role === "super_admin") {
  return guardResult;
}
// Legacy admin (admin_role NULL) genelde tam yetki — AMA 'staff' modülünde DEĞİL
// (self/peer super_admin atamasını engelle). '*' (assertAdminCompat) ve 'settings'
// (Mig 055/056 super_admin'e meşru) REDDEDİLMEZ — yalnız 'staff'.
if (!p.admin_role) {
  if (module === "staff") {
    return null;
  }
  return guardResult;
}
```
> **`*` ve `settings`'i REDDETME** (adversaryal mustFix — `*` canlı `assertAdminCompat` tarafından, `settings` super_admin'e meşru; B14 regresyonu olur). Yalnız `staff`.

### 2c) `storefront/supabase/migrations/184_rbac_self_escalation_guard.sql` (YENİ — taslakta 183 yazıyor, **184 yap**)
**SIRA ZORUNLU: backfill (admin→super_admin, staff→production; admin/staff dışına dokunmaz) ÖNCE, trigger CREATE SONRA.**
```sql
-- Migration 184: RBAC self-escalation guard (M9-B3) + legacy backfill
-- admin_role=NULL eski admin/staff hesapları super_admin gibi sayılıyordu →
-- staff:update ile kendine super_admin atayabilirlerdi. DB-seviyesi 2. savunma.
-- FAZ0: prod'da 1 super_admin + 3 admin_role=NULL (3'ü customer → backfill dokunmaz).
-- SIRA: backfill → trigger.

-- 1) BACKFILL (ÖNCE) — idempotent (Mig 091 yaptı, NULL kalmışı süpürür)
update public.profiles set admin_role = 'super_admin'::public.admin_role_v2
  where role = 'admin' and admin_role is null;
update public.profiles set admin_role = 'production'::public.admin_role_v2
  where role = 'staff' and admin_role is null;

-- 2) TRIGGER FONKSİYONU — auth.uid() NULL (service_role) bypass; authenticated path'te
--    super_admin'e yükseltmeyi yalnız mevcut super_admin yapabilir.
create or replace function public.fn_guard_admin_role_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor_admin_role public.admin_role_v2;
begin
  if auth.uid() is null then return new; end if;
  if new.admin_role is distinct from 'super_admin'::public.admin_role_v2 then return new; end if;
  if old.admin_role is not distinct from new.admin_role then return new; end if;
  select admin_role into v_actor_admin_role from public.profiles where id = auth.uid();
  if v_actor_admin_role is distinct from 'super_admin'::public.admin_role_v2 then
    raise exception 'super_admin atamasını yalnız mevcut super_admin yapabilir (RBAC self-escalation guard)'
      using errcode = '42501';
  end if;
  return new;
end; $$;

-- 3) TRIGGER (SONRA)
drop trigger if exists trg_guard_admin_role_escalation on public.profiles;
create trigger trg_guard_admin_role_escalation
  before update of admin_role on public.profiles
  for each row execute function public.fn_guard_admin_role_escalation();
```
> Apply ÖNCESİ doğrula: `select id, role, admin_role from profiles where admin_role is null;` — çıkanlar customer/partner olmalı. Trigger sadece `super_admin` hedefini kısıtlar ('finance' dahil diğerleri serbest). `is_super_admin()` (Mig 011) legacy `role`'e bakar — onu KULLANMA, inline admin_role kontrolü yazıldı.

---

## 3) M3 partner upload magic-byte — `storefront/src/app/api/partner/orders/[id]/items/[itemId]/upload-revision/route.ts`
> **Doğru dosya bu** (fason/update DEĞİL — o JSON endpoint). Admin upload-design içerik-tip zincirini kopyala.

1. **Import ekle** (satır 37): `import { STORAGE_BUCKET, type AllowedMime } from "@/lib/storage/design-files";` + altına:
   `import { detectMimeFromMagicBytes } from "@/lib/storage/magic-bytes";`
   `import { maybeSanitizeUploadBytes } from "@/lib/upload/sanitize-svg";`
   `import { categorizeFile, BLOCKED_FILE_MESSAGE } from "@/lib/design-file-types";`
   **`MAX_FILE_SIZE` (30MB) İMPORT ETME** — mevcut `MAX_BYTES=50MB` (satır 43) + size guard (156-164) **AYNEN KALIR** (meşru 30-50MB PSD/AI kırılmasın).
2. **CANONICAL_MIME map ekle** (MIME_EXT sonrası, ~satır 63) — magic-byte detector yalnız 6 kanonik MIME tanıyor; partner ALLOWED_MIMES `application/postscript`/`application/x-photoshop` takma adlarını **magic-byte'tan ÖNCE** kanonikleştir:
```ts
const CANONICAL_MIME: Record<string, AllowedMime> = {
  "image/png": "image/png", "image/jpeg": "image/jpeg", "image/svg+xml": "image/svg+xml",
  "application/pdf": "application/pdf",
  "application/postscript": "application/illustrator", "application/illustrator": "application/illustrator",
  "application/x-photoshop": "image/vnd.adobe.photoshop", "image/vnd.adobe.photoshop": "image/vnd.adobe.photoshop",
};
```
3. **categorizeFile blocked guard** (415 MIME guard'ından HEMEN ÖNCE, size guard'ından sonra): `if (categorizeFile(file.name, file.type) === "blocked") return 400 {blocked_file_type, BLOCKED_FILE_MESSAGE}`.
4. **sanitize + magic-byte zinciri** (415 guard'dan sonra, upload'tan önce): `const arrayBuffer = ...` SİL → `canonicalMime = CANONICAL_MIME[file.type]` (yoksa 415) → `let uploadBytes = await file.arrayBuffer()` → `maybeSanitizeUploadBytes` (SVG, hata→400) → `headerBytes = slice(0,64)` → `detectMimeFromMagicBytes(headerBytes, canonicalMime)` → `!matchesClaim` → 400 `file_content_mismatch`. **Upload çağrısını `uploadBytes` ile yap** (tüm `arrayBuffer` referansı → `uploadBytes`). `contentType: file.type` AYNEN kalır (DB-stored MIME değişmez).

> **Sıra:** size 413 [mevcut] → categorizeFile 400 [yeni] → ALLOWED_MIMES 415 [mevcut] → kanonikleştir → SVG sanitize → magic-byte 400.

---

## 4) M4 multi-design onay — 2 TS, migration yok

### 4a) `storefront/src/app/api/orders/[id]/proof/[itemId]/approve/route.ts` (B6)
`itemRow` fetch'inden **SONRA** (satır 114 `const itemMeta = itemRow?.meta ?? {};` altına, designFiles fetch'inden önce) — **satır 102'ye KOYMA (itemRow henüz tanımsız, derleme kırılır):**
```ts
// FAZ2 M4 B6: Açık yardım talebi olan kalem onaylanamaz (help route deseni).
if (itemRow?.proof_status === "help_requested") {
  return NextResponse.json(
    { error: "Bu ürün için açık bir yardım talebin var — operatörümüz çözümleyince onaylayabilirsin" },
    { status: 400 });
}
```

### 4b) `storefront/src/app/onay/[orderId]/page.tsx` (B10)
load() redirect bloğunda (satır 693-708) ilk `if (status === "proof_approved")`'ı tam beyaz listeye genişlet:
```ts
const PROOF_DONE_STATUSES = ["proof_approved","operator_print_review","ready_to_ship","in_production","shipped","delivered"];
if (PROOF_DONE_STATUSES.includes(summary.order.status)) { router.replace(`/onay/${orderId}/tamamlandi`); return; }
```
(İkinci if proof_pending/generating/validating dışındakileri zaten /siparis'e yolluyor — kalsın.) `fason_assigned`/`human_review*` kasten listede yok. B2 SQL design-count re-check **ATLANDI** (launch-opsiyonel).

---

## 5) auditor double-run — `src/app/api/admin/auditors/pending/[id]/decide/route.ts`, migration YOK
> Kök: 3 dal (snooze/reject/approve) koşulsuz `.update().eq("id")` → concurrent reject+approve clobber + approve_with_edit payload yarışı. `executePendingAction` TEK çağrıcı (decide:211) + casUpdate claim yeterli — **'applying' state/migration EKLEME.**

1. **Import:** `import { casUpdate } from "@/lib/db/cas-update";` (satır 31-32 arası).
2. **snooze dalı** → `casUpdate(admin, "auditor_pending_actions", id, {status:"snoozed", reviewed_by, reviewed_at, review_note, snooze_until}, {expectFrom:"pending", col:"status", select:"id"})`; `!cas.ok` → stale 409 `invalid_status` / error 500.
3. **reject dalı** → aynı casUpdate(expectFrom:"pending") `{status:"rejected", ...}`; stale→409.
4. **approve + approve_with_edit BİRLEŞTİR (atomik):**
```ts
const approvePatch: Record<string, unknown> = { status:"approved", reviewed_by: auth.user.id, reviewed_at: reviewedAt, review_note: note };
if (body.decision === "approve_with_edit") approvePatch.action_payload = body.editedPayload as Json;
const approveCas = await casUpdate(admin, "auditor_pending_actions", id, approvePatch, { expectFrom:"pending", col:"status", select:"*" });
if (!approveCas.ok) return NextResponse.json(approveCas.reason==="stale" ? {error:"invalid_status",...} : {error:"approve_update_failed"}, {status: approveCas.reason==="stale"?409:500});
```
   Eski ayrı `action_payload` fire-and-forget update'i (178-181) + in-memory `actionPayload` (173,176) **SİL** — `executePendingAction` payload'ı DB'den yeniden okuyor, claim'e yazılan editedPayload doğru görülür.
5. **`pending` değişkeni + ilk fetch (89-102) KORU** (satır 230/233 bildirimde kullanılıyor). Üstteki erken `status!=="pending"→409` (104-113) **kalsın** (hızlı UX, casUpdate backstop'lar). Tasarım metninde "migrasyon-suz varyant çift handler'ı engeller" gibi yanlış iddia varsa **çıkar**.

> Şema teyitli (mig 040): status CHECK tüm değerleri içeriyor, action_payload jsonb NOT NULL (editedPayload zorunlu z.record). Desen: `returns/[id]/status:86-102` casUpdate stale→409 birebir.

---

## DİKKAT (yapma listesi)
- ❌ Migration no çakıştırma: reprint=183, M9=184 (M9 dosya adı+yorum 184).
- ❌ reprint/M9 migration'da blok sırasını ters çevirme (dedupe→index, backfill→trigger).
- ❌ reprint dedupe'ta DELETE kullanma (coupon_uses CASCADE). is_active predicate'i index'ten çıkarma.
- ❌ M9: `*`/`settings` modülünü reddetme (yalnız `staff`). `is_super_admin()` kullanma.
- ❌ M3: 50MB→30MB düşürme; MAX_FILE_SIZE import etme; magic-byte'ı 415 guard'dan önce koyma.
- ❌ M4 B6 guard'ını itemRow'dan önce koyma.
- ❌ auditor: 'applying' state/migration ekleme; `pending` değişkenini silme.
- ❌ Push etme.

## Sıra
1. Cursor: 5 fix'i uygula (reprint mig 183 + M9 mig 184 canlıya uygula; TS'ler build). `npm run build`. Commit (push yok).
2. Claude: migration'ları canlıdan + diff'i adversaryal doğrula.
3. M9/reprint migration canlıya uygulanınca: M9 self-escalation + reprint unique index canlı teyit.
