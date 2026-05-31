# SEO Durumu — Güncelleme (Haziran 2026)

> Önceki snapshot (21 Mayıs 2026) aşağıda arşivlendi. Bu bölüm plan implementasyonu sonrası güncel durumu özetler.

---

## Genel skor (tahmini)

| Boyut | Skor |
|-------|------|
| Teknik SEO | 9/10 |
| Yapılandırılmış veri | 8.5/10 |
| İçerik / long-tail | 8/10 (tür landing + blog konu eklendi) |
| i18n / hreflang | 3/10 (bilinçli TR-only) |
| AEO / AI | 7.5/10 |
| Operasyon | 8.5/10 (GSC Performance API denetçide) |

---

## Tamamlanan implementasyonlar (plan)

### P0 — Tutarlılık

- `getSiteUrl()` tek kaynak: [`src/lib/site-url.ts`](../src/lib/site-url.ts)
- WebSite `SearchAction` → `/blog?q={search_term_string}` (TopBarSearch ile uyumlu)
- `/telif-sikayet` sitemap'e eklendi
- `/destek`, `/iade-talep` → `noindex, follow` layout metadata
- Kök JSON-LD: [`RootJsonLd`](../src/components/seo/RootJsonLd.tsx) + admin DB sosyal/telefon

### P1 — Organik kazanım

- Tür/kesim landing: `/etiket/rulo`, `/etiket/tabaka`, `/sticker/die-cut`, `kiss-cut`, `holografik`, `transparan` — [`type-landings.ts`](../src/lib/seo/type-landings.ts)
- Blog konu: `/blog/konu/[tag]` (category slug)
- Blog: `?q=` arama + `?page=` sayfalama (`rel=prev/next`)
- Malzeme sayfaları: Product schema + OG/twitter
- `/yorumlar`: AggregateRating JSON-LD (yayınlanmış yorum varsa)
- Yapılandırıcı: Product schema kaldırıldı (çift sinyal önlendi)

### P2 — Strateji / operasyon

- **hreflang:** Uygulanmadı — hedef pazar TR; EN yalnızca client i18n. `/en` prefix açılmadan `alternates.languages` eklenmeyecek ([`SEO-PLAN-2026-05.md`](../SEO-PLAN-2026-05.md) notu).
- **GSC Performance API:** [`gsc-performance.ts`](../src/lib/seo/gsc-performance.ts) + `SeoAuditor` kontrolü
- **Admin SEO sekmesi:** `/admin/ayarlar` → "SEO ve sosyal" (social_links, seo_contact_phone) + Mig `104_seo_site_settings.sql`
- **OG helper:** [`page-metadata.ts`](../src/lib/seo/page-metadata.ts) — blog, malzemeler, malzeme detay

---

## Manuel / Sefa aksiyonları

1. Migration `104_seo_site_settings.sql` remote Supabase'e uygula
2. `/admin/ayarlar` → SEO ve sosyal alanlarını doldur + kaydet
3. `/admin/gorseller` → `og_default` yükle (anasayfa OG)
4. Search Console → sitemap yeniden gönder
5. GSC Performance için `GSC_SA_*` (veya GA4 SA + webmasters scope) env

---

## Arşiv — 21 Mayıs 2026 snapshot (özet)

- OG: etiket/sticker canlı; anasayfa v3 deploy doğrulaması bekleniyordu
- Article/FAQ schema o tarihte eksik denmişti — **artık kodda var**
- Blog admin o tarihte yok denmişti — **artık var**

Tam arşiv metin git geçmişinde `docs/SEO-DURUM-21MAY.md` önceki sürümünde.
