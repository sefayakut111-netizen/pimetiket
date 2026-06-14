# Cursor Görevi — FSM geçiş doğrulaması (regresyon guard + runtime smoke)

> 14 Haz 2026 · Claude spec. Branch: `claude/file-review-updates-vnd6og`. Amaç: bu oturumda yakalanan **FSM regresyonunu** (route'ların yazdığı geçiş matriste yoktu → 400) otomatik + kalıcı doğrula. Admin login / tarayıcı GEREKMEZ (auth derdine girme). Mig 190 zaten canlıda.

## Bağlam
Mig 180 tüm `orders.status` geçişlerini `fn_transition_order_status`'a topladı; forward matrisi (`fn_is_valid_order_forward_transition`) route gerçeğinden dar kaldı → AI-QC onay, tracking, orchestrator, resume akışları kırıldı. Mig 190 matrisi route'lara hizaladı. **Bu görev: hiçbir route'un matris-dışı geçiş yazmadığını koda döküp her merge'de kontrol et.** Referans: `docs/FSM-MATRIX-REGRESYON-2026-06-14.md` + `docs/FSM-FIX-PLAN-SECENEK-A-2026-06-14.md`.

---

## PART A — Statik route↔matris guard (ASIL teslimat, kalıcı CI)

Yeni script: `storefront/scripts/verify-fsm-transitions.mjs` + `package.json`'a `"verify:fsm": "node --env-file=.env.agent scripts/verify-fsm-transitions.mjs"`.

**Yap:**
1. `src` altında `transitionOrderStatus(` çağıran TÜM dosyaları bul (≈23: design/upload-complete, admin/orders/[id]/tracking, payment/refund, admin/orders/bulk-status, lib/agents/*, lib/proof/orchestrator + finalize-proof, lib/fason/*, lib/storage/promote-temp-designs, cron/auto-refund, admin/orders/[id]/upload-proof+upload-design, orders/admin-bypass-promote, admin/ai-qc/decide, orders/[id]/cancel + advance-status, admin/orders/[id]/status).
2. Her `transitionOrderStatus(...)` çağrısında `opts.to`, `opts.from`, `opts.mode` değerlerini çıkar. `to`/`from` dinamikse (değişken/ternary/whitelist) değişkeni dosyada izleyip **olası somut status değer kümesini** çöz; çözülemeyen tam-dinamikleri `UNKNOWN` olarak raporla (sessiz atlama YOK). `mode` yoksa varsayılan `'forward'`.
3. Her `(from→to)` çifti için mode'a göre **canlı matris fonksiyonunu** çağır (Supabase Management API, `.env.agent`'taki `SUPABASE_ACCESS_TOKEN`, proje ref `ucmpwxnoaqjpzhijnxtp`, `POST /v1/projects/{ref}/database/query`):
   - `mode='forward'` → `SELECT fn_is_valid_order_forward_transition('<from>','<to>')` TRUE olmalı.
   - `mode='bulk'` → `SELECT fn_is_valid_order_bulk_transition('<from>','<to>')` TRUE olmalı.
   - `mode='admin_override'` veya `'compensating'` → matris YOK; SADECE terminal kuralı (delivered'dan delivered-dışı, cancelled'dan cancelled-dışı YASAK) — bunu kontrol et, gerisi serbest.
   - Tek sorguda batch'le (tüm çiftleri tek `SELECT ... ` ile, performans).
4. **Çıktı:** her çağrı için `✅ dosya: from→to (mode)` / `❌ INVALID dosya: from→to (mode) — matris reddediyor` / `⚠️ UNKNOWN`. Sonunda: hiç INVALID yoksa exit 0 + "TÜM ROUTE GEÇİŞLERİ MATRİS-UYUMLU"; varsa exit 1 + liste.
> Bu, bu oturumdaki manuel denetimin kodlanmış hâli — bir daha sessiz FSM regresyonu kaçmaz. (İleride CI'a eklenebilir.)

## PART B — Runtime RPC smoke (ekstra güvence, opsiyonel ama önerilen)

Yeni script: `storefront/scripts/smoke-fsm-rpc.mjs`. Eskiden **kırık olan** geçişlerin artık gerçekten çalıştığını canlı RPC ile kanıtla — SADECE test siparişi üzerinde.

1. `adminTestOrder:true` olan bir test siparişi seç (canlıda var: 130620261227 / 130620265255 / 070620263770 — `payment->>'adminTestOrder'='true'`). Orijinal status'unu kaydet.
2. Her test için: SQL ile siparişi `from` durumuna al (örn. `UPDATE orders SET status='qc_pending' WHERE id=...`), sonra `SELECT fn_transition_order_status('<id>','<to>', ARRAY['<from>']::order_status[], '<mode>', null, 'system', 'status_changed', 'fsm-smoke', '{}'::jsonb)` çağır, dönen `ok=true` + `orders.status`=`to` + yeni `order_events` satırı assert et.
3. Test edilecek geçişler (route gerçeği): `qc_pending→ready_to_ship` (AI-QC approve), `qc_pending→human_review_failed` (reject), `qc_flagged→proof_generating` (fix), `operator_review→proof_pending` (reupload), `operator_review→proof_validating` (after-edit), `proof_generating→operator_review` (AI fail), `awaiting_upload→proof_pending` (resume).
4. **Bitince siparişi orijinal status'una geri al** (temizlik). Çıktı: her geçiş PASS/FAIL.
> ❌ Gerçek müşteri siparişine DOKUNMA (sadece adminTestOrder:true). ❌ PayTR'a girme. Bu script tek-seferlik/manuel — cron'a koyma.

---

## YAPMA (functional UI E2E bu görevde DEĞİL)
- Admin/müşteri **login**, PayTR **gerçek ödeme**, KVKK **gerçek silme** UI'dan — bunlar auth + canlı-DB riski; bu görüş dışı. (İstenirse ayrı Playwright görevi + Sefa'nın test kimlik bilgileriyle.)
- Part A matris fonksiyonlarını DEĞİŞTİRME (sadece OKU).

## Sıra
1. Cursor: Part A + Part B script'leri yaz, `npm run verify:fsm` çalıştır, çıktıyı yapıştır. `npm run build`. Commit (push yok).
2. Claude: çıktıyı doğrula (TÜM route geçişleri matris-uyumlu mu, smoke PASS mı). Yeşilse FSM fix **kapsamlı** doğrulanmış olur — merge'e güven artar.
