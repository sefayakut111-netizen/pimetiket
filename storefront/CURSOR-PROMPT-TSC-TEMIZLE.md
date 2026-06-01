# tsc Temizliği — 8 gerçek TS hatası + types.ts commit

## DURUM

`next.config.ts:109` `ignoreBuildErrors: true` olduğu için Vercel build patlamıyor AMA `npx tsc --noEmit`
**8 gerçek hata** veriyor (4 dosya). 2'si son denetim turlarının regression'ı, 2'si daha eski. Hepsini
düzelt; `ignoreBuildErrors` arkasında saklanan teknik borç temizlensin.

> Bu turda `src/lib/supabase/types.ts` da değişti (migration apply sonrası regen — v_pricing_live,
> fn_apply_coupon_admin, yeni audit_action enum'ları, editor_cutline_drafts). O dosya DOĞRU, dokunma;
> sadece commit'e dahil et. Aşağıdaki hatalar zaten bu yeni types yüzünden ortaya çıktı.

**Hedef:** `npx tsc --noEmit` → **0 hata** (`.next/` cache hariç; gerekirse `rm -rf .next/dev/types` ile temizle).

---

## GÖREV 1/4 — audit-log.ts: ACTION_LABEL'da 11 enum eksik

#### Dosya: `src/lib/audit-log.ts` (~satır 29 `ACTION_LABEL`)

types regen ile `audit_action` enum genişledi ama `ACTION_LABEL: Record<AuditAction, string>` map'i eski
kaldı → `Record` tüm enum'ları zorunlu kıldığı için TS2740. Eksik 11 anahtarı ekle (Türkçe label):

```ts
  "customer.note_add": "Müşteri notu eklendi",
  "customer.note_delete": "Müşteri notu silindi",
  "customer.tag_add": "Müşteri etiketi eklendi",
  "customer.tag_remove": "Müşteri etiketi kaldırıldı",
  "customer.suspend": "Müşteri askıya alındı",
  "customer.unsuspend": "Müşteri askısı kaldırıldı",
  "customer.reset_password": "Müşteri şifresi sıfırlandı",
  "customer.email_sent": "Müşteriye e-posta gönderildi",
  "partner.capability_verify": "Partner yeteneği doğrulandı",
  "partner.capability_unverify": "Partner yetenek doğrulaması kaldırıldı",
  "admin.impersonate_partner": "Partner görünümüne geçildi",
```

> Eklemeden önce types.ts'teki `audit_action` enum'unun TAM listesini teyit et; map ile birebir eşleşmeli (eksik/fazla kalmasın).

**Doğrulama:** audit-log.ts'te TS2740 gider.

---

## GÖREV 2/4 — payment-validation.ts: qty_above_max reason tipte yok

#### Dosya: `src/lib/payment-validation.ts` (~satır 67 `reason` union tanımı)

P0 Görev 7'de (cf985a9) `reason: "qty_above_max"` eklendi ama `ValidationFailDetail.reason` union'ına
bu değer eklenmedi → TS2322 (satır 304).

`reason` union tip tanımına `"qty_above_max"` ekle (satır 67 civarı, diğer reason değerlerinin yanına).

**Doğrulama:** payment-validation.ts:304 TS2322 gider.

---

## GÖREV 3/4 — contour-worker-client.ts: WorkerOut tipi worker ile senkron değil (5 hata)

#### Dosya: `src/lib/editor/cutline/contour-worker-client.ts`

Client'taki `WorkerOut` tipi worker'ın gerçek çıktı union'ıyla eşleşmiyor → `data.type` / `data.error`
property'leri tipte yok (TS2339 ×5, satır 74,77,122,128,132).

Worker'ın (`contour.worker.ts:72-75`) gerçek çıktı tipleri:
```ts
type ReadyOut = { type: "ready" };
type ComputeOkOut = { id: number; paths: PathRing[][] };
type ComputeErrOut = { id: number; error: string };
type InitErrOut = { type: "error"; error: string };
```

**Fix:** Client'taki `WorkerOut` tanımını bu 4'ünün **discriminated union**'ı yap (worker.ts ile birebir):
```ts
type WorkerOut =
  | { type: "ready" }
  | { type: "error"; error: string }
  | { id: number; paths: PathRing[][] }
  | { id: number; error: string };
```
> En temizi: bu tipleri worker.ts'ten `export` edip client'ta import et (tek kaynak, tekrar drift olmasın). Mümkünse onu yap; değilse client'ta union'ı birebir kopyala. `handleWorkerMessage`/`waitForWorkerReady` içindeki `data.type`/`"id" in data`/`"error" in data` narrowing'leri bu union ile çalışır.

**Doğrulama:** contour-worker-client.ts'teki 5 TS2339 gider; worker mesaj akışı bozulmaz (`/editor` çalışır).

---

## GÖREV 4/4 — render-label-workspace.ts: Canvas≠Image tipi

#### Dosya: `src/lib/editor/pikaso/render-label-workspace.ts` (~satır 60)

`fillPatternImage: getGridPatternCanvas()` `HTMLCanvasElement` döndürüyor ama Pikaso/Konva tip tanımı
`HTMLImageElement` bekliyor → TS2740. Konva runtime'da Canvas'ı kabul eder (CanvasImageSource); sorun
sadece dar tip tanımı.

**Fix:** `fillPatternImage: getGridPatternCanvas() as unknown as HTMLImageElement` (cast). Runtime davranışı değişmez — Konva canvas pattern'i zaten destekler.

**Doğrulama:** render-label-workspace.ts:60 TS2740 gider; `/editor`'da label grid pattern görünmeye devam eder.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

1. `rm -rf .next/dev/types` (stale cache) sonra `npx tsc --noEmit` → **0 hata** (kalırsa push ETME, kalan hatayı bana bildir).
2. `git add -A` (types.ts + 4 fix dosyası birlikte).
3. `git commit -m "fix(tsc): audit enum labels + qty_above_max reason + WorkerOut union + canvas cast + types regen"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash + `npx tsc` sonucu (0 hata teyidi) bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. Görev 3-4 editör — `/editor`'da bıçak akışı hâlâ çalışmalı (regresyon yok).
> İLERİ İYİLEŞTİRME (bu turda DEĞİL): tsc temizlendikten sonra `ignoreBuildErrors: false` düşünülebilir — Sefa'ya not.
