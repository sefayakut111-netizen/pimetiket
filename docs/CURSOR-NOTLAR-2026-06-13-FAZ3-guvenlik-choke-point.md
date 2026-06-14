# Cursor Görevi — FAZ 3 Güvenlik Choke-Point'leri (KÖK-5)

> 13 Haz 2026 · Claude mimari + çok-ajanlı (doğrula→tasarım→adversaryal+final). Her bulgunun adversaryal-bulduğu holes düzeltilmiş.
> Branch: `claude/file-review-updates-vnd6og`. **Push YOK** — Claude diff doğrulayacak. (3.1 magic-byte + 3.5 impersonation FAZ 2'de yapıldı.)

## Triyaj
| # | Bulgu | Severity | Migration |
|---|---|---|---|
| 3.2 | AI bütçe guard (kontrolsüz maliyet) | high | **185** |
| 3.3 | mail suppression bypass (ETK/KVKK) | high | yok |
| 3.4 | partner meta redaksiyon (PII sızıntı) | high | yok |
| 3.6 | save-edit guard (IDOR) | low | yok |

Önerilen: 4 ayrı commit. Her biri sonunda `npm run build`. **Push etme.**

---

## 3.2) AI bütçe guard — Migration 185 + 9 guard + 7 logAiUsage
> **ALTIN KURAL:** `assertAiBudget()`/`AiBudgetExceededError` **ÜRETME** — mevcut 4 guard'ın hiçbiri throw etmiyor, hepsi `if (await isGlobalAiBudgetExceeded()) return <benign>` (chat:122, classify-ticket:63, parse-search-intent:79). Her yeni guard bu **yerel erken-return** deyimini kullanır.

### 3.2a) `storefront/supabase/migrations/185_ai_usage_sources_expand.sql` (YENİ)
```sql
-- Mig 185: ai_usage_logs source CHECK genişlet (FAZ 3.2). design_qc EKLENMEZ
-- (maliyeti design_quality_checks'te sayılıyor — çift-sayım önleme). Desen: mig 167.
alter table public.ai_usage_logs drop constraint if exists ai_usage_logs_source_check;
alter table public.ai_usage_logs add constraint ai_usage_logs_source_check
  check (source in (
    'pim_chat','pim_summarize','support_classify','search_intent','image_upscale',
    'proof_validate','cutline_feedback','cutline_vision','editor_command',
    'humanize_qc','humanize_note','daily_summary'
  ));
```

### 3.2b) `storefront/src/lib/pim/ai-usage-log.ts`
AiUsageSource union'a **7 kaynak ekle:** `proof_validate | cutline_feedback | cutline_vision | editor_command | humanize_qc | humanize_note | daily_summary`. **`design_qc` EKLEME** (çift-sayım). `isGlobalAiBudgetExceeded()` olduğu gibi kalır, throw-helper ekleme.

### 3.2c) 9 yola bütçe guard (her biri o yolun mevcut benign-return deyimiyle, **throw DEĞİL**):
| Dosya | Guard | Dönüş |
|---|---|---|
| `lib/agents/design-qc.ts` | generateObject (327) ÖNCE | erken-return `verdict:'normal',score:60,...findings:[{info,'AI bütçesi doldu—uzman gözü'}],model:'no-ai-budget-skip'` (290-314 deseni). **logAiUsage EKLEME** (design_quality_checks'te zaten sayılıyor) |
| `lib/proof/ai-validator.ts` | validateProofWithAI başı (66) | `throw new Error('ai_budget_exceeded')` — caller (orchestrator:228-236) try/catch ile yutup kural-tabanlı yola düşer (güvenli) |
| `api/pim/cutline-vision-fallback/route.ts` | rate-limit (302) SONRA | `return visionFallbackResponse(input, firstName, 'budget')` |
| `api/pim/cutline-feedback/route.ts` | try (288) DIŞINDA ÖNCE | `return {ok:true, ...buildFallbackFeedback(...), fallback:true}` |
| `lib/editor/pim-command-llm.ts` | satır 120 OPENAI_API_KEY guard'ına ekle | `if (!OPENAI_API_KEY \|\| (await isGlobalAiBudgetExceeded())) return null` |
| `api/pim/summarize/route.ts` | try (85) DIŞINDA ÖNCE | `return {ok:true, skipped:true, reason:'ai_budget_exceeded'}` (logAiUsage ZATEN var, ekleme) |
| `lib/mail/humanize-qc.ts` | satır 46 + 79 OPENAI_API_KEY guard'larına ekle | `return cleaned.slice(0,3)` / `return note` |
| `lib/mail/humanize-operator-note.ts` | satır 51 | `return note` |
| `lib/mail/generate-daily-summary.ts` | satır 65 | `return null` (caller fallback kullanır) |

### 3.2d) 7 yola `logAiUsage` (generateObject SONRASI; design_qc + summarize HARİÇ — onlar zaten loglanıyor/sayılıyor):
AI SDK v6 şekli: `logAiUsage({ source:'<X>', model:'<model>', inputTokens: result.usage?.inputTokens ?? 0, outputTokens: result.usage?.outputTokens ?? 0 })`. Yollar: ai-validator (`proof_validate`,gpt-4o), cutline-vision (`cutline_vision`,gpt-4o), cutline-feedback (`cutline_feedback`,gpt-4o-mini), pim-command-llm (`editor_command`,gpt-4o-mini), humanize-qc (`humanize_qc`,gpt-4o-mini), humanize-operator-note (`humanize_note`,gpt-4o-mini), generate-daily-summary (`daily_summary`,gpt-4o-mini). **`totalTokens` stili KOPYALAMA** (eski design-qc).

> **TRY/CATCH TUZAĞI:** cutline-feedback (catch→fallback) ve summarize (catch→502) yollarında guard'ı try **DIŞINA** koy (içine throw koyarsan summarize 502 döner = yanlış). Import: ai-validator/humanize-qc/humanize-operator-note/generate-daily-summary şu an ai-usage-log'dan import etmiyor → ekle.

---

## 3.3) mail suppression bypass — 3 route + 2 template, migration yok
> Kök: admin mail route'ları `fason_mail_outbox`'a DOĞRUDAN insert ediyor → suppression (bounce/şikayet) + idempotency BYPASS. **Üstelik bugün canlıda gönderilmiyorlar** (`admin_custom`/`password_reset` RENDERERS'ta yok → `unknown_template` dead-letter). Çözüm: `enqueueMail` + `_prerendered` React Email template.

### 3.3a) 2 yeni React Email template (auto-escape — string concat/shellHtml KULLANMA)
- `storefront/src/lib/mail/templates/admin-custom-message.tsx` — props `{recipientName?, subject, bodyText, senderEmail?}`; bodyText'i `<Text style={{whiteSpace:'pre-wrap'}}>` içinde render (JSX auto-escape — admin serbest metni saldırgan-etkili). Desen: `templates/proof-help-resolved.tsx`.
- `storefront/src/lib/mail/templates/password-reset.tsx` — props `{recipientEmail, resetLink}`; kısa transactional + `Button(href=resetLink)` (link SADECE button href'inde, hiçbir log'a değil). Desen: `order-proof-reminder.tsx` + base Button.

### 3.3b) 3 route → enqueueMail + _prerendered (fason_mail_outbox insert'lerini KALDIR; assertPermission/zod/email-lookup/audit_log KORUNUR):
| Route | idempotencyKey | Not |
|---|---|---|
| `api/admin/customers/[id]/send-email/route.ts` (78-101) | `admin_custom:${id}:${sha256(subject+body).slice(0,16)}` | `_kind:'admin_custom'` |
| `api/admin/customers/[id]/reset-password/route.ts` (80-103) | **`password_reset:${id}:${today}`** (DAILY!) | bare key kalıcı bloklar (idempotency short-circuit) |
| **`api/admin/customers/bulk/email/route.ts` (72-90)** | `admin_custom_bulk:${userId}:${hash}` | ⚠️ **TASARIM BUNU ATLAMIŞTI** — aynı bypass, müşteri liste UI'ına bağlı; 3'ünü de dönüştür yoksa açık kalır |

Her biri: `const html = await render(<Template .../>)` → `enqueueMail({templateKey:'_prerendered', to, category:'customer', targetType:'user', targetId, subject, payload:{subject,html,text,_kind,_user_id}, idempotencyKey})`. `result.suppressed===true` **HATA DEĞİL** → `{ok:true, suppressed:true}` dön (UI "adres engelli" göstersin). `_prerendered` RENDERERS'ta zaten kayıtlı — yeni key ekleme.

---

## 3.4) partner meta redaksiyon — helper + 2 endpoint, migration yok
> Kök: partner uçları `order_items.meta`'yı REDAKSİYONSUZ dönüyor → müşteri PII'si (designFileName/preview URL/serbest alanlar) fason partnerine sızıyor.

### 3.4a) `src/lib/fason/redact-order-address.ts` sonuna `redactItemMetaForPartner` ekle
Whitelist (yalnız listelenenler kopyalanır, gerisi düşer). **`material_type` ZORUNLU** ⚠️:
```ts
export function redactItemMetaForPartner(meta: Record<string,unknown> | null | undefined): Record<string,unknown> | null {
  if (!meta) return null;
  const out: Record<string,unknown> = {};
  const copyString=(k:string)=>{const v=meta[k]; if(typeof v==="string"&&v.trim())out[k]=v.trim();};
  const copyNumber=(k:string)=>{const v=meta[k]; if(typeof v==="number"&&Number.isFinite(v))out[k]=v;};
  const copyBoolean=(k:string)=>{const v=meta[k]; if(typeof v==="boolean")out[k]=v;};
  copyString("shape"); copyString("cut"); copyString("material");
  copyString("material_type"); // KRİTİK: partner editör malzeme kilidi bunu okur
  copyString("finish"); copyBoolean("softCorners");
  copyNumber("winding"); copyNumber("coreSize"); copyNumber("rollLabelCount");
  copyNumber("hediyeAdet"); copyNumber("designCount");
  return out;
}
```
> **`material_type` atlanırsa** partner revize editörü (`partner/siparisler/[id]/duzenle/[itemId]/page.tsx:151-153`) malzemeyi okuyamaz → transparent/holo/metallic işler 'paper'a düşer → **white-ink bıçağı bozulur** (üretim hatası, kozmetik değil).

### 3.4b) 2 endpoint
- `src/app/api/partner/orders/[id]/route.ts`: import ekle; satır 211 `meta: it.meta` → `meta: redactItemMetaForPartner(it.meta)`.
- `src/app/api/fason/info/[token]/route.ts` (**auth'suz public — en katı**): satır 95 items map'inde `meta: redactItemMetaForPartner(it.meta) ?? {}` (fason frontend `meta: Record<string,unknown>` non-null beklediği için **`?? {}`**).

> Kapsam notu: `assignment.notes` (B2) + `items[].config` (B5) aynı uçlarda hâlâ HAM — ayrı FAZ item'ları, bu fix onları kapatmaz.

---

## 3.6) save-edit guard (IDOR) — 2-3 TS, migration yok, **low**
> Kök: `save-edit` endpoint'i manuel guard kullanıyor; `assertProofOrderAccess`'e taşı. Ama tasarımın yarım-fix riski: guard geçse de **stage-gate admin/staff'ı hâlâ bloklar** → editorPromote ile bypass gerekir.

### 3.6a) `storefront/src/lib/proof/order-proof-access.ts`
Success variant'a `actor` ekle: `{ ok: true }` → `{ ok: true; actor: 'owner'|'admin'|'staff'|'partner' }`. Her success return'e actor: owner(29)→'owner', admin/staff(40)→`role==='admin'?'admin':'staff'`, partner(55)→'partner'. **401/403/404 dönüşlerine + assertProductionExportAccess/getCutlinePreviewKey'e DOKUNMA** (geriye-uyumlu — 3 okur sadece access.ok/status okuyor).

### 3.6b) `storefront/src/app/api/orders/[id]/proof/[itemId]/save-edit/route.ts`
- `assertActivePartnerAssignment` import KALDIR, `assertProofOrderAccess` ekle.
- Satır 99-143 manuel guard yerine: `const access = await assertProofOrderAccess(admin, orderId, user.id); if(!access.ok) return ...access.status`. Owner user_id için ayrı reselect (`orders.select('user_id')` → `ownerUserId`).
- `isPartner = access.actor==='partner'`; `isStaff = access.actor in ('admin','staff')`.
- saveCutlineEdit çağrısına **`editorPromote: isStaff`** ekle (admin/staff stage-gate bypass — `onay/duzenle` admin'e editörü zaten açıyor, route'un 403 vermesi bug). Partner-revise mail `userId: ownerUserId`.

### 3.6c) `storefront/src/lib/proof/save-cutline-edit.ts` (OPSİYONEL — audit doğruluğu)
order_events actor_role admin/staff edit'i şu an 'customer' loglar. actorRole arg union'ına `'admin'|'staff'` ekle + satır 431'de kullan. **Atlanırsa** admin edit'i 'customer' loglanır (zararsız ama yanlış); editorPromote stage-gate fix'i (3.6b) **ZORUNLU**, bu opsiyonel.

> **Davranış değişikliği:** admin/staff artık save-edit POST edebilir. Bu, `onay/duzenle` sayfasının zaten açtığı (ama 403 alan) akışı **düzeltir** — Sefa onayı: operatör cutline edit'i isteniyor (evet, belgelenmiş akış).

---

## DİKKAT (yapma listesi — adversaryal düzeltmeler)
- ❌ AI: `assertAiBudget`/throw-helper üretme (yerel guard-return); design_qc'ye logAiUsage ekleme (çift-sayım); guard'ı summarize/cutline-feedback try'ı İÇİNE koyma; migration no 168 (→185).
- ❌ Mail: string-concat/shellHtml ile HTML (React Email template); password_reset bare idempotency key (→daily); 3. route'u (bulk) atlama; suppressed'i hata sayma.
- ❌ Partner-meta: `material_type`'ı whitelist'ten atlama; fason/info'da `?? {}` unutma.
- ❌ save-edit: editorPromote'u atlama (yarım fix); access error dönüşlerini değiştirme.
- ❌ Push etme.

## Sefa'ya bayrak (ayrı iş — bu PR'da YAPMA)
1. **cat='all' unsubscribe** `blocked_categories=NULL` saklıyor → `fn_is_suppressed` "tüm kategori blokla" sayıyor → password_reset suppression'a girince **tüm-pazarlamadan çıkan kullanıcı şifre sıfırlama alamayabilir** (076 KVKK m.5/2-c niyetiyle çelişir). Ayrı migration: cat='all'→`['lead','marketing']` sakla veya fn_is_suppressed düzelt.
2. partner uçlarında `assignment.notes` (B2) + `items[].config` (B5) hâlâ HAM PII — ayrı FAZ item'ları.

## Sıra
1. Cursor: 4 fix uygula (AI mig 185 canlıya uygula; TS'ler build). `npm run build`. Logical commit (push yok).
2. Claude: mig 185 canlı + 4 diff adversaryal doğrula.
