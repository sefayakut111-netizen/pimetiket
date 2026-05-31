# Editör — Kenar-Durum Fix (boyut/yerleşim kaybı + çift export)

> Commit `9c78f9c` (tek panel workbench) sonrası Claude kod-review'ından çıkan 3 davranış bugu.
> Hepsi "kullanıcının elle yaptığı boyut/yerleşim sessizce kayboluyor" + "DB'de yetim draft" temasında.
> Sırayla uygula. Dosyalar: `src/components/editor/EditorShell.tsx`, `public/poc.html`,
> `src/components/editor/EditorPreviewToolbar.tsx`.
>
> KISITLAR: `/onay` ve `/duzenle` akışına DOKUNMA — bunlar sipariş-sonrası, ayrı. POC'ta sadece
> `PIM_PARAMS.standalone` (pre-order editör) dalını değiştir; `embed`/normal dalı bozma.
> Sefa kuralları geçerli (CLAUDE.md). `tsc --noEmit` temiz kalmalı.

---

## GÖREV 1/3 — bg-remove sonrası boyut override'ını koru (🔴 veri kaybı)

**Sorun:** `src/components/editor/EditorShell.tsx` içinde `dimsAppliedRef`, `design?.tempId`
değişince null'lanıyor (≈L77-79 `useEffect`). Arka plan kaldırma (`removeBackground`, ≈L344)
**yeni tempId** üretip `setDesign` çağırıyor → iframe reload → yeni `pim-poc-loaded` →
kontur modunda (`selectedTpl` yokken) `handleDesignLoaded` `suggestMmFromPixels`'i **yeniden**
uygular → kullanıcının Adım 3'te elle girdiği mm (ör. 80mm) önerilen değere (ör. 50mm) **geri döner.**

**Mimari (neden):** Arka plan kaldırma fiziksel baskı boyutunu DEĞİŞTİRMEZ — sadece pikselin
alfa kanalını temizler. Dolayısıyla bg-remove'dan doğan türev görselde boyut önerisi **hiç
tetiklenmemeli**; mevcut `widthMm/heightMm/aspect` React state'i korunmalı.

**Yapılacak:**
1. Bir `skipDimResetRef = useRef(false)` ekle.
2. `dimsAppliedRef` reset eden `useEffect`'i şuna çevir — bg-remove kaynaklı tempId değişiminde
   ref'i SIFIRLAMA, aksine "zaten uygulandı" olarak işaretle ki `handleDesignLoaded` atlasın:
   ```ts
   useEffect(() => {
     if (skipDimResetRef.current) {
       skipDimResetRef.current = false;
       dimsAppliedRef.current = design?.tempId ?? null; // türev görsel → öneriyi atla
       return;
     }
     dimsAppliedRef.current = null; // gerçek yeni upload → öneri serbest
   }, [design?.tempId]);
   ```
3. `removeBackground` içinde, yeni tempId ile `setDesign(...)` çağrısından **hemen önce**
   `skipDimResetRef.current = true;` yap.
4. Şablon seçiliyken (`selectedTpl`) `handleDesignLoaded` zaten `return` ediyor — bu yola dokunma.

**Doğrulama:** Kontur modunda görsel yükle → Adım 3'te genişliği 80mm yap → Adım 3'teki "Arka planı
kaldır"a bas → kaldırma sonrası boyut **80mm kalır** (50'ye dönmez). Şablon seçiliyken de boyut korunur.

---

## GÖREV 2/3 — Boyut değişiminde manuel yerleşimi koru (🔴 veri kaybı)

**Sorun:** `public/poc.html` `pim-editor-set-size` mesaj handler'ı (≈L2046), standalone + kontur
modunda **her mm değişiminde** `applyPlacementPreset('contain')` çağırıyor; bu da
`resetImageTransform()` yapıyor (≈L2793). Kullanıcı görseli elle sürükleyip/yakınlaştırıp
yerleştirdiyse, Adım 3'te boyutu azıcık değiştirince **manuel konum sıfırlanıyor.**

**Mimari (neden):** İlk yüklemede otomatik "sığdır" (contain) DOĞRU — kullanıcı henüz dokunmadı.
Ama kullanıcı görseli bir kez elle oynattıysa, boyut değişimi onun yerleşimini ezmemeli. Kırmızı
kesik referans çerçevesi (`drawOrderDimReference`) zaten yeni hedef boyutu gösteriyor, yani
otomatik snap'e gerek yok — kullanıcı isterse elle yeniden sığdırır.

**Yapılacak (poc.html, yalnız `PIM_PARAMS.standalone` dalı):**
1. Modül seviyesinde `let pimUserMovedImage = false;` ekle.
2. Kullanıcının görseli elle oynattığı YERLERDE bayrağı set et — `imageTransform.x/y/scale`'i
   **kullanıcı girdisiyle** değiştiren mouse-drag (mousemove sürükleme) ve wheel-zoom handler'larını
   bul; bu handler'ların içinde `pimUserMovedImage = true;` yap. (Programatik `applyPlacementPreset`/
   `resetImageTransform` çağrıları bayrağı set ETMEZ.)
3. Bayrağı `false`'a çek: (a) `processImage` içinde yeni görsel işlenirken, (b) `pim-editor-set-shape`
   ile bıçak/şekil değişince (yeni bıçak = yeni yerleşim mantıklı).
4. `pim-editor-set-size` handler'ındaki contain çağrısını koşulla:
   ```js
   if (PIM_PARAMS.standalone && currentMode === 'contour'
       && getPlacementFrame() && !pimUserMovedImage) {
     applyPlacementPreset('contain');
   }
   ```
   (`generateCutline(); render(); pimScheduleHeightReport();` her durumda çalışmaya devam etsin.)

**Ek (toolbar — elle yeniden sığdır):** `EditorPreviewToolbar.tsx`'e zoom kontrollerinin yanına
küçük bir **"Sığdır"** butonu ekle → `EditorShell`'de canvas'a `postMessage({ type: 'pim-fit-contain' })`.
poc.html'de bu mesajı handle et: `pimUserMovedImage = false; applyPlacementPreset('contain');`.
Böylece kullanıcı isterse tek tıkla yeniden ortalar.

**Doğrulama:** Kontur modunda görsel yükle (otomatik sığar ✓) → görseli elle sürükle/yakınlaştır →
Adım 3'te boyutu değiştir → **yerleşim korunur** (sıfırlanmaz). "Sığdır" butonu → yeniden ortalanır.
Yeni bıçak/şablon seçince yerleşim sıfırlanır (beklenen).

---

## GÖREV 3/3 — Çift export → yetim draft satırını önle (⚠️ DB çöpü)

**Sorun:** `EditorShell.tsx`'te iki yer `pim-request-export` yolluyor: (a) Adım 4'e geçince
çalışan `useEffect` (≈L392), (b) `waitForExportSave` (≈L378). Kullanıcı Adım 4'e geçip arka plan
kaydı bitmeden hemen "ekle"ye basarsa **iki export** → iki `pim-editor-saved` → iki `persistDraft`
→ `editor_cutline_drafts`'ta **iki satır**. Sadece biri handoff'a gider; diğeri yetim kalır.

**Mimari (neden):** Export+kayıt tek-uçuş (single-flight) olmalı — aynı anda en fazla bir kayıt
istemi havada olsun; ikinci istek mevcut promise'e iliştirilsin.

**Yapılacak (EditorShell.tsx):**
1. `pendingSavePromiseRef = useRef<Promise<string | null> | null>(null)` ekle.
2. Tek bir `ensureDraftSaved(): Promise<string | null>` helper'ı yaz:
   - `draftId` varsa → `Promise.resolve(draftId)`.
   - `pendingSavePromiseRef.current` doluysa → onu döndür (yeni export YOK).
   - Aksi halde yeni promise kur: `exportWaitRef.current = resolve`, `postMessage({type:'pim-request-export'})`,
     12sn timeout (mevcut `waitForExportSave` mantığı). Promise settle olunca (resolve/timeout)
     `pendingSavePromiseRef.current = null` yap (finally).
3. Adım-4 `useEffect`'i ham `pim-request-export` postu yerine `void ensureDraftSaved();` çağırsın.
4. `addToProduct`'taki `waitForExportSave()` çağrısını `ensureDraftSaved()` ile değiştir.
5. "Bıçağı yeniden kaydet" butonu (≈L752) bilinçli yeniden-export → mevcut davranış kalsın
   (ham `pim-request-export`), ama tıklanmadan önce `draftId` ve `pendingSavePromiseRef`'i
   sıfırlamak istersen sıfırla (kullanıcı kasıtlı yeniden kaydediyor).
6. `persistDraft` başarı/başarısızlık yollarındaki `exportWaitRef.current?.(...)` resolve'ları
   olduğu gibi kalsın — `ensureDraftSaved` aynı `exportWaitRef` köprüsünü kullanıyor.

**Doğrulama:** Adım 4'e geç, "Bıçak kaydedildi" rozeti gelmeden hemen "Sticker'a ekle"ye bas →
sipariş akışına **tek draftId** ile geçilir; `editor_cutline_drafts`'ta tek yeni satır oluşur
(çift değil). Kayıt başarısızsa "Bıçak kaydı alınamadı — tekrar dene" net görünür ve retry çalışır.

---

## GENEL DOĞRULAMA
1. `tsc --noEmit` temiz.
2. bg-remove sonrası elle girilen boyut korunur (Görev 1).
3. Boyut değişimi manuel yerleşimi ezmez; "Sığdır" elle çalışır (Görev 2).
4. Çift export olmaz; tek draft satırı (Görev 3).
5. Şablon seçili akış, normal upload akışı, "ürüne ekle" handoff bozulmadı.
6. `/onay` ve `/duzenle` (sipariş-sonrası) akışına dokunulmadı; POC `embed` dalı değişmedi.

## DEĞİŞECEK DOSYALAR
`src/components/editor/EditorShell.tsx` (Görev 1, 3),
`public/poc.html` (Görev 2 — yalnız `standalone` dalı),
`src/components/editor/EditorPreviewToolbar.tsx` (Görev 2 — "Sığdır" butonu).
