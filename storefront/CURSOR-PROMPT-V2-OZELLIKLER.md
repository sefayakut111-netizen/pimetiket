# SIRA 6 — v2 Özellikler (24 görev)

> Bu prompt 3 alanı kapsar: Proof Editor AI Pipeline, AI Ek + Final, Fiyatlandırma Gelişmiş.
> **ÖNEMLİ:** Her görev için ÖNCE kodu kontrol et — SIRA 3 (bıçak) ve SIRA 5 (admin) zaten birçok parçayı kurmuş olabilir. Yapılmışsa atla ve "✓ zaten var" diye raporla.
> Her alan sonunda `npx tsc --noEmit` + commit.

---

## ALAN 1 — Proof Editor AI Pipeline (8 görev)

`@CURSOR-GOREVLER-PROOF-EDITOR.md` sırayla uygula. Önce kontrol et:

| # | Görev | Kontrol noktası |
|---|-------|-----------------|
| 1 | EPS engeli + dosya tipi util | `src/lib/design-file-types.ts` var mı? Yoksa oluştur. EPS upload validation eklenmiş mi? |
| 2 | `proof_validating` status | Migration 101 zaten var (101_proof_validating_status.sql). Enum'a ekli mi kontrol et, değilse uygula. |
| 3 | JPG hazır şekil seçici | `JpgShapeSelector.tsx` var mı? `/onay`'da entegre mi? |
| 4 | **Bıçak tespit modülü** | ✅ **TAMAMLANDI** (SIRA 3) — atla, magenta + alpha + named layer hepsi var |
| 5 | Beyaz katman üretim modülü | `src/lib/proof/white-layer.ts` var mı? `needsWhiteLayer()` `design-file-types.ts`'te mi? |
| 6 | Rule-based validator | `src/lib/proof/rule-validator.ts` var mı? |
| 7 | AI Vision validator | `src/lib/proof/ai-validator.ts` var mı? Migration 102 (`proof_validations` tablosu) prod'da mı? |
| 8 | Auto-fix + orchestrator | `src/lib/proof/auto-fix.ts` + `orchestrator.ts` runProofPipeline tam çalışıyor mu? |

**Commit pattern:** Her tamamlanan görev için ayrı commit veya 8'i birden tek commit — Cursor karar versin. Yeni dosya yoğun ise ayrı commit'ler tercih et.

**Commit önek:** `feat(proof):`

---

## ALAN 2 — AI Ek + Final (8 görev)

`@CURSOR-GOREVLER-FINAL.md` sırayla uygula. Önce kontrol et:

| # | Görev | Kontrol noktası |
|---|-------|-----------------|
| 1 | Bakım modu (maintenance mode) | Migration 103 var (103_maintenance_mode.sql). `/admin/sistem/bakim` sayfası var mı? Middleware kontrolü? |
| 2 | Cron izleme paneli | Migration 104 var (104_cron_runs.sql). `/admin/sistem/cronlar` sayfası var mı? |
| 3 | Ödeme detay sayfası | `/admin/odemeler/[id]` rotası var mı? PayTR detayları + iade aksiyonu? |
| 4 | Arka plan algılama + kaldırma | `src/lib/proof/background-removal.ts` veya benzer modül? Remove.bg API veya local solution? |
| 5 | RGB → CMYK simülasyonu | `src/lib/proof/cmyk-simulation.ts` veya `/onay` preview'da CMYK toggle? |
| 6 | Çoklu tasarım tutarlılık kontrolü | Birden çok tasarım yüklendiğinde aralarındaki stil tutarsızlıklarını işaretleme |
| 7 | Baskıya hazır PDF üretimi | Migration 105 var (105_print_ready_pdf_url.sql). `src/lib/proof/print-ready-pdf.ts` var mı? |
| 8 | Pim sohbet yönlendirme + prova bağlamı | Pim chat'in `/onay/[orderId]` sayfasında prova hakkında konuşabilmesi |

**Önemli:** Görev 4, 5, 6 yeni LLM/Vision çağrıları içerebilir — `OPENAI_API_KEY` kullanımı, maliyet logu (`ai_cost_usd` benzeri kolon) ekle.

**Commit önek:** `feat(ai):` veya `feat(admin):` görevin doğasına göre

---

## ALAN 3 — Fiyatlandırma Gelişmiş (8 görev)

`@CURSOR-GOREVLER-FIYAT.md` sırayla uygula (sayfa: `/admin/fiyatlar` veya `/admin/pricing`):

| # | Görev | Detay |
|---|-------|-------|
| 1 | İnteraktif simülasyon paneli | Sağda canlı fiyat preview — material/boy/adet değiştirince hesap |
| 2 | Toplu fiyat matrisi | Tüm material × tier × boy kombinasyonları tek tabloda |
| 3 | Rakip referans alanı | Her satırda "rakip fiyatı" input — opsiyonel kıyas |
| 4 | Malzeme aktif/pasif toggle | Üretimden kaldırılan malzemeleri pasif yap (customer-facing'de gizlensin) |
| 5 | Kaplama TRY karşılığı | Kaplama fiyatlarının yüzde değil **m² başına TRY** olarak gösterimi |
| 6 | Sticky kaydet çubuğu | Uzun sayfada scroll'da kaybolmayan "Değişiklikleri Kaydet" |
| 7 | PriceBook CSV import/export | Tüm fiyat seti CSV → düzenle → import |
| 8 | Fiyat değişikliği bildirimi | Admin değişiklik kaydedince diff özeti + onay modalı |

**Önemli:**
- CLAUDE.md sefaRules — cüzdan/puan yok
- Fiyat motoru `src/lib/pricing/` altında — pattern'i koru
- CSV import'ta validation: negative price reddet, eksik kolon reddet

**Commit önek:** `feat(pricing):`

---

## Uygulama Sırası ve Strateji

| Sıra | Alan | Görev | Tahmini | Commit |
|------|------|-------|---------|--------|
| 1 | **Alan 1 — Proof Editor** | 8 (1 atlanmış) | 3-4 saat | 1-3 |
| 2 | **Alan 2 — AI Ek + Final** | 8 | 4-5 saat | 2-4 |
| 3 | **Alan 3 — Fiyat Gelişmiş** | 8 | 2-3 saat | 1-2 |
| **Toplam** | | **23** | **~10 saat** | **4-9** |

## Önemli Notlar

1. **ÖNCE KONTROL ET, SONRA YAZ** — birçok dosya zaten oluşturulmuş olabilir
2. **Migration'lar prod'da olabilir** — `npx supabase db pull` veya tablo varlık kontrolü yap, çift apply ETME
3. **Sefa kuralları (CLAUDE.md)**:
   - Cüzdan / puan / üyelik indirimi YASAK
   - "Süresiz" YASAK
   - Bursa lokasyon YASAK
   - Tek akıllı Pim (persona dropdown YASAK)
4. **Test verisi filtresi** yeni admin listelerinde aktif kalsın
5. **AI/Vision çağrılarında** `ai_cost_usd` log + timeout (45s) + maxRetries (2)
6. **Yeni endpoint'lerde** `assertPermission(...)` zorunlu
7. **TypeScript hatasız** her commit öncesi

## Beklenen Çıktı

Her alan sonunda kısa rapor:
```
Alan X tamamlandı.
Görev 1: ✓ yapıldı / ✓ zaten vardı
Görev 2: ✓ yapıldı / ✗ atlandı (sebep)
...
Commit: hash + kısa mesaj
```

> **Eğer bir görev başka bir görevin tamamlanmasını bekliyor (örn: Alan 1 Görev 8 orchestrator, Görev 5-7'ye bağlı), sırayla yap.**
