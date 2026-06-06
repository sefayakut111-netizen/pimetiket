# AI Yol Haritası — Fizibilite + Mimari + Maliyet (7 Haz 2026)

> **⚠️ GÜNCELLEME (Sefa 7 Haz):** SEO/İçerik üretimi (#2) ÇIKARILDI — Sefa zaten düzenli MANUEL yapıyor, AI gereksiz. AI Tasarım Üretimi + Fason Eşleştirme de RED. **AKTİF 3 ALAN:** Destek Sınıflandırma · Akıllı Arama (intent) · Görsel İyileştirme. Faz 1 = sadece Destek Sınıflandırma.

Sefa onaylı 4 AI alanı. Felsefe: **"olan görseli işle, sıfırdan tasarlama YOK"**. Sefa kuralları geçerli (dalkavuk/empati/süresiz/Bursa yasak, cüzdan/puan/üyelik indirimi yok). İnsan/müşteri onayı esas (otomatik aksiyon değil).

## ✅ Hazır ortak altyapı (yeniden kullanılır — sıfırdan değil)
```
• ai_usage_logs tablosu (Mig 163) → cost_usd/model/tokens/source — maliyet İZLEME HAZIR
• AI budget cap (ai-usage-log.ts, PIM_DAILY_REQUEST_CAP, $5/gün $100/ay) — patlama koruması HAZIR
• rate-limit.ts (IP/user, Upstash+fallback) · external-timeouts.ts (vision 45s/chat 90s/mini 30s)
• OpenAI client patterni (streamText/generateObject) · design_quality_checks (QC pipeline)
→ Yeni AI özellik = bu altyapıyı kullan (cost log + cap + timeout otomatik gelir)
```

---

## 1️⃣ DESTEK TALEBİ SINIFLANDIRMA — ⭐ en hazır, en hızlı değer
**Hazırlık: %80 · Çaba: DÜŞÜK · Risk: DÜŞÜK · Maliyet: çok düşük**

- **Mevcut:** `support_tickets` tablosu VAR — `category` enum (genel/siparis/tasarim/kargo/iade/teknik/fiyat) + `status`. `/api/support`, `/api/admin/support/[id]`.
- **Ne yapacak:** Ticket oluşunca → LLM (gpt-4o-mini) → otomatik `category` + `priority` (yeni kolon) + opsiyonel taslak yanıt. Operatör onaylar/düzeltir.
- **Mimari:** support INSERT sonrası async LLM çağrısı → ticket update (category/priority/draft). Admin panelinde gösterim.
- **Eksik:** `priority` kolonu (migration), classification endpoint, admin UI gösterim.
- **Maliyet:** ~$0.0005/ticket (kısa metin, mini). Aylık birkaç dolar.
- **Risk:** Yanlış kategori → operatör düzeltir (öneri, otomatik aksiyon yok). Düşük.

## 2️⃣ SEO/İÇERİK ÜRETİMİ (taslak+onay) — kolay büyüme
**Hazırlık: %70 · Çaba: DÜŞÜK · Risk: DÜŞÜK · Maliyet: düşük**

- **Mevcut:** `blog_posts` tablosu VAR — `seo_title`, `seo_description`, `body_tr/en`, `status`. `/api/admin/blog` CRUD + admin form.
- **Ne yapacak:** Admin blog yazarken "AI ile üret" → seo_title/seo_description/excerpt taslağı (gpt-4o-mini) → Sefa düzenler+onaylar. Opsiyonel: body taslak.
- **Mimari:** blog POST/PATCH'te "AI öner" butonu → LLM → taslak alanları doldur (admin onayı şart).
- **Eksik:** AI generation endpoint + admin "AI öner" butonu.
- **Maliyet:** düşük (az hacim, mini, taslak başı ~$0.002).
- **Risk:** İçerik kalite/marka → Sefa onayı (taslak). Sefa kuralları prompt'a (dalkavuk/süresiz yok). Düşük.

## 3️⃣ AKILLI ARAMA / Brief→Ürün — müşteri kaybını azaltır
**Hazırlık: %50 · Çaba: ORTA · Risk: DÜŞÜK · Maliyet: düşük**

- **Mevcut:** Site araması YOK. Pim zaten brief→konfigürasyon yapıyor (designer tool). pgvector **YOK**.
- **Ne yapacak:** Müşteri "su geçirmez parlak yuvarlak sticker" → doğru ürün+konfigürasyon yönlendirme. Niyet net değilse SOR.
- **Mimari — 2 seçenek:**
  ```
  A) BASİT (öneri — pgvector'süz başla):
     Sorgu → LLM intent parsing (gpt-4o-mini) → yapılandırılmış çıktı
     (ürün tipi+malzeme+yüzey+şekil+adet) → konfigüratöre yönlendir
     → pgvector GEREKMEZ, mevcut Pim pattern'i, HIZLI
  B) GELİŞMİŞ (sonra): pgvector + embedding → blog/SSS/içerik semantic arama
     → migration (CREATE EXTENSION vector) + embedding batch job
  ```
- **Eksik:** Arama UI + intent endpoint (A) VEYA pgvector altyapı (B).
- **Maliyet:** A) ~$0.001/sorgu (mini intent). B) embedding ~$0.0001/sorgu. Düşük.
- **Risk:** Niyet yanlış → belirsizse sor (Pim mantığı, "tahmin etme"). Düşük.
- **Öneri:** A ile başla (ucuz+hızlı), içerik arama ihtiyacı büyüyünce B (pgvector).

## 4️⃣ GÖRSEL İYİLEŞTİRME (upscale/vektörize) — QC'yi tamamlar
**Hazırlık: %60 · Çaba: ORTA · Risk: ORTA (müşteri onayı ile düşer) · Maliyet: düşük-orta**

- **Mevcut:** Upload pipeline VAR (temp-upload + designs bucket). QC VAR (`design_quality_checks` DPI/format + `cutline-vision-fallback` GPT-4o Vision bg-remove önerir). Upscale YOK.
- **Ne yapacak:** Düşük DPI/kalite görsel → upscale (Real-ESRGAN) / vektörize → ÖNCESİ-SONRASI müşteriye göster → müşteri onaylar (otomatik DEĞİL).
- **Mimari:** QC düşük DPI tespit → "kaliteyi iyileştir" öner → upscale API → öncesi/sonrası UI → müşteri onay → kabul ederse kullan, etmezse orijinal.
- **Eksik:** Upscale API entegrasyonu (Real-ESRGAN/Stability via Replicate) + öncesi/sonrası UI + onay akışı.
- **Maliyet:** ~$0.002-0.01/görsel (Replicate Real-ESRGAN), kullanım başı. Düşük-orta.
- **Risk:** AI halüsinasyon (metin/logo'da olmayan detay) → **müşteri öncesi/sonrası onayı ŞART** (bozarsa reddeder). Orta→düşük.
- **Öneri:** QC entegrasyonu (düşük DPI → öner), müşteri tetikler+onaylar (otomatik upscale değil).

---

## 📊 Önceliklendirme (değer/çaba/hazırlık)

| Sıra | Özellik | Hazır | Çaba | Değer | Neden |
|---|---|---|---|---|---|
| 1 | Destek Sınıflandırma | %80 | Düşük | Operasyon | En hazır, solo'sun → zaman kazandırır |
| 2 | SEO/İçerik (title/desc) | %70 | Düşük | Büyüme | Kolay + SEO işin zaten var |
| 3 | Akıllı Arama (basit/intent) | %50 | Orta | Müşteri | pgvector'süz başla, ucuz, müşteri kaybı azalır |
| 4 | Görsel İyileştirme | %60 | Orta | Müşteri+QC | Upscale API + onay UI gerek |

## 🗓️ Önerilen faz planı
```
FAZ 1 (hızlı, düşük çaba, düşük risk):
  → Destek Sınıflandırma (priority kolon + classification + admin gösterim)
  → SEO title/desc üretimi (blog AI-öner butonu)
  ⏱️ Her ikisi de %70-80 hazır → kısa sürede canlı

FAZ 2 (orta çaba, müşteri değeri):
  → Akıllı Arama (LLM intent → konfigüratör yönlendirme, pgvector'süz)
  → Görsel İyileştirme (QC → upscale öner → müşteri onay)

FAZ 3 (gelişmiş, ihtiyaç büyüyünce):
  → pgvector semantic search (blog/SSS/içerik) · blog body AI taslak
```

## 💰 Toplam maliyet görünümü
```
Hepsi DÜŞÜK + kullanım-başı (sabit gider yok):
  Destek ~$0.0005/ticket · SEO ~$0.002/taslak · Arama ~$0.001/sorgu · Görsel ~$0.002-0.01/görsel
Mevcut budget cap ($5/gün $100/ay) + ai_usage_logs → hepsi otomatik izlenir+sınırlanır
→ Gradual rollout (her özellik ayrı cost source) → patlama riski kontrol altında
```

## ⚠️ Tüm özelliklerde geçerli kurallar
```
• İnsan/müşteri ONAYI esas (otomatik aksiyon değil: öneri/taslak → operatör/müşteri onaylar)
• Sefa kuralları → her AI prompt'una (dalkavuk/empati/süresiz/Bursa yasak)
• KVKK → müşteri verisi minimize, rıza (Pim consent pattern)
• Maliyet → ai_usage_logs + budget cap (her yeni özellik bu altyapıyı kullanır)
• Mevcut OpenAI pattern (rate-limit + cost log + timeout) tekrar kullanılır
```

---
**Sonuç:** 4 alan da uygulanabilir; altyapının çoğu (cost log, budget, QC pipeline, blog/destek tablosu) HAZIR. En hızlı değer Faz 1 (destek + SEO, düşük çaba). Akıllı arama basit (intent) başlamalı (pgvector sonra). Görsel iyileştirme müşteri onayı ile güvenli.
