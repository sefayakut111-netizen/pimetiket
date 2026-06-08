# Pim Etiket — E-posta Mimarisi & Görsel Sistem

> Cowork (Claude) tasarım/mantık. Kod gerektiren kısımlar Claude Code'da. Metinler: `EPOSTA-METINLERI.md`. Kurallar: `EPOSTA-YAZIM-BRIEF.md`.

## 1. Base layout (tüm 29 e-posta miras alır) — `src/lib/mail/templates/base.tsx`

Yapı (yukarıdan aşağı):
1. **Preheader** (gizli, inbox önizleme metni) — her e-posta `preheader` prop'u geçer.
2. **Header:** krem şerit + Pim logo (`/pim/pim-etiket-mark-*.svg`) + "Pim Etiket" wordmark. Logo ile yazı arası ≥12px boşluk.
3. **İçerik slot'u:** `{children}` — eyebrow (mercan, opsiyonel) + H1 + paragraflar + (opsiyonel) görsel + (opsiyonel) detay kutusu + birincil CTA + yardımcı metin.
4. **Footer (dark/lacivert):** tagline + linkler (SSS · İletişim · KVKK · Bildirim tercihleri) + © tüzel ünvan + **koşullu satır** (aşağıda) + mini güven (3D Secure · SSL · KVKK).

### Tasarım token'ları (inline CSS — e-posta uyumu için)
- Renk: ink `#1F1B2D` · mercan `#FF6B5B` (buton gradient `#FF8585→#FF6B5B`) · krem `#FAF4E8` · footer lacivert `#1A2335` · gri metin `#8a8578` · gövde `#3a3530`.
- Genişlik: 600px ortalı kart, sayfa zemini `#ECE8E0`. Mobilde tam genişlik (responsive).
- Tipografi: system stack. H1 ~26px/800, gövde ~15.5px, footer ~11-12px.
- Buton: dolu mercan, `border-radius:26px`, beyaz metin, **fiille başlar**; altında metin-link yedeği (image-off uyumu).
- Görseller: `max-width:100%`, `alt` zorunlu; kritik bilgi asla yalnız görselde değil.

## 2. Bileşen konvansiyonu (paylaşılan parçalar)

`base.tsx` + şu yardımcı bileşenler (Claude Code üretir):
- `<Button href label/>` — mercan CTA + yedek link.
- `<DetailBox>` — krem detay kutusu (sipariş özeti, kargo bilgisi).
- `<ProductThumb src alt/>` — dinamik ürün/prova görseli slot'u.
- `<Eyebrow>` — mercan üst-başlık.

## 3. Koşullu mantık (KRİTİK)

- **Footer alt satırı e-posta türüne göre:**
  - Transactional → "Bu, siparişinle ilgili işlemsel bir bildirimdir." (unsubscribe YOK)
  - Ticari ileti (10, 11, 14) → "Bu e-postaları almak istemiyorsan abonelikten çıkabilirsin." + token'lı `/bildirim-tercihleri/cikis?t=TOKEN` + `List-Unsubscribe` header.
- **Görsel slot'u opsiyonel:** sadece görsel kuralındaki e-postalarda render edilir (brief). Auth/iade/ödeme/admin'de header logo dışında görsel yok.

## 4. Dinamik görseller (kod çeker, tasarım yok)

- Prova önizleme (3,4): sipariş prova asset URL'i.
- Ürün thumbnail (1,8): order_items görseli.
- Sepet ürünü (11): cart item görseli.
> Bunlar Supabase/asset URL'lerinden gelir; `<ProductThumb>` ile basılır.

## 5. AI bağlantı noktaları (brief AI haritası)

- 5 QC Uyarı `{qcIssue}` · 6 QC Red `{qcReason}` — `design-qc` çıktısını Pim AI müşteri diline çevirir.
- 28 Sipariş İptali `{reason}` — iptal bağlamından AI kibar sebep.
- 26 İade Reddedildi `{reason}` — operatör notundan AI gerekçe.
- 16 Günlük Özet `{aiSummary}` — günün rakamları → doğal brifing.
> Kural: AI yalnız bilinen gerçeği ifade eder; başarısızsa sabit fallback. (brief)

## 6. Statik marka görselleri (Cowork üretir — opsiyonel)

- 23 Hoşgeldin banner'ı, (ops.) 10/14 hafif aksan. SVG/PNG marka tonunda, hafif (deliverability). KARAR BEKLİYOR.

## 7. Kod handoff'u (Claude Code görevleri — sonraki fasıl)

1. `base.tsx`'i bu token + koşullu footer + paylaşılan bileşenlerle güncelle/oluştur.
2. 29 e-postayı `EPOSTA-METINLERI.md`'den şablonlara işle (mevcut 13 güncelle + 16 yeni). Her biri tür/görsel/CTA/rota kuralına uysun.
3. Supabase Auth şablonları (21 e-posta onay, 22 şifre sıfırlama) dashboard'da TR+marka olarak özelleştir.
4. AI adımları: iptal/QC/iade-red/günlük-özet için Pim AI çağrısı + fallback.
5. Ticari ileti 3'lüsünde (10,11,14) İYS consent gate + token unsubscribe + List-Unsubscribe header doğrula.
6. Test: her şablonu render + örnek veriyle görsel kontrol; spam skoru/deliverability gözden geçir.
