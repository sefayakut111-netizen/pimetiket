# Editör Pim Sohbet/Komut Alanı — sağ sütun AI

Editöre sağ sütunda Pim komut alanı: kullanıcı doğal dille yazar → Pim editörün MEVCUT aksiyonunu tetikler.
Spec: `docs/PIM-EDITOR-KOMUT-SPEC.md`. **ÖN KOŞUL:** UIUX Tur 3 (`CURSOR-PROMPT-EDITOR-UIUX-TUR3.md`)
bitmiş + 3-sütun layout (sağ sütun yer açılmış) olmalı.

## TEMEL İLKE (Sefa kuralı — değişmez)
- Pim editörde **TASARIM YAPMAZ** — sadece mevcut editör aksiyonlarını doğal dille tetikler ("sesli kumanda").
- Kapsam dışı istek (logo çiz, metin ekle, filtre) → kibarca reddet.
- Bot menüsü / hazır chip YASAK — serbest tek-satır input, Pim yorumlar.
- LLM çıktısı whitelist'e karşı VALIDATE edilir — schema dışı aksiyon editöre ULAŞMAZ.

## MEVCUT ALTYAPI (Dalga 3 — HAZIR, kanıtlı)
- `src/lib/editor/pim-command-schema.ts` — Zod komut şeması (`PimEditorCommand`)
- `src/app/api/editor/pim-command/route.ts` — endpoint (auth + rate-limit + size-reference lookup + canlı sınırlar). **AMA LLM YOK** — sadece kural-tabanlı `lookupSizeReference`.
- `src/lib/editor/size-references.ts` — 1 TL=26mm tablosu
- EditorShell POC'a gönderiyor (Pim'in tetikleyeceği aksiyonlar — kanıtlı): `pim-editor-set-size`,
  `pim-editor-set-shape`, `pim-set-image-scale`, `pim-toggle-layer`, `pim-trigger-bg-remove`, fit-* komutları.

Yani EKSİK: (1) endpoint'e LLM, (2) sohbet UI, (3) komut→EditorShell aksiyon dispatch.

---

## GÖREV 1 — Endpoint'e LLM ekle (gpt-4o-mini + Zod)
#### `src/app/api/editor/pim-command/route.ts`
Mevcut `lookupSizeReference` kural-tabanlı yol KALSIN (hızlı, kesin — "1 lira" gibi). Ek olarak, eşleşmeyen
mesajlarda `gpt-4o-mini` ile komut çıkar:
- `generateObject` (Vercel AI SDK, mevcut `ai`/`@ai-sdk/openai`) + `PimEditorCommand` Zod schema.
- System prompt: "Sen Pim'sin. SADECE şu aksiyonları döndür: set_size, set_size_from_reference, set_shape
  (circle/rect/contour/ellipse), set_offset, set_image_scale, toggle_layer, fit (center/contain/cover),
  remove_background, suggest_product. Kapsam dışı (tasarım/metin/logo/filtre) → {action:'reject', reason}.
  Belirsiz ölçü → {action:'clarify', question}." + canlı ürün sınırları (STICKER_LIMITS) + few-shot 3-4 örnek.
- Çıktı whitelist'e karşı validate (schema zaten zorluyor). Clamp: offset 0-5, scale %25-200, boyut 25-650mm.
- Maliyet: ~$0.0002/komut. Openai key yoksa kural-tabanlı fallback + "şimdilik basit komutlar" mesajı.
**Doğrulama:** "kenarları yumuşat" → set_offset/smoothness; "logo çiz" → reject; "biraz büyüt" → clarify veya set_image_scale.

## GÖREV 2 — Sağ sütun sohbet UI
#### Yeni: `src/components/editor/EditorPimPanel.tsx` (sağ sütun, 320px)
- Üstte küçük Pim avatarı + "Pim'e söyle" başlık (mevcut `Pim.tsx` / `PimAsset` kullan).
- Mesaj listesi (kullanıcı + Pim yanıtları, kısa). Altta tek-satır input + gönder.
- Bot menüsü/hazır chip YOK. Placeholder: "Örn: 1 lira boyutu yap, yuvarlak kes, arka planı sil".
- Gönderince `POST /api/editor/pim-command {message}` → dönen `command`'i Görev 3 ile dispatch et + Pim'in
  Türkçe özetini göster ("Tamam, yuvarlak Ø50 kesim uyguladım.").
- `reject` → kibar ret mesajı. `clarify` → soru mesajı. Marka sesi (sen/kısa/dalkavuk yok).
**Doğrulama:** Sağ sütunda sohbet; yazıp gönderince Pim yanıt + aksiyon.

## GÖREV 3 — Komut → EditorShell aksiyon dispatch
#### `src/components/editor/EditorShell.tsx`
Pim'den dönen `PimEditorCommand`'i mevcut postMessage aksiyonlarına MAP'le (yeni aksiyon yazma — var olanı çağır):
- `set_size` / `set_size_from_reference` → `pim-editor-set-size` (+ state güncelle, sol panel boyut input senkron)
- `set_shape` → `pim-editor-set-shape` (+ kesim modu butonu vurgusu)
- `set_offset` → `pim-set-offset`
- `set_image_scale` → `pim-set-image-scale` (+ ölçek slider senkron)
- `toggle_layer` → `pim-toggle-layer`
- `fit` (center/contain/cover) → `pim-fit-center/contain/cover`
- `remove_background` → `pim-trigger-bg-remove`
- `suggest_product` → ürün öneri metni (CTA vurgusu — mevcut deriveEditorProductHint)
> Her komut MEVCUT bir postMessage'a gider. Pim sadece tetikler; editör state'i tek kaynak kalır.
**Doğrulama:** "1 lira boyutu" → boyut 26mm + yuvarlak, sol panel + önizleme senkron güncellenir.

---

## SON ADIM — commit + push + canlıya al (ZORUNLU)
1. `rm -rf .next/dev/types` + `npx tsc --noEmit` → 0 hata.
2. `git add -A`
3. `git commit -m "feat(editor): Pim sohbet/komut alani (sag sutun) — LLM komut + aksiyon dispatch (sesli kumanda)"`
4. `git push origin main` → Vercel deploy.
5. Deploy READY → commit hash bildir. Migration YOK.

> Git kökü `pim-etiket/core/`. Pim TASARIM YAPMAZ — mevcut aksiyonları tetikler. Whitelist + clamp koru.
> Sefa kuralı: bot menüsü/chip yok, sen-hitap, dalkavuk yok. Claude canlıda test: "1 lira boyutu",
> "yuvarlak kes", "arka planı sil" → aksiyon; "logo çiz" → reject.
> ÖN KOŞUL: UIUX Tur 3 (3-sütun layout) önce bitsin — bu prompt sağ sütunu doldurur.
