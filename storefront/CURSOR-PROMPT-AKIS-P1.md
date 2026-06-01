# Akış Denetimi — 19 Doğrulanmış P1 (fason güvenlik + upload/QC + arşiv)

Dosya→fason→arşiv akış denetiminin (1 Haz, 37 ajan, adversaryal doğrulama) **doğrulanmış P1'leri**.
5 P0 zaten kapandı (commit 77d80f7). file:line kanıtlı. 3 tema.

> ÖN KOŞUL: İçerik-UX P1 + Dalga 3 commit'i push edilmiş olmalı (önce o, sonra bu). Çakışan dosya yok.
> Migration: dosya yaz + push, **apply Sefa Supabase'de manuel**. Sıradaki no = `supabase/migrations/` en yüksek (135) + 1 = **136**.
> Sefa kuralları: cüzdan/puan yok, partner'a ₺ yok.

---

# TEMA A — FASON GÜVENLİK (9 görev)

## A1 — Auto-assign trigger hataları sessizce yutuyor [flow-break]
#### `supabase/migrations/<136>_*.sql` (CREATE OR REPLACE trigger fn)
Mig 068:160-163 `exception when others then return NEW;` tüm hataları yutuyor → atama yapılmaz, order `ready_to_ship`'te takılır, **neden bilinmez**.
**Fix:** Exception bloğuna log ekle: `insert into public.order_events (order_id, event_type, actor_role, summary) values (NEW.id, 'auto_assign_failed', 'system', SQLERRM);` sonra `return NEW`. Trigger fonksiyonunu Mig 068'den al, CREATE OR REPLACE ile bu logu ekle.
**Doğrulama:** Atama başarısız olunca order_events'te `auto_assign_failed` + sebep görünür.

## A2 — fason/suggest legacy fallback sözleşmesiz partner döndürüyor [flow-break]
#### `src/app/api/admin/fason/suggest/route.ts` (~satır 49-79)
productType+specialty ikisi de yoksa `fn_find_best_partner` bypass edilip ham `eq('status','active')` sorgusu → sözleşme/capability guard atlanıyor.
**Fix:** Legacy path'e contract guard ekle: `.eq('status','active').not('contract_signed_at','is',null)` (veya `.or('contract_pdf_url.not.is.null')`). Daha temiz: her şartta `fn_find_best_partner` çağır.
**Doğrulama:** Sözleşmesiz partner suggest sonucunda çıkmaz.

## A3 — Durum geçişinde FSM yok [idempotency]
#### `src/lib/fason/apply-assignment-action.ts` (~satır 183-249)
Mevcut status okunmadan UPDATE → `shipped` sonrası `in_production` yazılabilir (geçersiz geçiş).
**Fix:** Önce mevcut `order_assignments.status` oku, FSM map ile kontrol: `acknowledge` ⊂ {assigned,sent}, `in_production` ⊂ {acknowledged}, `ready` ⊂ {in_production}, `shipped` ⊂ {ready}. Geçersizse 409.
**Doğrulama:** Geçersiz geçiş 409; geçerli akış çalışır.

## A4 — Partner status update yanlış atamayı kullanıyor [security]
#### `src/app/api/partner/orders/[id]/status/route.ts` (~satır 80-88)
`order('assigned_at' desc).limit(1)` en son atamayı alıyor — cancelled olabilir. A'ya atanıp cancelled, B'ye atanınca yanlış satır okunabilir.
**Fix:** Cross-tenant guard'a status filtresi: `.in('status', ['assigned','sent','acknowledged','in_production','ready']).limit(1)` (sadece aktif atama).
**Doğrulama:** Cancelled atama partner guard'ında okunmaz.

## A5 — fn_find_best_partner boş string material filtresini atlatıyor [flow-break]
#### `src/app/api/admin/fason/suggest/route.ts` (~satır 91)
Suggest route `p_material: material ?? ''` gönderiyor; `'' is null` false → material filtresi atlanıyor.
**Fix:** `material` null ise `p_material: null` geç (boş string değil). (Veya Mig'de `p_material is null or p_material = ''` genişlet — ama route fix daha basit.)
**Doğrulama:** Material belirtilmemişse filtre uygulanmaz; belirtilince doğru filtreler.

## A6 — fn_validate_fason_token tekrar authenticated'a grant edilmiş [security] 🔴
#### Yeni migration `<136>` (grant düzeltme)
Mig 023 `fn_validate_fason_token`'ı authenticated'tan revoke etmişti (güvenlik P0); Mig 089:138 + Mig 132:78 **tekrar grant** vermiş → revoke geçersiz. Sıradan auth user token validate edebilir.
**Fix:** Yeni migration: `revoke execute on function public.fn_validate_fason_token(text) from authenticated;` + `grant execute ... to service_role;`. (Endpoint zaten service-role admin client kullanıyor — DOĞRULA, kırılmasın.)
**Doğrulama:** authenticated rol token RPC'sini çağıramaz; fason download endpoint'i (service-role) çalışır.

## A7 — Plain-text token outbox'ta 30 gün [security]
#### `supabase/migrations/<136>` (fn_assign_order_to_fason güncelle)
Mig 092:81-99 `fason_mail_outbox` payload'una ham `fason_token` düz metin yazıyor; 30 gün duruyor (Mig 025 sonra temizler).
**Fix:** Payload'a ham token yerine `assignment_id` yaz; mail worker gönderim anında token'ı `fason_access_tokens`'tan hash ile bulur veya fresh üretir. `fn_assign_order_to_fason`'u CREATE OR REPLACE ile güncelle.
> Mail gönderim worker'ının token'ı payload'dan okuduğu yeri de güncelle (assignment_id'den çöz).
**Doğrulama:** Outbox payload'unda ham token yok; mail yine doğru token ile gider.

## A8 — file-transfers iptal edilmiş assignment ile transfer [security]
#### `src/app/api/admin/fason/partners/[id]/file-transfers/route.ts` (~satır 101-106)
Assignment status filtrelenmiyor → cancelled/issue assignment ile dosya transferi mümkün.
**Fix:** Assignment sorgusuna `.in('status', ['assigned','sent','acknowledged','in_production','ready','shipped'])` ekle.
**Doğrulama:** Cancelled assignment ile transfer reddedilir.

## A9 — use_count download fail'de bile artıyor [idempotency]
#### `src/app/api/fason/download/[token]/route.ts`
`fn_validate_fason_token` içinde `use_count++` (Mig 132); ama signed URL/dosya başarısız olursa use_count geri alınamaz → token_limit_exceeded ile haksız servis kesintisi.
**Fix:** use_count artışını RPC'den çıkar; sadece signed URL **başarıyla** üretildikten sonra ayrı UPDATE ile artır (access log INSERT'in hemen öncesi).
**Doğrulama:** Download fail → use_count artmaz; başarı → artar.

---

# TEMA B — UPLOAD / QC / PROMOTE (6 görev)

## B1 — Promote idempotency guard hardcoded .png [idempotency] 🔴
#### `src/lib/storage/promote-temp-designs.ts` (~satır 132)
`orderPath = ${orderId}/${designTempId}.png` sabit — PDF/AI/PSD kaçıyor → dedup SELECT eşleşmez → çift promote veya silent abort.
**Fix:** satır 177'deki gerçek `fileName` türetmesini satır 132'de de kullan (temp.storage_path'ten uzantı). orderPath ve newPath aynı kaynaktan.
**Doğrulama:** PDF dosyada çift IPN → tek design_files row.

## B2 — promoteEditorCutlines sessizce atlıyor → editör cutline kaybı [orphan]
#### `src/lib/editor/promote-editor-cutline.ts` (~satır 78-94)
design_files row henüz yoksa (B1 bug'ı veya storage fail) designFileId null → cutline promote sessizce skip → müşterinin editör çizdiği bıçak **kalıcı kayıp**.
**Fix:** Başarısız cutline promote'ları order_item.meta'ya draft_id olarak işaretle; design_files row sonradan oluşunca yeniden dene. (Veya cutline promote'u design promote'tan ayır, sıralı garanti et.)
**Doğrulama:** design_files gecikse bile editör cutline kaybolmaz (retry).

## B3 — Kötü QC verdict üretimi durdurmuyor [flow-break]
#### `src/lib/agents/run-order-qc.ts` (~satır 397-402)
`aggregateVerdict` sadece `error > 0` ise human_review'a yönlendiriyor; `kotu` verdict proof_generating'e geçiyor → AI "kötü" dese bile müşteriye prova gidiyor.
**Fix:** `const needsHumanReview = verdictCounts.error > 0 || verdictCounts.kotu > 0;` (kotu → human_review).
**Doğrulama:** Kötü tasarım proof'a değil human_review'a düşer.

## B4 — Multi-design print-ready PDF sadece son dosyayı kullanıyor [data-loss] 🔴
#### `src/lib/proof/print-ready.ts` (~satır 430-437)
`order('version' desc).limit(1)` her order_item için TEK dosya; Mig 063 multi-design ekledi → bir item N tasarım olabilir, diğerleri baskıya GİTMİYOR.
**Fix:** `.limit(1)` yerine `.neq('status','superseded')` ile tüm aktif design_file'ları çek; her biri için ayrı PDF sayfası/dosya üret.
**Doğrulama:** 3 tasarımlı item → print-ready 3'ünü de içerir.

## B5 — SVG inline serve → stored XSS [security]
#### `src/app/api/orders/[id]/items/[itemId]/design-file/route.ts` (~satır 66-74)
`Content-Type: mime_type` → SVG `image/svg+xml` inline serve → içindeki `<script>`/`onload` admin/operatör tarayıcısında çalışır.
**Fix:** SVG için `Content-Disposition: attachment` zorla VEYA `Content-Type: application/octet-stream`. Ek: magic-byte doğrulamasına `<script`/`on*` pattern taraması ekle.
**Doğrulama:** Zararlı SVG admin proof ekranında script çalıştırmaz (indirilir).

## B6 — partner_revised sonrası müşteriye mail yok [orphan]
#### `src/app/api/partner/orders/[id]/items/[itemId]/upload-revision/route.ts` (~satır 249) + saveCutlineEdit isPartner yolu
Kod yorumu (satır 21): "TODO: müşteriye mail". Partner revize sonrası `proof_status='partner_revised'` ama müşteri haberdar olmuyor → tekrar onaya gitmesi gerektiğini bilmiyor.
**Fix:** Mevcut `sendOrderProofRequired` fonksiyonunu partner revize sonrası çağır (her iki yolda — upload-revision + saveCutlineEdit isPartner).
**Doğrulama:** Partner revize → müşteriye "tekrar onay" maili gider.

---

# TEMA C — ARŞİV BÜTÜNLÜĞÜ (4 görev)

## C1 — R2 upload checksum doğrulamadan Supabase siliniyor [data-loss] 🔴
#### `src/lib/storage/archive-service.ts` (~satır 213-243)
R2 PutObject 200 → 'success' kabul → Supabase orijinali siliniyor. Bütünlük doğrulanmıyor. Mig 026 `checksum_verified` kolonu var ama kullanılmıyor.
**Fix:** `uploadToR2Archive()` sonrası `getR2ObjectInfo(r2Key)` ile `ContentLength === buffer.length` doğrula. Eşleşmezse Supabase'i SİLME + 'cold' yapma; `checksum_verified=false` set + logla.
**Doğrulama:** Bozuk/eksik R2 upload'ta orijinal Supabase'de KALIR.

## C2 — Kısmi arşivde Storage silinince rollback yok [data-loss]
#### `src/lib/storage/archive-service.ts` (~satır 229-243)
R2 upload OK → Postgres 'cold' → Supabase delete. Postgres update fail'de R2'de var ama Supabase silinmiş + Postgres tutarsız → erişilemez dosya.
**Fix:** Postgres update + Storage delete tek try bloğunda. Postgres fail → R2'deki yeni yükleneni geri al (sil). VEYA: önce 'archiving' işareti → R2 upload → Storage delete → 'cold' (idempotent sıra). (C1 ile birleşik yap.)
**Doğrulama:** Postgres fail senaryosunda dosya erişilebilir kalır.

## C3 — fn_mark_expired_designs_for_deletion cold dosyaları atlıyor [archive]
#### `supabase/migrations/<136>` (fn güncelle)
Mig 028:52 `AND df.archived_at IS NULL` → cold storage'a taşınmış + süresi geçmiş dosyalar **hiç silinmiyor** → KVKK süresi sonrası R2'de kalıcı kalır.
**Fix:** `fn_mark_expired_designs_for_deletion`'dan `AND archived_at IS NULL` kaldır (veya ayrı `fn_mark_expired_cold_designs`). Cron'da cold dosya için R2 delete yolu.
**Doğrulama:** Süresi geçmiş cold dosya silme için işaretlenir.

## C4 — fn_renew_design_retention cold dosya retention uzatmıyor [data-loss]
#### `supabase/migrations/<136>` (fn güncelle) + `restore-service.ts`
Mig 026:94-98 `AND archived_at IS NULL` → reorder gelince cold dosyanın deletion_due_at'ı uzamıyor → müşteri tekrar sipariş verse bile eski dosya silinebilir.
**Fix:** `fn_renew_design_retention`'dan `AND archived_at IS NULL` kaldır; cold dosya için de `deletion_due_at = now() + interval '24 months'`. (P0 restore fix ile birleşik — restore-service.ts'e de yansıt.)
**Doğrulama:** Reorder → cold dosya retention 24 ay uzar.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

1. `rm -rf .next/dev/types` sonra `npx tsc --noEmit` → 0 hata (kalırsa push etme).
2. `git add -A`
3. `git commit -m "fix(akis-p1): fason guvenlik (FSM+token grant+transfer guard) + multi-design PDF + SVG XSS + arsiv checksum+retention"`
4. `git push origin main` → Vercel deploy.
5. **Migration (A1,A6,A7,C3,C4):** push edildi, **Supabase'de apply EDİLMEDİ** → Sefa'ya bildir: "Mig 136 (+varsa ek) Studio'da apply et."
6. Deploy READY → commit hash + canlı URL + apply bekleyen migration listesi bildir.

> Git kökü `pim-etiket/core/`. 🔴 işaretli (A6 token grant, B1 promote, B4 multi-PDF, C1 checksum) en kritik —
> bunlar veri kaybı/güvenlik. Çok migration varsa tek dosyada birleştir (136) ya da 136/137 böl, sıra koru.
