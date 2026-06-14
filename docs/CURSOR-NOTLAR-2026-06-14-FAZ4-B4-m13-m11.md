# Cursor Görevi — FAZ 4 Batch 4 (SON): M13 cron + M11 R2 storage

> 14 Haz 2026 · Claude mimari + adversaryal. Migration YOK (kod-only). Branch: `claude/file-review-updates-vnd6og`. **Push YOK** — Claude doğrulayacak. Bu batch'le denetimin tüm fazları kapanır.

## Kapsam (hepsi medium, kod-only)
| # | Bulgu | Not |
|---|---|---|
| M13 | #4 abandoned-cart key + #8/#12 cron reaper | #7 Sefa kararı, #2/#3/#5 ertelendi |
| M11 | B3 orphan dosya silme (KVKK) + B1 restore sahiplik | B4/B6/B7 ertelendi (P4) |

2 commit. Her biri `npm run build`.

---

## M13 — cron reminder + reaper (kod-only)

### M13a) #4 — abandoned-cart idempotency: HAFTA-KOVALI key (ÖMÜR-BOYU değil)
> ⚠️ Tam-stabil `abandoned_cart:${uid}` KULLANMA — `fn_enqueue_mail` idempotency'si **penceresiz** (Mig 076:239-246) → ilk mail sonrası key kalıcı → kullanıcı haftalar sonra gerçekten sepet terk edince mail HİÇ gitmez (ömür-boyu sessiz suppression, çift-mailden kötü). **Hafta-kovalı** key doğal 7-gün TTL gibi davranır:
- `src/lib/mail/notifications.ts` (sendAbandonedCart, ~1466/1475): `const dayKey = ...slice(0,10)` → `const weekKey = Math.floor(Date.now()/(7*86400000))`; idempotencyKey `abandoned_cart:${args.userId}:${weekKey}`.
- `src/app/api/cron/detect-abandoned-carts/route.ts` (~124-143, LOCKSTEP): aynı weekKey; `idempotencyKeys = userIds.map(uid => \`abandoned_cart:${uid}:${weekKey}\`)`. `.gte('created_at', sevenDaysAgo)` filtresi KALSIN. usersWithMail parse (`split(':')[1]`) değişmeden çalışır (key hâlâ 3-parçalı).

### M13b) #8/#12 — stale 'running' cron reaper (sahte sağlık)
> Cron crash/timeout'ta `cron_runs` satırı 'running' takılı kalır → dashboard sahte-sağlık. withCronRun'a reaper ekle.
- `src/lib/cron-logger.ts` (withCronRun, advisory lock SONRASI, **startCronRun INSERT'inden ÖNCE**):
```ts
const staleCutoff = new Date(Date.now() - 30*60*1000).toISOString();
await admin.from("cron_runs").update({
  status: "error",  // ⚠️ 'failed' DEĞİL — cron_runs CHECK (Mig 104:7) yalnız running/success/error; 'failed'=23514
  finished_at: new Date().toISOString(),
  error_message: "stale_running_reaped (30dk+ tamamlanmadı — crash/timeout)",
}).eq("cron_name", cronName).eq("status", "running").lt("started_at", staleCutoff);
```
> **SIRA KRİTİK:** reaper UPDATE startCronRun INSERT'inden ÖNCE — yoksa `cron_runs_one_running_per_name` unique index (Mig 180:26-28) takılı 'running' yüzünden INSERT'i 23505 ile bloklar, reaper hiç çalışmaz. Direct service-role UPDATE (process-mail-outbox:79-91 stale-'sending' deseni — yeni RPC İCAT ETME). 30dk cutoff: en uzun cron maxDuration=300sn≪30dk → meşru uzun-run'ı asla 'error' işaretlemez.

> #2/#3/#5 (çift-archive/yarım-archive/timeout): **ertelendi** — FAZ1 advisory lock + get_archive_candidates(hot) + archiveCustomer rollback ile pratik kapalı; reaper #8/#12 takılı-running'i zaten süpürür.

---

## M11 — R2 storage (kod-only, KVKK-ilişkili)

### M11a) B3 — süpersede edilen orphan dosya silme (KVKK boşluğu)
> Kök: bg-remove/enhance-accept eski dosyayı `status='superseded'` yapıyor ama **fiziksel objeyi (R2/Storage) silmiyor**; purge RPC `fn_mark_expired_designs_for_deletion` 'superseded'i taramıyor → müşteri PII dosyası sonsuza kalır.

**İki endpoint — inline-hemen-sil (GÜVENLİ, yeni dosya zaten yüklü):** `background/remove/route.ts` (~119-122) ve `design/enhance/accept/route.ts` (~119-122) — `.update({status:'superseded'})` SONRASI:
```ts
try {
  if (isR2StorageKey(designFile.storage_path)) await deleteFromR2(designFile.storage_path);
  else await admin.storage.from(STORAGE_BUCKET).remove([designFile.storage_path]);
} catch (e) { console.warn("[supersede] eski obje silinemedi:", designFile.storage_path, e); }
```
Import: `deleteFromR2` (`@/lib/storage/r2-client`), `isR2StorageKey` (`@/lib/storage/purge-r2`). STORAGE_BUCKET zaten import edili. **Dual-branch ZORUNLU** (büyük dosya R2'de olabilir — upload-init-r2:128). try/catch best-effort (silme hatası akışı bloklamasın).

**ÜÇÜNCÜ yol — `design/upload-init/route.ts` replace (~111-128): inline-sil YAPMA** ⚠️ — bu noktada yeni dosya henüz yüklenmedi (signed URL döndü, client PUT etmedi); eskiyi hemen silersen ve client tamamlamazsa **hem eski hem yeni kaybolur (veri kaybı)**. Bunun yerine **silmeyi `upload-complete/route.ts`'e ertele**: replaceFileId'yi taşı, yeni dosya 'analyzing'e geçtikten (~221-227) SONRA eski objeyi aynı dual-branch desenle sil (replace ise). Migration gerekmez.

### M11b) B1 — restore-service sahiplik kontrolü öne + anti-enumeration
- `src/lib/storage/restore-service.ts`: sahiplik kontrolünü (~satır 68 `requesterType==='user' && file.user_id!==requesterId`) cold-check'in (~63) **ÖNÜNE taşı**; sahibi olmayan 'user' için generic `{ error: 'Dosya bulunamadı' }` dön (statü/varlık sızdırma yok → route 404). Tek caller restore-url:46 'user' geçiyor; admin/cowork ownership atlıyor → meşru akış kırılmaz.

> **B4/B6/B7 ertelendi (P4 opsiyonel):** B6 (failedKeys audit detail) salt-additif; B7 (R2 timeout) — DİKKAT `maxAttempts:3` SDK default'u **no-op**, gerçek fix `requestHandler: new NodeHttpHandler({connectionTimeout, requestTimeout})` + sabit `src/lib/http/external-timeouts.ts`'e. B4 büyük ölçüde zaten çözülü. Bunları bu PR'a KOYMA.

---

## DİKKAT (adversaryal düzeltmeler)
- ❌ M13 #4: tam-stabil key kullanma (ömür-boyu suppression) → hafta-kovalı.
- ❌ M13 #8/#12: status 'failed' yazma (CHECK'te yok, 23514) → 'error'; reaper'ı startCronRun INSERT'inden SONRA koyma (unique index bloklar).
- ❌ M11 B3: upload-init replace'te inline-sil yapma (veri kaybı) → upload-complete'e ertele; dual-branch (R2+Storage) atlama.
- ❌ M11 B7: maxAttempts:3 yazma (no-op) — ertelendi zaten.
- ❌ Push etme.

## Sefa kararı (kod yok — bilgine)
- **M13 #7 upload-reminder cadence:** şu an awaiting_upload boyunca ~günlük tekrar (14 güne ~14 mail). "Çift-mail" denetim bulgusu aslında **tekrar-hatırlatma kasıtlı mı** sorusu. Tekrar conversion'a iyi gelir → **varsayılan: değişiklik yok**. Tek-hatırlatma istersen `upload_reminded_at` kolonu (mig 189) + claim gerekir.
- **advisory-lock pooling caveat:** fn_with_advisory_lock session-level pg_try_advisory_lock — Supabase pooler'da nadir lock-sızıntısı olabilir; FAZ-sonrası `_xact_lock`'a geçiş ayrı iş (M13 kapsamı dışı, launch-blocker değil).

## Sıra
1. Cursor: M13 (#4 + reaper) + M11 (B3 bg-remove/enhance/upload-complete + B1 restore). `npm run build`. 2 commit (push yok).
2. Claude: verify-cursor-diff (presence: weekKey, reaper 'error'+30dk, deleteFromR2 dual-branch, restore ownership reorder).
