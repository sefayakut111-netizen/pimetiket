# Cursor Notları — M4: Onay / Prova Akışı (en yeni feature)

> Hata-tespit (P1). Boyut: D1 akış/FSM, D2 sözleşme, D5 veri bütünlüğü, D6 güvenlik.
> **KÖK SORUN:** Multi-design veri sözleşmesi KOPUK. Müşteri sayfasının tüm çok-tasarım mantığı `item.designs[]` üzerine kurulu ama tek veri kaynağı `fn_proof_summary` bu alanı HİÇ döndürmüyor. Finalize RPC ise yalnız item-seviyesi `proof_status='approved'` sayıyor — beklenen tasarım sayısını/cutline onayını bağımsız doğrulamıyor.

## 🔴 KRİTİK

### B1. `fn_proof_summary` `designs[]` döndürmüyor → sayfanın tüm multi-design mantığı çöküyor · D2/D1
- **Konum:** `supabase/migrations/059_proof_approval_flow.sql:240-259` (RPC tek `cutline` döner) ↔ `app/onay/[orderId]/page.tsx:172` (`designs: ProofDesign[]` bekler), `:515-524` (fetchProofSummary bu RPC'yi okur)
- **Sorun:** Sayfa `item.designs` üzerinden çalışıyor (`getItemDesignCount:224`, `cutlinePollSignature:800-804`, `itemAllDesignsApproved:481`, `proofTotals:477-483`). RPC `designs` üretmediği için alan daima `undefined` → 2+ tasarımlı her item "tek tasarım/legacy" dalına düşüyor; `item.cutline` (en son created_at) tek tasarım gibi davranıyor. İkinci tasarımın bıçağı eksik/onaysız olsa bile UI item'ı onaylanmış gösterip **finalize'a izin verebilir**. Çok-tasarım garantisi müşteri tarafında fiilen yok.
- **Düzeltme:** `fn_proof_summary`'yi her item için `designs` jsonb dizisi (design_file_id + o tasarımın en güncel non-superseded cutline'ı) döndürecek şekilde genişlet; veya page'i `designs` döndüren uçtan besle. (Bkz. Doğrulanacaklar #1 — admin proxy `designs` döndürüyor mu?)

### B2. `fn_finalize_proof` beklenen tasarım sayısını/cutline onayını doğrulamıyor · D1/D2/D5
- **Konum:** `supabase/migrations/162_fn_finalize_proof_atomic.sql:32-43` (eski gövde `059:343-354`)
- **Sorun:** Finalize gate yalnız `order_items.proof_status NOT IN ('approved')` sayıyor. Item `approved` ise — ama bir tasarımı supersede olmuş, yeni design_file eklenmiş ya da bir cutline `approved` değilse — finalize **yine geçer**. `getExpectedDesignCount`/`itemAllDesignsApproved` yalnız TS'te, RPC'de yok.
- **Düzeltme:** `fn_finalize_proof`'a her item için "beklenen non-superseded design_file sayısı == approved cutline sayısı" SQL kontrolü ekle (beklenen sayıyı meta.designCount + additionalDesigns'tan türet).

### B3. `proof-respond` orphan/legacy uç durum makinesini atlatıyor · D1/D2
- **Konum:** `api/orders/[id]/proof-respond/route.ts:83-90` *(M5-B1/B2 ile aynı uç — iki modül de işaretledi)*
- **Sorun:** Hâlâ canlı; `proof_pending → in_production` (approve) / `→ operator_review` (request_change). Doğru yol `proof_pending → proof_approved → operator_print_review` (Mig 162). Bu uç: per-item onay/cutline kontrolü yok, açık help_request kontrolü yok, print-ready üretimi tetiklemiyor, `operator_print_review`'u atlıyor. Frontend'de çağıran yok (orphan) ama yetkili müşteri doğrudan POST atarsa tüm onay garantilerini baypas eder.
- **Düzeltme:** Ucu kaldır veya 410 Gone; gerekiyorsa `fn_finalize_proof`'a yönlendir. (Doğrulama: eski/mobil client çağırıyor mu — git log/grep.)

## 🟠 YÜKSEK

### B4. approve'da design_file ≠ cutline_design sayım uyumsuzluğu · D2/D5
- **Konum:** `api/orders/[id]/proof/[itemId]/approve/route.ts:116-133`
- **Sorun:** `isMultiDesign = dfIds.length > 1` *design_files* sayısına bakıyor ama onay birimi *cutline_designs*. `latestCutlineForDesign` `design_file_id` eşleşmesi olmayan (NULL) auto cutline'ları görmez → eksik/yanlış cutline onaylanmış sayılabilir.
- **Düzeltme:** Onay/sayım birimini netleştir — design_file başına 1 aktif cutline; NULL design_file_id'li cutline'lar multi-design item'da reddedilsin.

### B5. help_requested çıkışı önceki `approved` durumunu sessizce kaybediyor · D1/D5
- **Konum:** `api/admin/help-requests/[id]/respond/route.ts:113-117`
- **Sorun:** Ticket çözülünce item `help_requested → pending` (ölü-kilit yok, iyi). Ama help daha önce `approved` item için açıldıysa, çözümde `pending`'e iner → önceki onay/`proof_approved_at` sıfırlanır, müşteri yeniden onaylamak zorunda. Ayrıca item-seviyesi tek `proof_status` çok-tasarımı temsil edemediği için tek tasarım için açılan help diğer onaylı tasarımları da maskeliyor.
- **Düzeltme:** Çözümde önceki proof_status'u snapshot'tan geri yükle; veya help'i design/cutline-seviyesine bağla.

### B6. Açık help_request varken item yine onaylanabilir (API guard yok) · D1/D5
- **Konum:** `approve/route.ts:97-102` (yalnız order.status kontrolü; `proof_status='help_requested'` engeli yok)
- **Sorun:** UI butonu disable ediyor (page 2674) ama API guard yok → `help_requested` item bile approve edilip `approved` olur. Ticket çözülünce `pending`'e inip onay kaybolur (B5 ile birleşir).
- **Düzeltme:** approve'da `proof_status='help_requested'` ise 400 dön.

## 🟡 ORTA

### B7. save-cutline-edit supersede yarışı; insert+supersede transaction değil · D5/D2
- **Konum:** `lib/proof/save-cutline-edit.ts:395-407`
- **Sorun:** Yeni cutline insert → sonra eski draft supersede (iki ayrı statement). İki eşzamanlı save-edit'te ikisi de "latest" non-superseded kalabilir → approve `.limit(1)` rastgele seçer. `approved` cutline hiç supersede edilmiyor → yeni draft `cutline_design_id`'yi değiştirince finalize/üretim hangi cutline'ı baz alacak belirsiz.
- **Düzeltme:** insert+supersede'i tek RPC/transaction; design_file başına "1 aktif cutline" partial unique index.

### B8. `getExpectedDesignCount` tabanı hep ≥1 → design_file 0 iken finalize'ı bloklamayabilir · D5/D1
- **Konum:** `lib/order-item-meta.ts:113-123`, `itemAllDesignsApproved:147-150`
- **Sorun:** `designs.length===0` dalı yalnız `proof_status==='approved' || cutlineIsApproved(item.cutline)`'a bakıyor; beklenen 2 tasarımdan biri hiç yüklenmediyse erken-dönüş `expected` karşılaştırmasını atlar.
- **Düzeltme:** `designs.length===0` dalına "beklenen >1 ise false" ekle; promote eksikse approve/finalize blokla.

### B9. approve sonrası kısmi onay state'i `proof_status`'ta kayboluyor · D1
- **Konum:** `approve/route.ts:214-220` — "1/2 tasarım onaylı" bilgisi item.proof_status'ta temsil edilmiyor (yalnız cutline_designs'ta); B1 nedeniyle müşteriye yansımaz.
- **Düzeltme:** B1 ile birlikte; kısmi onay state'ini design-seviyesinde tut.

### B10. `tamamlandi` sayfası proof_pending dışı TÜM statüleri "başarılı" sayıyor · D1
- **Konum:** `app/onay/[orderId]/tamamlandi/page.tsx:59-70` — yalnız `proof_pending`'de geri yönlendiriyor; `cancelled`/`awaiting_upload`/iade'de bile "Üretim Başladı" gösterir.
- **Düzeltme:** Yalnız ileri statülerde (`operator_print_review`/`proof_approved`/`in_production`) başarı göster; aksi halde `/onay`/`/siparis`'e yönlendir.

## 🔵 GÜVENLİK

### B11. save-edit `assertProofOrderAccess` kullanmıyor — dağınık guard yüzeyi · D6
- **Konum:** `api/orders/[id]/proof/[itemId]/save-edit/route.ts:99-143` — elle owner+partner kontrolü; admin/staff yetkilendirilmemiş. IDOR'un kendisi yok ama yüzey dağınık → ileride biri unutursa IDOR.
- **Düzeltme:** Tüm proof uçlarını `order-proof-access.ts`/`assertProofOrderAccess` üzerinden geçir.

## [KOZMETİK]
- K1: `editing` proof_status migration CHECK + TS union'da var ama hiçbir kod yazmıyor — ölü state.
- K2: `approve/route.ts:204-220` ↔ `281-309` büyük kod tekrarı (multi vs legacy).
- K3: `finalize/route.ts:104-112` geçersiz mail mantığı yorumu — gürültü.
- K4: `order-item-meta.ts:121` `Math.max(metaCount, 1+additional)` — designCount ek tasarımları içeriyorsa çift sayım; doğrulanmalı.

## ❓ Doğrulanacaklar
1. **Admin/partner proxy `designs` döndürüyor mu?** `proof/route.ts:100,116` proxy yanıtı `designs` içeriyorsa B1 yalnız müşteri RPC yolunda. `/api/admin/orders/[id]/proof` shape'i incelenmedi.
2. **design-url/preview-url/cmyk-preview/production-export** uçlarında `design_file_id`'nin o `order_item_id`'ye aidiyeti doğrulanıyor mu (IDOR). Bu uçlar okunmadı.
3. **NULL design_file_id'li auto cutline** gerçek veride oluşuyor mu (page 1241 bgGenDesignFileId null olabilir) — B4 etkisi.
4. **`getExpectedDesignCount` çift sayım** (K4) — `meta.designCount` additionalDesigns'ı kapsıyor mu (checkout/buildOrderItemMeta).
5. **advance-status / redistribute-slot** finalize'ı baypas eden ikinci yol içeriyor mu.

**En kritik:** B1 (designs sözleşmesi kopuk) + B2 (finalize sayım doğrulaması yok) + B3 (proof-respond baypas) — birlikte ele alınmalı; ilk ikisi multi-design garantisinin temelini, üçüncüsü FSM bütünlüğünü deliyor.
