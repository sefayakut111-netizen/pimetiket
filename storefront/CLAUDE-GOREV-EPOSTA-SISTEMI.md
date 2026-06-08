# Claude Code Görev — E-posta Sistemi Uygulaması (29 e-posta)

> Cowork (Claude) hazırladı — 6 Haz 2026. Metin + tasarım + mimari ONAYLI. Bu görev = kod uygulaması.
> Kaynak dokümanlar (hepsini oku):
> - `docs/EPOSTA-METINLERI.md` — 29 e-postanın onaylı metni (konu/preheader/gövde/CTA/rota/görsel/AI/tür)
> - `docs/EPOSTA-MIMARI.md` — base layout, token'lar, koşullu footer, bileşenler, AI bağlantı noktaları
> - `docs/EPOSTA-YAZIM-BRIEF.md` — KVKK/İYS sınıflandırması, görsel kuralı, AI müdahale haritası
> - Mevcut: `src/lib/mail/` (Resend, notifications, templates/*.tsx, base.tsx)

## BÜYÜK GÖREV — aşamalı yap (her aşama ayrı commit + /gorev turu)

### Aşama 1 — Base layout + paylaşılan bileşenler
- `src/lib/mail/templates/base.tsx`'i EPOSTA-MIMARI §1 token + yapısına göre güncelle.
- Bileşenler: `<Button>`, `<DetailBox>`, `<ProductThumb>`, `<Eyebrow>`.
- **Koşullu footer:** transactional → "işlemsel bildirim" (unsubscribe yok); ticari ileti → token'lı `/bildirim-tercihleri/cikis?t=TOKEN` + `List-Unsubscribe` header.
- Preheader prop'u. Mobil responsive, inline CSS.

### Aşama 2 — Mevcut 13 şablonu güncelle (Grup 4 + bazıları)
- EPOSTA-METINLERI'ndeki onaylı metinlerle: 1,2,3,4,5,6,7,8,9 + proof-approved/help-resolved. Ton + CTA + rota + görsel kuralına uy.

### Aşama 3 — Yeni şablonlar (16 yeni)
- İade (24-27), iptal (28), ödeme başarısız (29), üyelik hoşgeldin (23), ilişki (10,11,14), admin/fason (15-20). Tür/görsel/CTA kurallarıyla.

### Aşama 4 — Supabase Auth (21, 22)
- Supabase dashboard → Auth → Email Templates: "Confirm signup" (21) ve "Reset password" (22) şablonlarını EPOSTA-METINLERI metniyle TR+marka olarak özelleştir. Değişken `{{ .ConfirmationURL }}`. (Bu kod değil dashboard işi — Sefa'ya not.)

### Aşama 5 — AI adımları (EPOSTA-MIMARI §5 + brief AI haritası)
- 5 QC Uyarı `{qcIssue}`, 6 QC Red `{qcReason}`, 28 İptal `{reason}`, 26 İade Red `{reason}`, 16 Günlük Özet `{aiSummary}`.
- Mevcut Pim AI/`design-qc` çıktısını kullan; her çağrıda **fallback sabit metin** (AI yoksa/boşsa e-posta bozulmasın). AI yalnız bilineni ifade eder, uydurmaz.

### Aşama 6 — İYS / consent / test
- Ticari ileti 3'lüsü (10,11,14): `notification_prefs` consent gate + suppression kontrol + List-Unsubscribe.
- Her şablonu örnek veriyle render + görsel kontrol; spam/deliverability gözden geçir.

## DOĞRULAMA
- [ ] `npm run lint && npm run build`
- [ ] Her şablon render oluyor, değişkenler doğru basılıyor, linkler doğru rotaya gidiyor
- [ ] Transactional'da unsubscribe YOK; ticari iletide var + List-Unsubscribe header
- [ ] AI'lı e-postalarda fallback çalışıyor (AI kapalıyken render bozulmuyor)

## COMMIT + DEPLOY
Aşama bazında kapsanmış commit + push origin main (Vercel deploy). Supabase auth (Aşama 4) dashboard'dan, ayrı.

> Bitince Cowork (Claude) canlıda örnek akışları test eder.
