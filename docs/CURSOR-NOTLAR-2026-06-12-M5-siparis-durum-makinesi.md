# Cursor Notları — M5: Sipariş Yaşam Döngüsü & Durum Makinesi

> Hata-tespit (P1). Boyut: D1 akış/FSM, D2 sözleşme, D4 yarış, D5 veri bütünlüğü.
> **KÖK SORUN:** `orders.status` için **merkezi geçiş guard'ı YOK**. `src/lib/order.ts`'te `VALID_SINGLE_TRANSITIONS`/`VALID_BULK_TRANSITIONS`/`isForwardStatusTransition` matrisleri **tanımlı ama yalnız admin UI + bulk-status** kullanıyor. **13+ ayrı yazar** `.update({status})` ile matrisi BYPASS ederek yazıyor; aralarında çelişen sözleşmeler var.

## 🔴 KRİTİK

### B1. `proof-respond` approve tüm üretim/atama aşamalarını ATLIYOR · D1/D5
- **Konum:** `api/orders/[id]/proof-respond/route.ts:83-90`
- **Sorun:** `proof_pending → in_production` set ediyor; `proof_approved`, `operator_print_review`, `ready_to_ship`, `fason_assigned` aşamalarını atlıyor. Sonuç: sipariş `in_production` görünür ama **hiçbir `order_assignments` kaydı yok** (fason atanmadı, kimse üretmiyor). `VALID_SINGLE_TRANSITIONS["proof_pending"]=["proof_approved","cancelled"]` (order.ts:309) yasaklamasına rağmen route guard çağırmıyor. Event `proof_approved` ama status `in_production` → drift.
- **Düzeltme:** approve hedefini `proof_approved`/`ready_to_ship` yap; üretime geçişi yalnız fason atama RPC'sine bırak; route'a `isValidBulkTransition` guard ekle. (M4-B3 ile aynı uç.)

### B3. Çoklu otomasyon + admin koşulsuz status yazıyor → iptal edilen sipariş üretime dönebiliyor · D4/D5
- **Konum:** `run-order-qc.ts:447-453`, `run-order-cutline.ts:317-323`, `resume-order-pipeline.ts:68-130`, `agents/orchestrator.ts:133-310`
- **Sorun:** Çoğu `.update({status})`'i `.eq("status",...)` guard'ı OLMADAN koşulsuz yapıyor (orchestrator'daki tüm update'ler koşulsuz). `scheduleOrderDesignQC` + `resumeOrderPipelineIfStuck` paralel tetiklenebilir (upload-status GET her açılışta resume çağırıyor). Senaryo: admin `cancelled` yaparken eşzamanlı QC pipeline koşulsuz `proof_generating` yazıyor → **cancelled→proof_generating, hiçbir guard yok**.
- **Düzeltme:** Her update'e `.eq("status", expectedFrom)` (advance-status.ts:73-74 + cancel.ts:84 doğru pattern); terminal durumlar için tüm otomasyona `.not("status","in",["cancelled","delivered"])` guard.

### B5. Fason `shipped` action koşulsuz `orders.status='shipped'` yazıyor · D1/D5
- **Konum:** `lib/fason/apply-assignment-action.ts:278-282`
- **Sorun:** FSM guard yalnız assignment.status için; orders update'i (`.eq("id",orderId)` tek başına) sipariş `cancelled` olsa bile `shipped` yazar → **cancelled→shipped**. (M6 raporundaki C8 ile aynı kök.)
- **Düzeltme:** orders update'ine `.in("status",["ready_to_ship","fason_assigned","in_production"])` guard; iptalse fason action 409.

### B8. Admin status route hiçbir geçiş matrisi uygulamıyor (serbest set + read-then-write) · D1/D4
- **Konum:** `api/admin/orders/[id]/status/route.ts:38-89`
- **Sorun:** Yalnız `isOrderStatus()` (enum geçerli mi); `getValidTransitions`/`isForwardStatusTransition` çağrılmıyor. Admin `delivered→production`, `cancelled→shipped` yapabiliyor. Update read-then-write (77 okur, 82-85 koşulsuz yazar) → iki admin yarışında biri diğerini ezer, audit `from` yanlış. Yorumda "atomic değil ama tolerable" (81).
- **Düzeltme:** `isForwardStatusTransition` veya açık override flag iste; `.eq("status", existing.status)` optimistic guard, 0 satır→409.

## 🟠 YÜKSEK

### B2. `proof-respond` request_change ölü/legacy `operator_review`'a düşürüyor · D1/D2
- **Konum:** `proof-respond/route.ts:84` — `operator_review` (order.ts:32: "modern karşılığı human_review", otomatik trigger yok). AI QC kuyruğu (`AI_QC_ACTIVE_STATUSES`) bunu içermiyor → sipariş hiçbir kuyrukta görünmeyip **müşteri değişiklik talebi sessizce kaybolabilir**.
- **Düzeltme:** Hedefi `proof_validating`/`human_review` yap; `operator_review`'u yeni yazımlardan kaldır.

### B4. `resumeOrderPipelineIfStuck` in-memory cooldown lambda'lar arası paylaşılmıyor · D4
- **Konum:** `agents/resume-order-pipeline.ts:23-24, 116-120` (`lastResumeAt = new Map()` modül-içi)
- **Sorun:** Serverless'te her lambda kendi map'i → aynı sipariş iki paralel istekte iki QC schedule → çift `proof_generating`/çift cutline/çift `proof_pending` mail.
- **Düzeltme:** Cooldown'u DB tabanlı yap (advisory lock / `qc_attempt_count` / atomik claim RPC).

### B6. Tracking endpoint koşulsuz `shipped` yazıyor; üretim zorunluluğu yok · D1/D2
- **Konum:** `api/admin/orders/[id]/tracking/route.ts:237-242` (guard yalnız `!=shipped && !=delivered`)
- **Sorun:** `awaiting_upload`/`qc_pending` siparişe tracking girince doğrudan `shipped` — üretim hiç yapılmadan. B5 ile birlikte shipped'e iki bağımsız yazar (fason + tracking) çift event.
- **Düzeltme:** Yalnız üretim-sonrası durumlardan shipped'e izin ver.

### B7. Shipment poll cron `delivered`'ı assignment'a yazıyor, `orders.status`'a YAZMIYOR → kalıcı drift · D5
- **Konum:** `api/cron/poll-shipments/route.ts:157-173` (orders update yok)
- **Sorun:** Kargo teslim olunca `order_assignments.tracking_status='delivered'` set, `orders.status` `shipped`'te kalıyor. `orders.status='delivered'` yalnız `demo-seeder.ts:194` + admin manuel dropdown'dan. Yani **gerçek akışta hiçbir sipariş otomatik `delivered` olmuyor** → `request-reviews` cron'u (status='delivered' filtreli) pratikte hiç tetiklenmeyebilir.
- **Düzeltme:** poll-shipments `justDelivered` dalında `orders.status` shipped→delivered atomik update + `order_events`. (Ürün kararı teyidi: "Doğrulanacaklar #5".)

### B9. `logOrderEvent` idempotency YOK → çift status_changed kaydı · D4/D5
- **Konum:** `lib/order-events-server.ts:37-60` (saf INSERT, unique yok)
- **Sorun:** Retry/paralel pipeline (B3/B4)/çift trigger'da aynı geçiş için 2+ event → timeline gerçeği iki kez gösterir, drift teşhisi zorlaşır.
- **Düzeltme:** `order_events`'e opsiyonel `idempotency_key` + partial unique; en azından kritik geçişlerde (cancelled, shipped, proof_approved) kullan.

### B10. `VALID_SINGLE_TRANSITIONS` ↔ `VALID_BULK_TRANSITIONS` çelişkili · D1
- **Konum:** `order.ts:283-319` — `proof_pending` single `[proof_approved,cancelled]` vs bulk `[proof_validating,proof_approved,cancelled]`; `ready_to_ship` single `[in_production,fason_assigned]` vs bulk `[in_production]`. Aynı geçiş bir endpoint'te geçerli diğerinde değil.
- **Düzeltme:** Tek `TRANSITIONS` kaynağı; bulk = single'ın alt kümesi.

### B11. `ai-qc/decide` `fix_and_proof` gerçek prova üretimini tetiklemiyor → kalıcı takılma · D2/D5
- **Konum:** `api/admin/ai-qc/decide/route.ts:90-105` — `proof_generating` set ama `runOrderCutlineGeneration`/`runProofPipeline` çağrılmıyor. `proof_generating` kısa-ömürlü durum ama hiçbir şey schedule edilmiyor; resume-pipeline `proof_generating`'i kurtarmıyor → **kalıcı takılır**.
- **Düzeltme:** decide sonrası cutline/proof pipeline schedule et veya `proof_pending`'e geçişi garantile.

### B13. `cancel` route iade rollback'i yarışa açık → para/durum tutarsızlığı · D4/D2
- **Konum:** `api/orders/[id]/cancel/route.ts:79-218`
- **Sorun:** Atomik claim doğru (79-86) ama iade başarısızsa rollback `cancelled→previousStatus` (158-161,196-200). Claim ile rollback arası başka yazar (B3 QC/admin) `cancelled`'ı değiştirirse rollback `.eq("status","cancelled")` sessizce başarısız → sipariş `cancelled` kalır ama iade reddedilmiş (**para iade edilmemiş + sipariş iptal**).
- **Düzeltme:** İade+status'u tek RPC transaction'ında; rollback başarısızsa alert/sentinel event.

## 🟡 ORTA

### B12. `revoke-assignment` revert hedefi event geçmişine güveniyor — kırılgan · D5/D4
- **Konum:** `lib/fason/revoke-assignment.ts:95-118` — eski `fason_assigned` event'inin `status_after`'ından okuyor (son 20). B9 çift event/event yokluğunda yanlış revert → **üretimde ama atanmış kimse yok** drift. (M6-C13 ile aynı.)
- **Düzeltme:** Revert hedefini deterministik kuralla belirle (`fason_assigned`/`in_production`→`ready_to_ship`).

### B14. `isForwardStatusTransition` doğru guard ama hiçbir API çağırmıyor · D1
- **Konum:** `order.ts:216-229` — terminal koruması yalnız admin UI render'ında; hiçbir endpoint server-side çağırmıyor → doğrudan POST ile geçersiz geçiş (B8).
- **Düzeltme:** Bu fonksiyonu tüm manuel/admin status route'larına server-side zorunlu kıl.

### B15. `redistribute-slot` manuel rollback atomik değil → qty/total invariant bozulabilir · D5
- **Konum:** `api/orders/[id]/redistribute-slot/route.ts:199-259` — source+target iki ayrı update; target fail'de source rollback'in (243-250) kendi hata kontrolü yok → müşterinin ödediği toplam ≠ item toplamları.
- **Düzeltme:** İki update'i tek RPC/transaction'a al.

### B16. Upload-sonrası ilerletme üç ayrı yoldan (advance-status/resume-pipeline/upload-complete) → 409 karışıklığı · D2/D4
- **Konum:** `advance-status/route.ts:45-98` vs `resume-order-pipeline.ts:122-130` vs upload-complete
- **Düzeltme:** Tek idempotent RPC giriş noktası.

### B17. `proof_generating` "geçici" sayılıyor ama kalıcılaşabiliyor · D5
- **Konum:** `run-order-qc.ts:507-528`, `run-order-cutline.ts:317-323`, `resume-order-pipeline.ts:99-113` — cutline fail + proof `operator_review` dönerse `proof_generating`'de kalır, kurtaran yok (B11 ile aynı kör nokta).
- **Düzeltme:** `proof_generating`'i `RESUMABLE_STATUSES`'a ekle; timeout-tabanlı kurtarma.

### B18. Müşteri cancel (otomatik iade) ↔ auditor cancel (manuel, iadesiz) aynı `cancelled`'a iki sözleşme · D2
- **Konum:** `cancel-no-design-order.ts:42-86` vs `cancel/route.ts` — biri PayTR iade eder biri etmez; fark yalnız event detail'inden anlaşılır.
- **Düzeltme:** İptal/iade durumunu `orders` üstünde ayrı kolonla işaretle; tek iade akışı.

### B19. `order_events.actor_role` tutarsız (aynı geçiş customer/system/admin) · D5
- **Konum:** `advance-status/route.ts:89` (customer) vs `run-order-qc.ts` (system) → audit/analitik güvenilmez.
- **Düzeltme:** Geçiş→aktör eşlemesini merkezi guard'da standartlaştır.

## [KOZMETİK]
- `order.ts:32` ölü `operator_review` enum (B2 ile ilişkili).
- `admin/orders/[id]/status/route.ts:81` "atomic değil ama tolerable" yorumu — teknik borç.
- `order.ts:283-319` iki paralel matris yorumları bayat.

## ❓ Doğrulanacaklar
1. **`fn_assign_order_to_fason`** (Mig 024) `orders.status`'u hangi from-status guard'ıyla set ediyor; `order_status_locked` sentinel hangi durumları kapsıyor (assign route.ts:140 referans, SQL okunmadı).
2. **`fn_process_proof_pending_sla`** (auto-refund) — 36sa hesabı, `proof_validating`/`operator_review`'daki sipariş SLA'ya takılır mı.
3. **DB trigger'ları** — bir DB-seviyesi transition trigger'ı var mı, yoksa tüm guard app-katmanında mı (varsa B3/B8 riskini azaltır).
4. **`orders.status` DB CHECK** — geçersiz geçişi DB engelliyor mu yoksa yalnız enum değer-geçerliliği mi.
5. **`delivered`'a geçişin manuel tasarlanıp tasarlanmadığı** (B7) — Sefa kuralı netleştirilmeli.

**En kritik:** B1 (üretim atlama) · B3 (terminal koruma/yarış) · B5+B6+B7 (shipped/delivered drift) · B8 (admin serbest set) · B9 (event idempotency).
