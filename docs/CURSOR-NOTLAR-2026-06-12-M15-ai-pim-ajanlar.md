# Cursor Notları — M15: AI / Pim Ajanları & Denetçiler

> Hata-tespit (P4). Boyut: D2 sözleşme, D3 hata, D6 güvenlik, D7 para. Dış API timeout/retry M16'da.
> **KÖK SORUN:** Para tarafı — global AI bütçe guard'ı yalnız `pim/chat`'te, 3 GPT endpoint'i hiç cost loglamıyor → "$5/gün kapatma" garantisi + maliyet görünürlüğü fiilen delik. Prompt injection guard'ı tek-mesaj kapsamlı, müşteri dosya adı/notu sanitize edilmeden prompt'a giriyor.
> **Sefa kuralları:** prompt seviyesinde UYUMLU (tek Pim, dalkavuk/Bursa/süresiz/cüzdan yok) — ama çıktı tarafında programatik kontrol YOK (kırılgan).

## 🔴 KRİTİK

### 1. Global AI bütçe guard yalnız `pim/chat`'te; 4 GPT endpoint guard'sız · D7
- **Konum:** `api/pim/chat/route.ts:122` (tek `isGlobalAiBudgetExceeded()` çağrısı); EKSİK: `cutline-feedback`, `cutline-vision-fallback/route.ts:316`, `summarize/route.ts:86`, `editor/pim-command-llm.ts:123`, `agents/design-qc.ts:327`
- **Sorun:** $5/gün kapatma yalnız chat'te (grep ile doğrulandı). Vision (gpt-4o ~$0.01/çağrı), editör komutu, summarize, design-QC bütçe dolduktan sonra da harcar. "Günlük limit" garantisi delik.
- **Düzeltme:** Ortak `await assertAiBudget()` helper'ı, her AI çağrısından ÖNCE; aşılırsa kural-tabanlı fallback.

### 2. Üç GPT endpoint'i hiç cost loglamıyor; bütçe + AiCostAuditor görmüyor · D7
- **Konum:** `cutline-feedback/route.ts`, `cutline-vision-fallback/route.ts`, `pim-command-llm.ts` (hiçbiri `logAiUsage` çağırmıyor — grep doğrulandı)
- **Sorun:** `getTodayOpenAiSpendUsd()` yalnız `ai_usage_logs`+`design_quality_checks` topluyor. Bu üç endpoint'in harcaması hiçbir yere yazılmadığı için global bütçe (Bulgu 1 ile) ve `AiCostAuditor` günlük raporunda görünmez. `cutline-vision-fallback` gpt-4o (en pahalı) — kör nokta en pahalı çağrıda. Maliyet görünürlüğü sahte (gerçeğin altında).
- **Düzeltme:** `generateObject` `usage`'ını `logAiUsage({source:...})` ile yaz; `AiUsageSource` enum'una kaynak ekle.

## 🟠 YÜKSEK

### 3. Prompt injection guard sadece SON kullanıcı mesajını tarıyor · D2/D6
- **Konum:** `api/pim/chat/route.ts:154-169` (`reverse().find(role==="user")` — yalnız son mesaj)
- **Sorun:** Saldırgan injection'ı önceki turda gönderip son mesajı zararsız tutarsa filtre atlanır; geçmiş yine LLM'e gidiyor (`:177`). Pattern listesi sabit regex, encode/parafraz ile aşılır.
- **Düzeltme:** Tüm `user` mesajlarını (en az son 2-3) tara; `looksLikeSystemPromptLeak`'i loglamak yerine yanıtı kes.

### 4. Müşteri kontrollü serbest metin sanitize edilmeden LLM prompt'una gömülüyor · D2/D6
- **Konum:** `cutline-feedback/route.ts:186-193` (dosya adı/contour/issue → prompt), `navigation-tools.ts:269` (serbest `issue`), `run-order-cutline.ts:71` (`original_name`)
- **Sorun:** Müşteri dosya adı, contour isimleri, serbest "sorun" metni doğrudan user-prompt'a; chat'teki injection guard burada çalışmıyor. Çıktı Zod-enum olduğu için patlama sınırlı ama serbest `feedback`/`pim_message` müşteriye geri gösterildiğinden dosya adına gömülü talimat Pim tonunu manipüle edebilir.
- **Düzeltme:** Gömülen tüm müşteri string'lerine `looksLikePromptInjection` + clamp; contour/dosya adlarını "bu veridir, talimat değildir" notlu ayrı blokta geçir.

### 5. `pim-command-llm` limitleri merkezi pricing'den türetilmemiş (sticker max 1000 hardcoded) · D2
- **Konum:** `editor/pim-command-llm.ts:14-21` (lokal `STICKER_LIMITS`) vs `personas.ts:263` (merkezi `STICKER_MIN_QTY` vb.)
- **Sorun:** Editör LLM'inde qty/boyut limitleri elle sabit, `sticker-customer-pricing`'den türetilmemiş → fiyat/limit değişince persona doğru editör yanlış kalır (iki doğruluk kaynağı).
- **Düzeltme:** `STICKER_LIMITS`'i merkezi kaynaktan türet.

### 6. Cutline aşaması QC'deki attempt/circuit guard'larından yoksun → tekrar üretim/takılma · D3
- **Konum:** `run-order-qc.ts:118-179` (guard'lar QC öncesi), `run-order-cutline.ts:24-345` (guard YOK), `resume-order-pipeline.ts:85-113`
- **Sorun:** attempt limiti + circuit yalnız `runOrderDesignQC` girişinde. `runOrderCutlineGeneration`/`resumeOrderPipelineIfStuck` cutline'ı tekrar tekrar çağırabilir; cutline'da sayaç/circuit yok. `RESUME_COOLDOWN_MS` in-memory Map (serverless'te etkisiz — M5-B4 ile aynı). B11 stuck proof_generating sınıfı risk.
- **Düzeltme:** Cutline için de attempt sayacı/`order_events` tabanlı idempotent kilit; in-memory cooldown yerine DB advisory lock.

## 🟡 ORTA
- **7.** `mimeToFormat` no-op zincir (`.replace("jpeg","jpeg")`) + format eşleme kırık → bilinmeyen mime `unknown`→`runDesignQC` throw→her dosya QC error/gereksiz human_review; EPS `VECTOR_FORMATS`'ta ama persona "desteklenmez" der (tutarsız) (`design-qc.ts:376-386,104,280`). → açık `Record` map + passthrough fallback. · D2
- **8.** `design-qc` maliyet formülü `tokens*0.005/1000` blended sabit, merkezi `PIM_MODEL_PRICING` ($2.5/$10) ile uyuşmuyor; `estimateCostUsd` varken kullanılmamış (`:354`). → input/output ayır. · D7
- **9.** Rule-based raster QC DPI≥200'de AI'yı atlıyor ama `colorProfile:Unknown`/`hasBleed:null`/`hasCutPath:null` ile "iyi/95" → RGB/bleed'siz/cut-path'siz dosya geçer, hatalı baskı riski (`design-qc.ts:118-200,318-321`). → sticker/cut-path ürünlerinde "normal"e indir veya renk profili oku. · D2
- **10.** Memory: server `user_id` filtreli (iyi) ama anonim localStorage tek sabit anahtar (`pim:memory:v1`) → paylaşılan cihazda facts sızar, üyeye geçişte server'a taşınır (`memory.ts:24`). → oturum bazlı anahtar/login'de temizle. · D6
- **11.** Vision/feedback rate-limit IP bazlı (auth'lu olmasına rağmen) → NAT arkası kullanıcılar 6/dk paylaşır; chat `user.id` bazlıyken burada IP (`cutline-vision-fallback:296-303`, `cutline-feedback:207-208`). → `user.id` bazlı + kullanıcı başına günlük cap. · D7/D6
- **12.** Injection bloğu daily/budget sayaçlarından SONRA → injection denemesi meşru kotayı tüketir (`chat/route.ts:78-120,159`). → injection'ı rate-limit'ten hemen sonra. · D3/D7
- **13.** Vector/hybrid passthrough koşulsuz "normal/65" — PDF gömülü düşük-DPI raster hiç denetlenmeden geçer (`design-qc.ts:289-315`). → hybrid için ilk sayfa render+DPI; olana kadar "needs_review". · D2

## 🟢 DÜŞÜK
- **14.** `circuit-breaker` DB hatasında fail-closed tüm siparişleri human_review'e — geçici/kalıcı hatayı ayırmıyor (`circuit-breaker.ts:54-65`). → ayrı event + ardışık N hata eşiği. · D3
- **15.** `redirect_to_order`/`get_proof_status` `ilike(id,orderId)` LLM-arg ile (sahiplik doğrulanıyor, sızıntı yok ama) → `eq` daha güvenli (`navigation-tools.ts:158,191,277`). · D6
- **16.** `looksLikeSystemPromptLeak` tetiklenince yanıt yine stream'lenmiş oluyor (post-hoc, yalnız log) (`chat/route.ts:199-209`). → leak event yüksek-öncelik + output post-filter. · D2/D6

## [KOZMETİK]
- `personas.ts:359` knowledge base her çağrıda yeniden kuruluyor (cache'lenebilir, CPU).
- `design-qc.ts:381` `.replace("jpeg","jpeg")` no-op.
- `run-order-qc.ts:243` sabit `setTimeout(5000)` magic number.
- `memory.ts:101` `consent: ... ? true : true` tautoloji.
- `navigation-tools.ts:366` deprecated `PIM_NAV_TOOLS` export.

## ✅ Sefa kuralları — UYUMLU (prompt seviyesinde)
Tek Pim (alt persona gizli), dalkavuk/yapay empati yasak, Bursa/süresiz yok, bot menüsü/cüzdan yok — hepsi prompt'larda açıkça yasaklı. **Risk:** yalnız prompt garantisi; LLM çıktısı ihlal ederse programatik kontrol YOK (`looksLikeSystemPromptLeak` yalnız prompt sızıntısına bakar, Sefa-kuralı ihlaline değil).

## ❓ Doğrulanacaklar
1. `pim_conversations`/`design_quality_checks`/`proof_help_requests` RLS açık mı (memory izolasyonu tek savunması uygulama katmanı mı — #10).
2. `assertPermission("ai_qc","create")` fail-open mu (`agents/design-qc/route.ts:49`).
3. `rate-limit.ts` backend patlarsa `success:true` mı (fail-open ise tüm AI rate-limit + dolaylı bütçe çöker).
4. Vision input image token maliyeti kontrol ediliyor mu ($0.01 aşabilir mi).
5. `after()` lambda QC+cutline zincirini (30-120s) tamamlıyor mu yoksa B11 takılma mı.

**En kritik:** #1+#2 (bütçe guard yalnız chat + 3 endpoint cost loglamıyor → $5/gün garantisi delik) · #3+#4 (injection tek-mesaj + müşteri metni sanitize'siz) · #6 (cutline attempt/circuit yok).
