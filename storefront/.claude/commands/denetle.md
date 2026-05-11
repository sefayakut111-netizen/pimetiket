---
description: Son kod değişikliklerini 3 uzman perspektifinden paralel denetler — kod kalitesi + UX + tasarım. Çıktıları birleştirip "kritik / öneri / not" listesi sunar.
---

## Pim Etiket — 3-Perspektif Denetim

Kullanıcı `/denetle` veya `/denetle <hedef>` çağırdığında bu workflow çalışır:

### 1) Hedef tespiti

Argüman varsa onu hedef al:
- `/denetle src/app/etiket/page.tsx` → tek dosya
- `/denetle son commit` → `git log -1 --stat` + `git diff HEAD~1`
- `/denetle son 3 commit` → `git log -3 --stat` + `git diff HEAD~3`
- `/denetle anasayfa` → `src/app/page.tsx` + `src/components/layout/*`

Argüman yoksa **otomatik olarak son commit'i** seç (`git log -1`).

### 2) Paralel agent spawn

Üç agent'ı **tek mesajda paralel** spawn et (multiple Agent tool calls in one block):

1. **`kod-denetcisi`** — Yazılım kalite + güvenlik + performans
   - Prompt: "[hedef] üzerinde kod denetimi yap. Son commit'i `git diff HEAD~1` ile incele. Bulguları kritik/öneri/not olarak sun."

2. **`ux-denetcisi`** — Kullanıcı deneyimi + erişilebilirlik
   - Prompt: "[hedef] üzerinde UX denetimi yap. Müşteri yolculuğu + friction + a11y + microcopy + mobile. Türkçe rapor."

3. **`tasarim-denetcisi`** — Görsel tasarım + brand uyumu
   - Prompt: "[hedef] üzerinde tasarım denetimi yap. Design system uyumu + tipografi + renk + spacing + component reuse + responsive. Pim Etiket brand bağlamı."

### 3) Sonuçları birleştir

3 agent dönünce **konsolide rapor** üret:

```markdown
# 🔬 Pim Etiket Denetim Raporu

**Hedef:** [dosya/commit]
**Tarih:** [bugün]

## 🚨 Kritik (acil düzeltme)
[Her 3 agent'ten gelen P0 bulgular birleştirilmiş]
- [Kategori: Kod/UX/Tasarım] Sorun — kaynak agent

## ⚠️ Öneri (yapılmalı)
[P1 bulgular]
- ...

## 💡 Not (gözlem)
[P2 bulgular]
- ...

## ✅ Doğru yapılanlar
- ...

## 📊 Skor (10 üzerinden)
- Kod kalitesi: X/10
- UX: Y/10
- Tasarım: Z/10
- **Genel: ((X+Y+Z)/3).toFixed(1)/10**
```

### 4) Aksiyon listesi

Raporun sonunda Sefa'ya sun:
- 🔴 **Şimdi düzeltilmesi gerekenler** (P0) — sıralı liste
- 🟡 **Bu sprintin sonuna** (P1) — sıralı liste
- 🟢 **Backlog** (P2) — sıralı liste

Her madde için **tahmini süre** (5 dk / 30 dk / 1 saat / 2+ saat).

### Kurallar

- **3 agent'ı paralel çalıştır** (tek mesaj, multiple Agent calls).
- **Sonuçları sentezle**, ham agent çıktısını üst üste yapıştırma.
- **Tekrar eden bulguları birleştir** (aynı satır 3 agent tarafından flagged → bir bulgu).
- **Türkçe rapor.**
- **Acil aksiyon listesi vermeden bitirme.**
