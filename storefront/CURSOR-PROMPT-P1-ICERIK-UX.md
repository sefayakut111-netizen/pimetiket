# P1 Fix — Tema 4: Fiyat & Frontend & UX & Yasal & İçerik (15 görev)

Denetim (1 Haz) doğrulanmış P1'leri. Karışık domain. file:line kanıtlı.
**Yasal maddeler avukat onayı gerektirebilir** — işaretli; Cursor metni günceller, Sefa avukata danışır.

---

## A — FİYAT (2 görev)

### GÖREV 1/15 — applyRetailLayer: fee_pct=100 sıfıra bölünme [bug, conf 0.99]

#### Dosya: `src/lib/pricing-retail.ts` (~satır 110)

`with_fee = with_markup / (1 - fee_pct/100)` — fee_pct=100 → 0'a bölünme → Infinity → tüm rulo etiket
fiyatları NaN/Infinity. `pricing-calc.ts:308`'de guard var, burada YOK.

**Fix:** `const with_fee = fee_pct > 0 && fee_pct < 100 ? with_markup / (1 - fee_pct / 100) : with_markup;` (pricing-calc ile aynı pattern).

**Doğrulama:** Admin fee_pct=100 kaydetse bile rulo fiyat sonlu döner.

### GÖREV 2/15 — Legacy path feePct=0 hardcode [data, conf 0.85]

#### Dosyalar: `src/lib/sticker-customer-pricing.ts:138` + `etiket-customer-pricing.ts:114`

`feePct: 0` hardcoded legacy fallback. adminConfig yüklenemezse PayTR komisyonu (%2.5) dahil edilmez →
müşteri %2.5 düşük fiyat görür, checkout geçebilir (gelir kaybı).

**Fix:** Legacy path'in `feePct`'sini FALLBACK config'in `fee_pct` değerine bağla; veya admin config
yüklenemediğinde fiyat gösterme (hata state). En basit: FALLBACK_CONFIG.fee_pct kullan.

**Doğrulama:** Config yokken bile gösterilen fiyat komisyon dahil (server recalc ile eşleşir).

---

## B — FRONTEND (2 görev)

### GÖREV 3/15 — odeme/page.tsx double-submit race [bug, conf 0.88]

#### Dosya: `src/app/odeme/page.tsx` (~satır 722-759)

sessionStorage lock (`CHECKOUT_INIT_LOCK_KEY`) `await repriceCustomerCart()`'tan SONRA set ediliyor.
Mobil double-tap → 2 eşzamanlı `submit()` ikisi de guard'ı geçer → 2 payment intent.

**Fix:** Lock'u İLK await'ten ÖNCE set et (satır 723 `setLoading(true)` hemen ardından); zaten lock'luysa bail.

**Doğrulama:** Hızlı çift tıkla → tek payment intent oluşur.

### GÖREV 4/15 — tasarim-yukle: advance-status sessiz hata [ux, conf 0.93]

#### Dosya: `src/app/siparis/[id]/tasarim-yukle/page.tsx` (~satır 281-288)

`advance-status` `adv.ok` false dönerse hiçbir hata gösterilmiyor; 5sn poll 30sn sonra durur, kullanıcı
tüm yüklemeler bitmiş ama durum donmuş görür (açıklama yok).

**Fix:** `if (!adv.ok)` sonrası `toast.error("Durum güncellenemedi, sayfa yenileniyor..."); void load();` + görünür error state.

**Doğrulama:** advance-status fail → kullanıcı hata mesajı + retry görür (sessiz takılma yok).

---

## C — UX & A11y (4 görev)

### GÖREV 5/15 — SelectableCard focus-visible ring yok [ux, conf 0.97]

#### Dosya: `src/components/ui/SelectableCard.tsx` (~satır 40-51)

Focus ring yok → klavye Tab ile hangi kart seçili görünmüyor (WCAG 2.4.7 ihlali). Konfigüratördeki tüm
şekil/malzeme/yüzey kartları etkilenir.

**Fix:** className cn() bloğuna `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pim-mercan focus-visible:ring-offset-2` ekle.

**Doğrulama:** /sticker/yapilandir'da Tab ile gezince seçili kart belirgin ring gösterir.

### GÖREV 6/15 — scrollToStep step ID vs index bug [bug, conf 0.95]

#### Dosyalar: `src/app/sticker/yapilandir/page.tsx:2050-2052` + `etiket/yapilandir/page.tsx:1366`

`scrollToStep` 1-tabanlı INDEX bekliyor (`stepIds[stepIndex-1]`) ama `scrollToStep(designStepId)` step ID
DEĞERİ (7) geçiriyor → `stepIds[6]=undefined` → "Cancel" sonrası tasarım adımına scroll çalışmıyor.

**Fix:** Her iki dosyada `scrollToStep(designStepId)` → `scrollToStep(stepIds.indexOf(7) + 1)`. (Veya `scrollToStep` içine `stepIds.includes` kontrolü + otomatik index.)

**Doğrulama:** Cancel sonrası tasarım adımına scroll çalışır (sticker + etiket).

### GÖREV 7/15 — Checkout disabled buton sebebi belirsiz [ux, conf 0.93]

#### Dosya: `src/app/odeme/page.tsx` (~satır 1953-1956)

"Ödemeye geç" disabled ama neden olduğu gösterilmiyor (`submitMissing[]` dolu ama UI'da yok). Disabled
buton tıklanmadığı için toast da çıkmıyor → kullanıcı neyin eksik olduğunu bilmiyor.

**Fix:** `submitMissing.length > 0` iken buton altına `<p role="alert" className="text-xs text-kirmizi mt-2">{submitMissing[0]}</p>`; butonu `aria-describedby` ile bağla. (Veya disabled yerine tıklamada scroll+toast.)

**Doğrulama:** Eksik alan varken kullanıcı ilk eksiği inline görür.

### GÖREV 8/15 — window.confirm iOS PWA'da çalışmıyor [ux, conf 0.89]

#### Dosyalar: `src/app/sticker/yapilandir/page.tsx:2043` + `etiket/yapilandir/page.tsx:1356`

`window.confirm()` iOS PWA'da sessizce `false` döner (iOS 16.4+) → iOS PWA kullanıcısı dialog görmeden
sepete ekleyemez. Ayrıca brand-dışı native dialog.

**Fix:** `window.confirm` → mevcut `Modal` (`src/components/ui/Modal.tsx`) ile confirm dialog (2 Button: Sepete ekle / Tasarımı yükle). Modal focus-trap + ARIA içeriyor.

**Doğrulama:** iOS Safari PWA'da "tasarım yüklemeden devam" modal'ı görünür ve çalışır.

---

## D — İÇERİK & ANALİTİK (2 görev)

### GÖREV 9/15 — Ham Supabase hata mesajı müşteriye [content, conf 0.97]

#### Dosya: `src/app/sifre-sifirla/page.tsx` (satır 68, 105, 140)

3 noktada `toast.error(\`...: ${error.message}\`)` → raw İngilizce/teknik Supabase mesajı kullanıcıya.

**Fix:** Sabit Türkçe: link geçersizse "Sıfırlama bağlantısı geçersiz veya süresi dolmuş — yeni link iste."; diğerleri "İşlem tamamlanamadı, tekrar dene." (`${error.message}` kaldır, console'a logla).

**Doğrulama:** Expired link → temiz Türkçe mesaj (teknik detay yok).

### GÖREV 10/15 — PostHog env Vercel'de yok [data, conf 0.97] — 🔧 SADECE MANUEL (Sefa)

**KOD YOK.** `NEXT_PUBLIC_POSTHOG_KEY` boş → PostHog hiç yüklenmiyor, tüm event'ler düşüyor.

**Sefa manuel:** Vercel → Settings → Environment Variables (Production + Preview):
- `NEXT_PUBLIC_POSTHOG_KEY = phc_...` (PostHog projesinden)
- `NEXT_PUBLIC_POSTHOG_HOST = https://eu.i.posthog.com`
→ redeploy.

> Cursor: koda dökme; rapora "Sefa Vercel env eklemeli" taşı. (GA4 env'leri de aynı durumda — [[analytics-durumu]].)

---

## E — YASAL (5 görev) — ⚠️ AVUKAT ONAYI gerekebilir, Cursor metni günceller

### GÖREV 11/15 — Tasarım dosyası saklama süresi 3 farklı değer [legal, conf 0.99]

`/kvkk` (24 ay) vs `/sss` (90 gün) vs admin `/tasarimlar` (90 gün) çelişkisi (KVKK m.4/e ihlali).

**Fix:** TEK otoriter süre belirle. **Hangisi gerçek uygulanıyor?** archive cron'una bak (`archive-old-files`/`archive-inactive`) → gerçek teknik süre neyse ona göre metinleri eşitle. Teknik 90 günse /kvkk'yı düzelt; 24 ay ise /sss + admin'i düzelt.
> ⚠️ 24→90 değişimi orantılılık değiştirir → Sefa avukata danışmalı. Cursor: teknik gerçeği tespit et + metinleri ona eşitle, kararı rapora yaz.

### GÖREV 12/15 — TKHK m.5 satıcı telefon eksik [legal, conf 0.95]

`/on-bilgilendirme` + `/mesafeli-satis` satıcı bilgisinde telefon YOK (yönetmelik m.5/1-b zorunlu).

**Fix:** Satıcı bölümüne telefon ekle. **Sefa numara temin etmeli** (Workinton ofis veya yönlendirmeli). Cursor: numara placeholder'ı + yapıyı hazırla, gerçek numarayı Sefa verince doldur.

### GÖREV 13/15 — Ayıplı ürün bildirim süresi çelişki (7 vs 30 gün) [legal, conf 0.97]

`/mesafeli-satis` md.8 (7 gün) vs `/iade-degisim-politikasi` (30 gün, TKHK m.10).

**Fix:** `/mesafeli-satis:144`'teki "7 gün" → "30 gün" (TKHK m.10 ile uyumlu). > Avukat notu rapora.

### GÖREV 14/15 — SSS'de var olmayan "AI eğitim opt-in" vaadi [legal, conf 0.92]

`/sss:547` "opsiyonel açık rıza ile AI model eğitimi" diyor ama sitede böyle toggle YOK (TKHK m.61 yanıltıcı).

**Fix:** İfadeyi gerçekle eşitle: OpenAI API tier'da model eğitimi kapalı → "OpenAI API kullanımında sohbet verileri model eğitimi için kullanılmaz (API tier kuralı)" yaz. Var olmayan opt-in vaadini kaldır.

### GÖREV 15/15 — AI sohbet rızası sadece localStorage [legal, conf 0.85]

#### Dosya: `src/lib/pim/chat-consent.ts`

Rıza `pim_ai_chat_consent_v1` localStorage'da → farklı cihaz/temizlik/private modda kayıp; KVKK m.9 ispat
yükü veri sorumlusunda.

**Fix:** Giriş yapmış kullanıcı için rızayı server-side kaydet (`notification_prefs` veya ayrı tablo); localStorage cache kalsın. Anonim için localStorage kabul ama /kvkk metnine "cihaz bazlı yerel depolama" ifadesi ekle.
> Server-side tablo gerekiyorsa migration (sıradaki no). Avukat notu rapora.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)

1. `npx tsc --noEmit` TEMİZ (kırıksa push etme).
2. `git add -A`
3. `git commit -m "fix(icerik-ux-p1): fee guard + double-submit + a11y focus + scrollToStep + iOS modal + ham hata + yasal metin tutarlilik"`
4. `git push origin main` → Vercel deploy.
5. **Migration (varsa Görev 15):** apply Sefa manuel.
6. Deploy READY → commit hash + canlı URL + **manuel/karar bekleyenler** bildir:
   - Görev 10 (PostHog env — Sefa Vercel)
   - Görev 11/12/13/14/15 (yasal — avukat onayı + Görev 12 telefon numarası Sefa'dan)

> Git kökü `pim-etiket/core/`. Yasal metinleri Cursor günceller ama Sefa avukat onayı almadan "kesin" sayma.
